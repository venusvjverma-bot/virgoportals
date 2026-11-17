const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('virgo', {
  signIn: (email, password) => ipcRenderer.invoke('sign-in', { email, password }),
  getState: () => ipcRenderer.invoke('get-state'),
  setDepartments: (ids) => ipcRenderer.invoke('set-departments', ids),
  testPrint: (departmentId) => ipcRenderer.invoke('test-print', departmentId),
});
