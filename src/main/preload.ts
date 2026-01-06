import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('electronAPI', {
  getGitHubToken: () => ipcRenderer.invoke('get-github-token'),
  setGitHubToken: (token: string) => ipcRenderer.invoke('set-github-token', token),
  getRunningActions: () => ipcRenderer.invoke('get-running-actions'),
  closePopup: () => ipcRenderer.invoke('close-popup'),
  setGitHubOAuthCredentials: (clientId: string, clientSecret: string) =>
    ipcRenderer.invoke('set-github-oauth-credentials', clientId, clientSecret),
  getGitHubOAuthCredentials: () => ipcRenderer.invoke('get-github-oauth-credentials'),
  onActionStarted: (callback: (data: any) => void) => {
    ipcRenderer.on('action-started', (_event, data) => callback(data));
  },
  onActionUpdate: (callback: (data: any) => void) => {
    ipcRenderer.on('action-update', (_event, data) => callback(data));
  },
  onActionsUpdate: (callback: (data: any[]) => void) => {
    ipcRenderer.on('actions-update', (_event, data) => callback(data));
  },
  onOAuthError: (callback: (message: string) => void) => {
    ipcRenderer.on('oauth-error', (_event, message) => callback(message));
  },
});
