import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('electronAPI', {
  // Dialog operations
  openDirectory: () => ipcRenderer.invoke('dialog:openDirectory'),
  
  // File system operations
  readDirectory: (path: string) => ipcRenderer.invoke('fs:readDirectory', path),
  readFile: (path: string) => ipcRenderer.invoke('fs:readFile', path),
  getFileStats: (path: string) => ipcRenderer.invoke('fs:getFileStats', path),
  
  // Events
  on: (channel: string, callback: Function) => {
    ipcRenderer.on(channel, (_, ...args) => callback(...args));
  }
});