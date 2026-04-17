const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  downloadSoftware: (software) => ipcRenderer.invoke('download-software', software),
  checkInstalled: (softwareList) => ipcRenderer.invoke('check-installed', softwareList),
  onDownloadProgress: (callback) => ipcRenderer.on('download-progress', (_event, data) => callback(data)),
  getDownloadsPath: () => ipcRenderer.invoke('get-downloads-path'),
  openDownloadsFolder: () => ipcRenderer.invoke('open-downloads-folder'),
  openExternal: (url) => ipcRenderer.invoke('open-external', url),
  updates: {
    getState: () => ipcRenderer.invoke('update:get-state'),
    startDownload: () => ipcRenderer.invoke('update:start-download'),
    quitAndInstall: () => ipcRenderer.invoke('update:quit-and-install'),
    openReleasePage: () => ipcRenderer.invoke('update:open-external'),
    onState: (callback) => ipcRenderer.on('update:state', (_event, state) => callback(state))
  }
});
