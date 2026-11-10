import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('electronAPI', {
  isElectron: true,
  platform: process.platform,
  isAlwaysOnTop: () => ipcRenderer.invoke('get-always-on-top'),
  toggleAlwaysOnTop: () => ipcRenderer.invoke('toggle-always-on-top'),
  hideToTray: () => ipcRenderer.invoke('hide-to-tray'),
  setRecordingState: (recording: boolean) => ipcRenderer.send('set-recording-state', recording),
  onRecordToggleShortcut: (callback: () => void) => {
    ipcRenderer.on('trigger-record-toggle', callback);
    return () => ipcRenderer.removeListener('trigger-record-toggle', callback);
  },
});
