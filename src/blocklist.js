'use strict';

// Turns whatever the user types ("https://www.Facebook.com/feed") into "facebook.com".
function normalizeSite(input) {
  let text = String(input || '').trim().toLowerCase();
  if (!text) return null;
  if (!/^[a-z][a-z0-9+.-]*:\/\//.test(text)) text = 'http://' + text;
  let host;
  try {
    host = new URL(text).hostname;
  } catch {
    return null;
  }
  host = host.replace(/^www\./, '').replace(/\.$/, '');
  if (!/^[a-z0-9-]+(\.[a-z0-9-]+)+$/.test(host)) return null;
  return host;
}

function cleanList(list) {
  return [...new Set((Array.isArray(list) ? list : []).map(normalizeSite).filter(Boolean))];
}

// A blocked site also blocks its subdomains: "youtube.com" covers "m.youtube.com".
function isBlocked(hostname, list) {
  const host = normalizeSite(hostname);
  if (!host) return false;
  return list.some((site) => host === site || host.endsWith('.' + site));
}

module.exports = { normalizeSite, cleanList, isBlocked };
