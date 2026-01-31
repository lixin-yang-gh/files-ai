// preload.mjs
import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('electronAPI', {
  // Dialog operations
  openDirectory: () => ipcRenderer.invoke('dialog:openDirectory'),

  // File system operations
  readDirectory: (path) => ipcRenderer.invoke('fs:readDirectory', path),
  readFile: (path) => ipcRenderer.invoke('fs:readFile', path),
  getFileStats: (path) => ipcRenderer.invoke('fs:getFileStats', path),

  // Events
  on: (channel, callback) => {
    ipcRenderer.on(channel, (_, ...args) => callback(...args));
  }
});