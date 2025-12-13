import { contextBridge } from 'electron';

contextBridge.exposeInMainWorld('electron', {
  // Add any specific API exposures here
  platform: process.platform,
});
