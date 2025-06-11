const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  printSticker: (stickerData) => ipcRenderer.send('print-sticker', stickerData),
});