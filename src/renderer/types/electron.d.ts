export interface ElectronAPI {
  getGitHubToken: () => Promise<string | undefined>;
  setGitHubToken: (token: string) => Promise<boolean>;
  getRunningActions: () => Promise<any[]>;
  closePopup: () => Promise<boolean>;
  setGitHubOAuthCredentials: (clientId: string, clientSecret: string) => Promise<boolean>;
  getGitHubOAuthCredentials: () => Promise<{ clientId: string; hasClientSecret: boolean }>;
  onActionStarted: (callback: (data: any) => void) => void;
  onActionUpdate: (callback: (data: any) => void) => void;
  onActionsUpdate: (callback: (data: any[]) => void) => void;
  onOAuthError: (callback: (message: string) => void) => void;
}

declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}
