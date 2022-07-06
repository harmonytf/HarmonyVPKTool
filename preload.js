const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld('api', {
    openVPK: () => ipcRenderer.invoke('openVPK'),
    readVPKTree: (vpkPath) => ipcRenderer.invoke('readVPKTree', vpkPath),
    copyFiles: (vpkPath, files) => ipcRenderer.invoke('copyFiles', vpkPath, files),
    copyCancel: (vpkPath, files) => ipcRenderer.invoke('copyCancel', vpkPath, files),
    onCopyProgress: (cb) => ipcRenderer.on("copyProgress", cb),
    onCopyDone: (cb) => ipcRenderer.on("copyDone", cb),
    previewFile: (vpkPath, file, isText = false) => ipcRenderer.invoke("previewFile", vpkPath, file, isText),
    browsePreviewFile: (filePath) => ipcRenderer.invoke("browsePreviewFile", filePath),
    getSettings: () => ipcRenderer.invoke("getSettings"),
    updateSettings: (settings) => ipcRenderer.invoke("updateSettings", settings),
    // Custom CSS
    getCustomCSS: () => ipcRenderer.invoke("getCustomCSS")
})