const { contextBridge, ipcRenderer, customMedia } = require("electron");

contextBridge.exposeInMainWorld("api", {
  showMessageBox: (options) => ipcRenderer.invoke("show-message-box", options),
  setItem: (key, value) => ipcRenderer.invoke("setItem", key, value),
  getItem: (key) => ipcRenderer.invoke("getItem", key),
  loadOtherHtml: (htmlFile) => ipcRenderer.send("load-other-html", htmlFile),
  onBmpData: (callback) =>
    ipcRenderer.on("get-stream", (event, bmpData) => callback(bmpData)),
  getBitmapData: () => ipcRenderer.invoke("get-bitmap-data"),
  getStream: () => ipcRenderer.invoke("getStream"),
  readFile: (filePath) => ipcRenderer.invoke("read-file", filePath),
});
