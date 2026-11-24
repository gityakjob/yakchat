const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('yakChatOpenLink', {
  getInitialValue: () => ipcRenderer.invoke('open-link-get-initial'),
  submit: (value) => ipcRenderer.invoke('open-link-submit', value),
  cancel: () => ipcRenderer.send('open-link-cancel')
});
