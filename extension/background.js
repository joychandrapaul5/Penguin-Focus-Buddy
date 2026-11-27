// Tells the desktop app which site is in front, and closes a tab when the app asks.
// Only the site name (for example "youtube.com") is sent, and only to this computer.
const APP_URL = 'ws://127.0.0.1:47821';
const CHECK_URL = 'http://127.0.0.1:47821';
const RETRY_MS = 5000;
const COMMIT_WAIT_MS = 8000; // longest wait for a page to arrive before closing it

let socket = null;
let pingTimer = null;
let retryTimer = null;
let checking = false;
let kicked = []; // tabs the penguin closed: { sessionId, url }
const closing = new Set(); // tab IDs being closed right now
let reporting = Promise.resolve();

// A failed WebSocket shows up under "Errors" in chrome://extensions, even though
// it only means the app is closed. A failed fetch can be caught quietly, so ask first.
async function appIsRunning() {
  try {
    await fetch(CHECK_URL, { cache: 'no-store' });
    return true;
  } catch {
    return false;
  }
}

function retryLater() {
  clearTimeout(retryTimer);
  retryTimer = setTimeout(connect, RETRY_MS);
}

async function connect() {
  if (checking || (socket && socket.readyState <= WebSocket.OPEN)) return;
  checking = true;
  const running = await appIsRunning();
  checking = false;
  if (!running) {
    retryLater();
    return;
  }
  const ws = new WebSocket(APP_URL);
  socket = ws;
  ws.onopen = () => {
    clearInterval(pingTimer);
    // Regular traffic keeps the service worker awake while the app is running.
    pingTimer = setInterval(() => send({ type: 'ping' }), 20000);
    report();
  };
  ws.onmessage = (event) => handle(JSON.parse(event.data));
  ws.onclose = () => {
    if (socket !== ws) return;
    clearInterval(pingTimer);
    socket = null;
    retryLater();
  };
}

function send(message) {
  if (socket && socket.readyState === WebSocket.OPEN) socket.send(JSON.stringify(message));
}

function siteOf(tab) {
  try {
    // pendingUrl is where the tab is heading, so we react before the page loads.
    const url = new URL(tab.pendingUrl || tab.url);
    return url.protocol === 'http:' || url.protocol === 'https:' ? url.hostname.replace(/^www\./, '') : null;
  } catch {
    return null;
  }
}

// The tab in front, plus where the window is, so the penguin knows where to kick.
async function frontTab() {
  const win = await chrome.windows.getLastFocused();
  if (!win.focused) return null;
  const tabs = await chrome.tabs.query({ windowId: win.id });
  const tab = tabs.find((t) => t.active);
  if (!tab) return null;
  const strip = {
    left: win.left,
    top: win.top,
    width: win.width,
    state: win.state,
    index: tab.index,
    count: tabs.length,
    pinned: tabs.filter((t) => t.pinned).length,
  };
  return { tab, strip };
}

const addressOf = (tab) => tab.pendingUrl || tab.url;

async function recentlyClosed() {
  return (await chrome.sessions.getRecentlyClosed()).filter((entry) => entry.tab);
}

// True once, when a tab the penguin closed has been brought back (Ctrl+Shift+T):
// the same address is open again and Chrome no longer lists it as closed.
async function wasRestored(tab) {
  const matches = kicked.filter((item) => item.url === addressOf(tab));
  if (!matches.length) return false;
  const listed = new Set((await recentlyClosed()).map((entry) => entry.tab.sessionId));
  const back = matches.find((item) => !listed.has(item.sessionId));
  if (!back) return false;
  kicked = kicked.filter((item) => item !== back);
  return true;
}

async function sendFrontTab() {
  const front = await frontTab().catch(() => null);
  const host = front && siteOf(front.tab);
  if (!host) {
    send({ type: 'active', tabId: null, host: null });
    return;
  }
  const restored = await wasRestored(front.tab).catch(() => false);
  send({ type: 'active', tabId: front.tab.id, host, strip: front.strip, restored });
}

// One report at a time, so the app receives them in order.
function report() {
  reporting = reporting.then(sendFrontTab).catch(() => {});
}

// Chrome can only reopen a page that had arrived, so wait for it before closing.
async function arrivedTab(tabId, host) {
  const giveUp = Date.now() + COMMIT_WAIT_MS;
  for (;;) {
    const tab = await chrome.tabs.get(tabId);
    if (siteOf(tab) !== host) return null; // the tab moved on to another site
    if ((tab.url && !tab.pendingUrl) || Date.now() > giveUp) return tab;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
}

// Notes which "recently closed" entry is ours, to recognise it when it comes back.
async function remember(url) {
  for (let attempt = 0; attempt < 10; attempt += 1) {
    const known = new Set(kicked.map((item) => item.sessionId));
    const entry = (await recentlyClosed()).find((e) => e.tab.url === url && !known.has(e.tab.sessionId));
    if (entry) {
      kicked = [...kicked, { sessionId: entry.tab.sessionId, url }].slice(-25);
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
}

async function handle(message) {
  if (message.type !== 'close' || closing.has(message.tabId)) return;
  closing.add(message.tabId);
  try {
    const tab = await arrivedTab(message.tabId, message.host);
    if (!tab) return;
    const siblings = await chrome.tabs.query({ windowId: tab.windowId });
    if (siblings.length === 1) await chrome.tabs.create({ windowId: tab.windowId }); // keep the window open
    await chrome.tabs.remove(tab.id);
    await remember(addressOf(tab));
  } catch {
    // The tab was already closed.
  } finally {
    closing.delete(message.tabId);
  }
}

function changed() {
  connect();
  report();
}

chrome.tabs.onActivated.addListener(changed);
chrome.tabs.onUpdated.addListener((_id, info, tab) => { if ((info.url || info.status === 'loading') && tab.active) changed(); });
chrome.tabs.onRemoved.addListener(changed);
chrome.tabs.onCreated.addListener(changed);
chrome.tabs.onMoved.addListener(changed);
chrome.windows.onFocusChanged.addListener(changed);
chrome.windows.onBoundsChanged.addListener(changed);
chrome.runtime.onStartup.addListener(connect);
chrome.runtime.onInstalled.addListener(connect);

// If the app was closed, try again twice a minute.
chrome.alarms.create('reconnect', { periodInMinutes: 0.5 });
chrome.alarms.onAlarm.addListener(connect);

connect();
