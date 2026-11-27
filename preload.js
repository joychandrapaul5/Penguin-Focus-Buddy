'use strict';

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('buddy', {
  getState: () => ipcRenderer.invoke('state'),
  save: (settings) => ipcRenderer.invoke('save', settings),
  action: (name) => ipcRenderer.send('action', name),
  setMinimized: (value) => ipcRenderer.send('set-minimized', value),
  dragStart: () => ipcRenderer.send('drag-start'),
  dragMove: (dx, dy) => ipcRenderer.send('drag-move', dx, dy),
  dragEnd: (dx, dy) => ipcRenderer.send('drag-end', dx, dy),
  openSettings: () => ipcRenderer.send('open-settings'),
  openExtensionFolder: () => ipcRenderer.send('open-extension-folder'),
  setPassthrough: (ignore) => ipcRenderer.send('mouse-passthrough', ignore),
  onState: (callback) => ipcRenderer.on('penguin:state', (_event, state) => callback(state)),
  kickImpact: () => ipcRenderer.send('kick:impact'),
  kickDone: () => ipcRenderer.send('kick:done'),
  onKick: (callback) => ipcRenderer.on('kick:start', (_event, plan) => callback(plan)),
  onClosed: (callback) => ipcRenderer.on('penguin:closed', (_event, host) => callback(host)),
});
