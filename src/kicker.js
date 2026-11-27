'use strict';

const path = require('path');
const { BrowserWindow, ipcMain, screen } = require('electron');
const { tabTarget, iconSpot } = require('./geometry');

const TIMEOUT_MS = 5000; // close the tab anyway if the animation gets stuck

// A second penguin pops out of the toolbar icon, walks along the tab bar and
// kicks the tab away, on a click-through overlay. The desktop penguin stays put.
function createKicker({ preferences, onImpact }) {
  const queue = [];
  let current = null;
  let overlay = null;
  let loaded = false;

  // The overlay is loaded once, ahead of time, so a kick can start instantly.
  function createOverlay() {
    loaded = false;
    overlay = new BrowserWindow({
      ...screen.getPrimaryDisplay().workArea,
      show: false,
      transparent: true,
      frame: false,
      resizable: false,
      movable: false,
      hasShadow: false,
      alwaysOnTop: true,
      skipTaskbar: true,
      focusable: false,
      enableLargerThanScreen: true,
      webPreferences: { ...preferences(), backgroundThrottling: false },
    });
    overlay.setAlwaysOnTop(true, 'screen-saver');
    overlay.setIgnoreMouseEvents(true);
    overlay.webContents.once('did-finish-load', () => { loaded = true; run(); });
    overlay.on('closed', () => { overlay = null; });
    overlay.loadFile(path.join(__dirname, '..', 'renderer', 'kick.html'));
  }

  function run() {
    if (current || !queue.length) return;
    if (!overlay) { createOverlay(); return; }
    if (!loaded) return;
    const event = queue.shift();
    const strip = event.strip;
    const display = strip
      ? screen.getDisplayMatching({ x: strip.left, y: strip.top, width: strip.width, height: 200 })
      : screen.getPrimaryDisplay();
    const area = display.workArea;
    const plan = {
      host: event.host,
      target: tabTarget(strip, area),
      door: iconSpot(strip, area),
    };

    current = { event, closed: false, timer: setTimeout(finish, TIMEOUT_MS) };

    overlay.setBounds(area);
    overlay.showInactive();
    overlay.moveTop();
    overlay.webContents.send('kick:start', plan);
  }

  function close() {
    if (!current || current.closed) return;
    const kicked = current;
    kicked.closed = true;
    onImpact(kicked.event);
    // Another tab is waiting: skip the trip home and go for it.
    setTimeout(() => { if (current === kicked && queue.length) finish(); }, 250);
  }

  function finish() {
    if (!current) return;
    if (!current.closed) { current.closed = true; onImpact(current.event); }
    clearTimeout(current.timer);
    if (overlay && !overlay.isDestroyed()) overlay.hide();
    current = null;
    run();
  }

  const fromOverlay = (e) => overlay && !overlay.isDestroyed() && e.sender === overlay.webContents;

  ipcMain.on('kick:impact', (e) => { if (fromOverlay(e)) close(); });
  ipcMain.on('kick:done', (e) => { if (fromOverlay(e)) finish(); });

  createOverlay();

  return {
    kick(event) {
      const same = (other) => other.tabId === event.tabId;
      if (queue.some(same) || (current && !current.closed && same(current.event))) return;
      queue.push(event);
      if (current && current.closed) finish();
      else run();
    },
    destroy: () => overlay && !overlay.isDestroyed() && overlay.destroy(),
  };
}

module.exports = { createKicker };
