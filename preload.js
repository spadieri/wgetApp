const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  downloadSoftware: (software) => ipcRenderer.invoke('download-software', software),
  checkInstalled: (softwareList) => ipcRenderer.invoke('check-installed', softwareList),
  onDownloadProgress: (callback) => ipcRenderer.on('download-progress', (_event, data) => callback(data)),
  getDownloadsPath: () => ipcRenderer.invoke('get-downloads-path')
});
