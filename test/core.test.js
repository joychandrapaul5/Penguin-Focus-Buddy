'use strict';

const test = require('node:test');
const assert = require('node:assert');
const crypto = require('crypto');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { normalizeSite, isBlocked } = require('../src/blocklist');
const { FocusEngine } = require('../src/focus');
const { Store, sanitize } = require('../src/store');
const WebSocket = require('ws');
const { startServer, EXTENSION_ORIGIN } = require('../src/server');
const { tabTarget, cleanStrip, iconSpot, defaultAnchor, penguinPlace } = require('../src/geometry');

const settings = { focusMinutes: 1, breakMinutes: 1, graceSeconds: 10, blockedSites: ['youtube.com'] };

function setup() {
  const clock = { t: 1000 };
  return { clock, engine: new FocusEngine(() => settings, () => clock.t) };
}

test('sites are normalized and subdomains are blocked', () => {
  assert.strictEqual(normalizeSite('https://www.YouTube.com/watch?v=1'), 'youtube.com');
  assert.strictEqual(normalizeSite('not a site'), null);
  assert.ok(isBlocked('m.youtube.com', ['youtube.com']));
  assert.ok(!isBlocked('notyoutube.com', ['youtube.com']));
  assert.ok(!isBlocked('youtube.com.example.org', ['youtube.com']));
});

test('a blocked tab is closed only after the warning time', () => {
  const { clock, engine } = setup();
  engine.startFocus();
  engine.setActive({ tabId: 7, host: 'youtube.com' });
  clock.t += 9000;
  assert.deepStrictEqual(engine.tick(), []);
  assert.strictEqual(engine.snapshot().warning.seconds, 1);
  clock.t += 1000;
  assert.deepStrictEqual(engine.tick(), [{ type: 'close-tab', tabId: 7, host: 'youtube.com', strip: undefined }]);
  assert.strictEqual(engine.snapshot().closedCount, 1);
});

test('nothing is closed outside focus time or on allowed sites', () => {
  const { clock, engine } = setup();
  engine.setActive({ tabId: 1, host: 'youtube.com' });
  clock.t += 60000;
  assert.deepStrictEqual(engine.tick(), []);
  engine.startFocus();
  engine.setActive({ tabId: 2, host: 'github.com' });
  clock.t += 20000;
  assert.deepStrictEqual(engine.tick(), []);
});

test('switching away and back does not reset the countdown', () => {
  const { clock, engine } = setup();
  engine.startFocus();
  engine.setActive({ tabId: 7, host: 'youtube.com' });
  clock.t += 8000;
  engine.setActive(null);
  clock.t += 8000;
  engine.setActive({ tabId: 7, host: 'youtube.com' });
  assert.strictEqual(engine.snapshot().warning.seconds, 3);
});

test('a tab already open when focus starts gets a warning', () => {
  const { engine } = setup();
  engine.setActive({ tabId: 3, host: 'youtube.com' });
  engine.startFocus();
  assert.strictEqual(engine.snapshot().warning.seconds, 10);
});

test('focus turns into a break, then idle', () => {
  const { clock, engine } = setup();
  engine.startFocus();
  clock.t += 60000;
  assert.deepStrictEqual(engine.tick(), [{ type: 'break-started' }]);
  clock.t += 60000;
  assert.deepStrictEqual(engine.tick(), [{ type: 'break-ended' }]);
  assert.strictEqual(engine.snapshot().phase, 'idle');
});

test('settings are validated and saved', () => {
  assert.strictEqual(sanitize({ focusMinutes: '', graceSeconds: 0 }).focusMinutes, 25);
  assert.strictEqual(sanitize({ graceSeconds: -4 }).graceSeconds, 0);
  assert.strictEqual(sanitize({}).graceSeconds, 0);
  const folder = fs.mkdtempSync(path.join(os.tmpdir(), 'penguin-'));
  new Store(folder).save({ focusMinutes: 50, blockedSites: ['https://reddit.com/r/x', 'bad'] });
  const loaded = new Store(folder).settings;
  assert.strictEqual(loaded.focusMinutes, 50);
  assert.strictEqual(loaded.penguinMinimized, false);
  new Store(folder).save({ penguinMinimized: true });
  new Store(folder).save({ focusMinutes: 45 }); // saving settings keeps the penguin small
  assert.strictEqual(new Store(folder).settings.penguinMinimized, true);
  assert.deepStrictEqual(loaded.blockedSites, ['reddit.com']);
});

test('repeat reports of the same tab do not delay the kick', () => {
  const { clock, engine } = setup();
  engine.startFocus();
  engine.setActive({ tabId: 7, host: 'youtube.com' });
  clock.t += 9500;
  engine.setActive({ tabId: 7, host: 'youtube.com' });
  clock.t += 500;
  assert.strictEqual(engine.tick()[0].type, 'close-tab');
});

test('the kick target follows the tab position', () => {
  const area = { x: 0, y: 0, width: 1920, height: 1040 };
  const strip = { left: -8, top: -8, width: 1936, state: 'maximized', index: 1, count: 3, pinned: 0 };
  const target = tabTarget(strip, area);
  assert.deepStrictEqual(target, { x: 524, y: 20, width: 240 });
  const crowded = tabTarget({ ...strip, index: 29, count: 30 }, area);
  assert.ok(crowded.width < 60 && crowded.x <= 1920);
  assert.deepStrictEqual(tabTarget(null, area), { x: 960, y: 20, width: 200 });
  assert.strictEqual(cleanStrip({ left: 'x' }), null);
  assert.deepStrictEqual(cleanStrip(strip), strip);
});

test('with no warning time a blocked tab is kicked at once, and only once', () => {
  const clock = { t: 1000 };
  const engine = new FocusEngine(() => ({ ...settings, graceSeconds: 0 }), () => clock.t);
  engine.startFocus();
  engine.setActive({ tabId: 9, host: 'youtube.com' });
  assert.strictEqual(engine.snapshot().warning, null);
  assert.strictEqual(engine.tick()[0].type, 'close-tab');
  clock.t += 200;
  engine.setActive({ tabId: 9, host: 'youtube.com' }); // browser reports it again mid-kick
  assert.deepStrictEqual(engine.tick(), []);
  assert.strictEqual(engine.snapshot().closedCount, 1);
  engine.setActive({ tabId: 10, host: 'youtube.com' }); // a second tab is kicked too
  assert.strictEqual(engine.tick()[0].tabId, 10);
  clock.t += 11000;
  engine.setActive({ tabId: 9, host: 'youtube.com' }); // still open: try again
  assert.strictEqual(engine.tick()[0].tabId, 9);
});

test('positions match a 1534 wide maximized Chrome window', () => {
  const area = { x: 0, y: 0, width: 1534, height: 816 };
  const strip = { left: -8, top: -8, width: 1550, state: 'maximized', index: 7, count: 8, pinned: 0 };
  assert.ok(Math.abs(tabTarget(strip, area).x - 1176) <= 4); // right end of the 8th tab
  assert.deepStrictEqual(iconSpot(strip, area), { x: 1351, y: 63 });
});

test('the desktop penguin can be moved but stays on the screen', () => {
  const area = { x: 0, y: 0, width: 1534, height: 816 };
  const start = defaultAnchor(area);
  assert.deepStrictEqual(penguinPlace(start, area, true).anchor, { x: 1486, y: 808 }); // mini: in the corner
  assert.deepStrictEqual(penguinPlace(start, area, false).bounds, { x: 1294, y: 508, width: 240, height: 300 });
  assert.deepStrictEqual(penguinPlace({ x: -500, y: -500 }, area, true).anchor, { x: 32, y: 100 });
  assert.deepStrictEqual(penguinPlace({ x: -500, y: -500 }, area, false).anchor, { x: 120, y: 300 });
  assert.deepStrictEqual(sanitize({ penguinPosition: { x: 5, y: 'a' } }).penguinPosition, null);
});

test('the app accepts the ID that the extension manifest produces', () => {
  const { key } = require('../extension/manifest.json');
  const hash = crypto.createHash('sha256').update(Buffer.from(key, 'base64')).digest('hex').slice(0, 32);
  const id = [...hash].map((c) => String.fromCharCode(97 + parseInt(c, 16))).join('');
  assert.strictEqual(EXTENSION_ORIGIN, 'chrome-extension://' + id);
});

test('only our extension can connect, and bad messages do not crash the app', async () => {
  const port = 47993;
  const seen = [];
  const server = startServer({ port, onActive: (a) => seen.push(a), onConnectionChange() {} });
  const connect = (origin) => new Promise((resolve) => {
    const socket = new WebSocket(`ws://127.0.0.1:${port}`, { origin });
    socket.on('open', () => resolve(socket));
    socket.on('error', () => resolve(null));
  });
  try {
    assert.strictEqual(await connect('https://example.com'), null);
    assert.strictEqual(await connect('chrome-extension://aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'), null);
    const socket = await connect(EXTENSION_ORIGIN);
    assert.ok(socket);
    const strip = { left: 0, top: 0, width: 800, index: 0, count: 1, pinned: 0, state: { toString: 1 } };
    for (const bad of ['x', 'null', '[]']) socket.send(bad);
    socket.send(JSON.stringify({ type: 'active', tabId: 1, host: { toString: 1 } }));
    socket.send(JSON.stringify({ type: 'active', tabId: 2, host: 'youtube.com', strip }));
    while (!seen.some((a) => a && a.tabId === 2)) await new Promise((r) => setTimeout(r, 10));
    assert.strictEqual(seen.find((a) => a && a.tabId === 2).strip.state, 'normal');
  } finally {
    server.stop();
  }
});

test('a tab brought back with Ctrl+Shift+T is left alone until the next round', () => {
  const { clock, engine } = setup();
  engine.startFocus();
  engine.setActive({ tabId: 9, host: 'youtube.com', restored: true });
  engine.setActive({ tabId: 9, host: 'youtube.com', restored: false }); // later reports
  clock.t += 30000;
  assert.deepStrictEqual(engine.tick(), []);
  assert.strictEqual(engine.snapshot().warning, null);
  engine.setActive({ tabId: 10, host: 'youtube.com' }); // a fresh tab is still blocked
  clock.t += 10000;
  assert.strictEqual(engine.tick()[0].tabId, 10);
  engine.setActive({ tabId: 9, host: 'youtube.com' });
  engine.stop();
  engine.startFocus();
  clock.t += 10000;
  assert.strictEqual(engine.tick()[0].tabId, 9);
});
