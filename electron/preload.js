/**
 * TTP2026 战略看板 - Electron 预加载脚本
 * 安全地暴露 Node.js API 给渲染进程
 */
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  // 应用信息
  getVersion: () => ipcRenderer.invoke('get-version'),
  
  // 系统功能
  openExternal: (url) => ipcRenderer.invoke('open-external', url),
  showSaveDialog: (options) => ipcRenderer.invoke('show-save-dialog', options),
  showOpenDialog: (options) => ipcRenderer.invoke('show-open-dialog', options),
  
  // 通知
  showNotification: (title, body) => ipcRenderer.invoke('show-notification', { title, body }),
  
  // 平台信息
  platform: process.platform,
  isElectron: true,
});
