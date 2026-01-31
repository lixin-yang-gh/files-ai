// src/main/preload.cjs    ← or preload.js
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  openDirectory: () => ipcRenderer.invoke('dialog:openDirectory'),

  readDirectory: (path) => ipcRenderer.invoke('fs:readDirectory', path),
  readFile:      (path) => ipcRenderer.invoke('fs:readFile', path),
  getFileStats:  (path) => ipcRenderer.invoke('fs:getFileStats', path),

  on: (channel, callback) => {
    ipcRenderer.on(channel, (_, ...args) => callback(...args));
  }
});