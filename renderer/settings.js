'use strict';

const $ = (id) => document.getElementById(id);
const numbers = ['focusMinutes', 'breakMinutes', 'graceSeconds'];

function fill(settings) {
  for (const id of numbers) $(id).value = settings[id];
  $('blockedSites').value = settings.blockedSites.join('\n');
}

function showConnection({ connected, serverError }) {
  const element = $('connection');
  const text = serverError || (connected ? 'Browser extension connected' : 'Browser extension not connected');
  if (element.textContent !== text) element.textContent = text;
  element.classList.toggle('ok', connected && !serverError);
  $('setup').hidden = connected; // the steps disappear once the browser is linked
}

$('form').addEventListener('submit', async (event) => {
  event.preventDefault();
  const typed = $('blockedSites').value.split(/[\n,]+/).map((s) => s.trim()).filter(Boolean);
  const next = { blockedSites: typed };
  for (const id of numbers) next[id] = $(id).value;
  const saved = await window.buddy.save(next);
  fill(saved);
  const skipped = typed.length - saved.blockedSites.length;
  $('saved').textContent = skipped > 0 ? `Saved. ${skipped} invalid or repeated line(s) removed.` : 'Saved.';
});

$('extension').addEventListener('click', () => window.buddy.openExtensionFolder());
window.buddy.onState(showConnection);
window.buddy.getState().then((state) => { fill(state.settings); showConnection(state); });
