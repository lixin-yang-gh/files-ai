// src/main/preload.js - REPLACE entire file

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  openDirectory: () => ipcRenderer.invoke('dialog:openDirectory'),

  readDirectory: (path) => ipcRenderer.invoke('fs:readDirectory', path),

  getFileStats: (path) => ipcRenderer.invoke('get-file-stats', path),

  readFile: (path) => ipcRenderer.invoke('read-file', path),
  writeFile: (path, content) => ipcRenderer.invoke('write-file', { path, content }),

  getLastOpenedFolder: () => ipcRenderer.invoke('store:getLastOpenedFolder'),
  saveLastOpenedFolder: (path) => ipcRenderer.invoke('store:saveLastOpenedFolder', path),

  getSystemPrompt: () => ipcRenderer.invoke('store:getSystemPrompt'),
  saveSystemPrompt: (value) => ipcRenderer.invoke('store:saveSystemPrompt', value),

  getTask: () => ipcRenderer.invoke('store:getTask'),
  saveTask: (value) => ipcRenderer.invoke('store:saveTask', value),

  getIssues: () => ipcRenderer.invoke('store:getIssues'),
  saveIssues: (value) => ipcRenderer.invoke('store:saveIssues', value),

  getSelectedHeader: () => ipcRenderer.invoke('store:getSelectedHeader'),
  saveSelectedHeader: (value) => ipcRenderer.invoke('store:saveSelectedHeader', value),

  getMaskedSubstrings: () => ipcRenderer.invoke('store:getMaskedSubstrings'),
  saveMaskedSubstrings: (value) => ipcRenderer.invoke('store:saveMaskedSubstrings', value),

  redactText: (text) => ipcRenderer.invoke('redact-text', text),

  // Session management
  updateFileCount: (count) => ipcRenderer.invoke('session:updateFileCount', count),
  setSessionLabel: (label) => ipcRenderer.invoke('session:setLabel', label),
  getSessionInfo: () => ipcRenderer.invoke('session:getInfo'),
  getSessionId: () => ipcRenderer.invoke('session:getId'),
  getAllSessions: () => ipcRenderer.invoke('session:getAll'),
  getActiveSessionsCount: () => ipcRenderer.invoke('session:getActiveCount'),

  on: (channel, callback) => {
    ipcRenderer.on(channel, (_, ...args) => callback(...args));
  }
});