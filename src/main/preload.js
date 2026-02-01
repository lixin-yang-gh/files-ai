const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  openDirectory: () => ipcRenderer.invoke('dialog:openDirectory'),

  readDirectory: (path) => ipcRenderer.invoke('fs:readDirectory', path),
  
  getFileStats: (path) => ipcRenderer.invoke('get-file-stats', path),
  
  readFile: (path) => ipcRenderer.invoke('read-file', path),
  writeFile: (path, content) => ipcRenderer.invoke('write-file', { path, content }),

  on: (channel, callback) => {
    ipcRenderer.on(channel, (_, ...args) => callback(...args));
  }
});