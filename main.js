'use strict';

const path = require('path');
const { app, BrowserWindow, Tray, Menu, Notification, ipcMain, screen, shell, nativeImage } = require('electron');
const { Store } = require('./src/store');
const { FocusEngine } = require('./src/focus');
const { startServer } = require('./src/server');
const { createKicker } = require('./src/kicker');
const { defaultAnchor, penguinPlace, PENGUIN_SIZE } = require('./src/geometry');

const icon = path.join(__dirname, 'assets', 'icon.png');

let store;
let engine;
let server;
let penguinWindow;
let settingsWindow;
let kicker;
let tray;
let dragFrom = null; // where the penguin stood when a drag began
let connected = false;
let serverError = '';

if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on('second-instance', () => penguinWindow && penguinWindow.showInactive());
  app.whenReady().then(start);
}

function start() {
  app.setAppUserModelId('com.zaki.penguinfocusbuddy');
  // While running from the project folder, settings stay in ./data next to the code.
  const dataFolder = app.isPackaged ? app.getPath('userData') : path.join(__dirname, 'data');
  store = new Store(dataFolder);
  engine = new FocusEngine(() => store.settings);

  server = startServer({
    onActive: (active) => { engine.setActive(active); step(); }, // react at once
    onConnectionChange: (value) => { connected = value; update(); },
    onError: (error) => {
      serverError = error.code === 'EADDRINUSE'
        ? 'Port 47821 is busy. Close the other program and restart me.'
        : 'Browser link failed: ' + error.message;
      update();
    },
  });

  createPenguinWindow();
  kicker = createKicker({
    preferences: webPreferences,
    // The tab is closed at the moment the penguin's kick lands.
    onImpact: (event) => {
      if (engine.phase !== 'focus') return false;
      server.closeTab(event.tabId, event.host);
      send('penguin:closed', event.host);
      return true;
    },
  });
  createTray();
  registerIpc();
  setInterval(step, 250);
  welcome();
}

// The first time the installed app runs, show Settings with the browser setup steps.
function welcome() {
  if (!app.isPackaged || !store.isNew) return;
  store.save({});
  openSettings();
}

function step() {
  if (!kicker) return;
  for (const event of engine.tick()) handleEvent(event);
  update();
}

function webPreferences() {
  return { preload: path.join(__dirname, 'preload.js'), contextIsolation: true, nodeIntegration: false };
}

// Where the penguin should stand now: the saved spot, kept inside its screen.
function currentPlace(point = store.settings.penguinPosition) {
  const anchor = point || defaultAnchor(screen.getPrimaryDisplay().workArea);
  const area = screen.getDisplayNearestPoint(anchor).workArea;
  return penguinPlace(anchor, area, store.settings.penguinMinimized);
}

// setBounds with the full size keeps the window steady on scaled Windows displays.
function placePenguin(point) {
  if (penguinWindow && !penguinWindow.isDestroyed()) penguinWindow.setBounds(currentPlace(point).bounds);
}

function createPenguinWindow() {
  penguinWindow = new BrowserWindow({
    ...currentPlace().bounds,
    transparent: true,
    frame: false,
    resizable: false,
    hasShadow: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    focusable: false, // clicking the penguin never steals focus from your work
    maximizable: false,
    fullscreenable: false,
    webPreferences: webPreferences(),
  });
  penguinWindow.setAlwaysOnTop(true, 'screen-saver');
  penguinWindow.setIgnoreMouseEvents(true, { forward: true }); // empty space is click-through
  placePenguin();
  penguinWindow.loadFile(path.join(__dirname, 'renderer', 'desktop-penguin.html'));
  screen.on('display-removed', () => placePenguin());
  screen.on('display-metrics-changed', () => placePenguin());
}

function openSettings() {
  if (settingsWindow) {
    settingsWindow.show();
    settingsWindow.focus();
    return;
  }
  settingsWindow = new BrowserWindow({
    width: 460,
    height: 660,
    title: 'Penguin Focus Buddy: Settings',
    icon,
    autoHideMenuBar: true,
    webPreferences: webPreferences(),
  });
  settingsWindow.loadFile(path.join(__dirname, 'renderer', 'settings.html'));
  settingsWindow.on('closed', () => { settingsWindow = null; });
}

function createTray() {
  tray = new Tray(nativeImage.createFromPath(icon).resize({ width: 16, height: 16 }));
  tray.setToolTip('Penguin Focus Buddy');
  tray.setContextMenu(Menu.buildFromTemplate([
    { label: 'Start focus', click: () => act('start') },
    { label: 'Take a break', click: () => act('break') },
    { label: 'Stop timer', click: () => act('stop') },
    { type: 'separator' },
    { label: 'Minimize / maximize penguin', click: () => setMinimized(!store.settings.penguinMinimized) },
    { label: 'Show / hide penguin', click: () => (penguinWindow.isVisible() ? penguinWindow.hide() : penguinWindow.showInactive()) },
    { label: 'Settings', click: openSettings },
    { label: 'Open extension folder', click: openExtensionFolder },
    { type: 'separator' },
    { label: 'Quit', click: () => app.quit() },
  ]));
  tray.on('click', () => penguinWindow.showInactive());
}

function openExtensionFolder() {
  const base = app.isPackaged ? process.resourcesPath : __dirname;
  shell.openPath(path.join(base, 'extension'));
}

function act(action) {
  if (action === 'start') engine.startFocus();
  else if (action === 'break') engine.startBreak();
  else if (action === 'stop') engine.stop();
  step();
}

function setMinimized(value) {
  store.save({ penguinMinimized: Boolean(value) });
  placePenguin(); // the big penguin needs more room, so it may step in from an edge
  penguinWindow.showInactive();
  update();
}

function handleEvent(event) {
  if (event.type === 'close-tab') {
    kicker.kick(event);
  } else if (event.type === 'break-started') {
    notify('Break time', 'Great work. Stand up, stretch, and drink some water.');
  } else if (event.type === 'break-ended') {
    notify('Break is over', 'Ready for the next focus round? Press Start.');
  }
}

function notify(title, body) {
  if (penguinWindow) penguinWindow.showInactive();
  if (Notification.isSupported()) new Notification({ title, body, icon }).show();
}

function state() {
  return { ...engine.snapshot(), connected, serverError, settings: store.settings };
}

function send(channel, payload) {
  for (const win of [penguinWindow, settingsWindow]) {
    if (win && !win.isDestroyed()) win.webContents.send(channel, payload);
  }
}

function update() {
  if (engine) send('penguin:state', state());
}

function registerIpc() {
  ipcMain.handle('state', () => state());
  ipcMain.handle('save', (_event, next) => { store.save(next); update(); return store.settings; });
  ipcMain.on('action', (_event, action) => act(action));
  ipcMain.on('open-settings', openSettings);
  ipcMain.on('set-minimized', (_event, value) => setMinimized(value));
  ipcMain.on('open-extension-folder', openExtensionFolder);
  ipcMain.on('drag-start', () => { dragFrom = currentPlace().anchor; });
  ipcMain.on('drag-move', (_event, dx, dy) => {
    if (!dragFrom || !Number.isFinite(dx) || !Number.isFinite(dy)) return;
    placePenguin({ x: dragFrom.x + dx, y: dragFrom.y + dy });
  });
  ipcMain.on('drag-end', (_event, dx, dy) => {
    if (!dragFrom || !Number.isFinite(dx) || !Number.isFinite(dy)) return;
    const dropped = currentPlace({ x: dragFrom.x + dx, y: dragFrom.y + dy });
    dragFrom = null;
    store.save({ penguinPosition: dropped.anchor });
    placePenguin();
  });
  ipcMain.on('mouse-passthrough', (_event, ignore) => {
    penguinWindow.setIgnoreMouseEvents(Boolean(ignore), { forward: true });
  });
}

app.on('before-quit', () => kicker && kicker.destroy());
app.on('window-all-closed', () => {}); // stay in the tray
app.on('will-quit', () => server && server.stop());
