import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('electronAPI', {
  // Auth
  getAuthState: () => ipcRenderer.invoke('get-auth-state'),
  submitToken: (token: string) => ipcRenderer.invoke('submit-token', token),
  startDeviceLogin: () => ipcRenderer.invoke('start-device-login'),
  cancelDeviceLogin: () => ipcRenderer.invoke('cancel-device-login'),
  watchClipboard: (watch: boolean) => ipcRenderer.invoke('watch-clipboard', watch),
  signOut: () => ipcRenderer.invoke('sign-out'),
  openGitHubUrl: (url: string) => ipcRenderer.invoke('open-github-url', url),

  // Settings
  getSettings: () => ipcRenderer.invoke('get-settings'),
  listRepos: (force = false) => ipcRenderer.invoke('list-repos', force),
  setWatchedRepos: (repos: string[]) => ipcRenderer.invoke('set-watched-repos', repos),
  setActorFilter: (filter: unknown) => ipcRenderer.invoke('set-actor-filter', filter),

  // Runs
  getRunningActions: () => ipcRenderer.invoke('get-running-actions'),
  dismissAction: (key: string) => ipcRenderer.invoke('dismiss-action', key),
  dismissAll: () => ipcRenderer.invoke('dismiss-all'),

  // Windows
  popupEmpty: () => ipcRenderer.invoke('popup-empty'),
  setPointerInteractive: (interactive: boolean) => ipcRenderer.invoke('set-pointer-interactive', interactive),
  resizeWindow: (width: number, height: number) => ipcRenderer.invoke('resize-window', width, height),

  // Events
  onActionsUpdate: (callback: (data: any[]) => void) => {
    ipcRenderer.on('actions-update', (_event, data) => callback(data));
  },
  onLoginComplete: (callback: (account: any) => void) => {
    ipcRenderer.on('login-complete', (_event, account) => callback(account));
  },
  onLoginError: (callback: (message: string) => void) => {
    ipcRenderer.on('login-error', (_event, message) => callback(message));
  },
  onClipboardToken: (callback: (token: string) => void) => {
    ipcRenderer.on('clipboard-token', (_event, token) => callback(token));
  },
});
