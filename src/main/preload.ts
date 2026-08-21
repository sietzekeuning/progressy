import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('electronAPI', {
  getGitHubToken: () => ipcRenderer.invoke('get-github-token'),
  setGitHubToken: (token: string) => ipcRenderer.invoke('set-github-token', token),
  getRunningActions: () => ipcRenderer.invoke('get-running-actions'),
  dismissAction: (key: string) => ipcRenderer.invoke('dismiss-action', key),
  closePopup: () => ipcRenderer.invoke('close-popup'),
  popupEmpty: () => ipcRenderer.invoke('popup-empty'),
  setPointerInteractive: (interactive: boolean) => ipcRenderer.invoke('set-pointer-interactive', interactive),
  setGitHubOAuthCredentials: (clientId: string, clientSecret: string) =>
    ipcRenderer.invoke('set-github-oauth-credentials', clientId, clientSecret),
  getGitHubOAuthCredentials: () => ipcRenderer.invoke('get-github-oauth-credentials'),
  resizeWindow: (width: number, height: number) => ipcRenderer.invoke('resize-window', width, height),
  onActionsUpdate: (callback: (data: any[]) => void) => {
    ipcRenderer.on('actions-update', (_event, data) => callback(data));
  },
  onOAuthError: (callback: (message: string) => void) => {
    ipcRenderer.on('oauth-error', (_event, message) => callback(message));
  },
});
