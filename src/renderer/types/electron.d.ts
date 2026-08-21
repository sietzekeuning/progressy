export type ActionState =
  | 'queued'
  | 'running'
  | 'success'
  | 'failure'
  | 'cancelled'
  | 'timed_out'
  | 'skipped'
  | 'action_required'
  | 'neutral';

export interface RunningAction {
  key: string;
  repo: string;
  runId: number;
  name: string;
  branch: string | null;
  event: string | null;
  status: 'queued' | 'in_progress' | 'completed';
  conclusion: string | null;
  state: ActionState;
  startedAt: string;
  startedAtMs: number;
  completedAtMs: number | null;
  durationMs: number | null;
  expectedDurationMs: number | null;
  currentJob: string | null;
  currentStep: string | null;
  jobsTotal: number;
  jobsCompleted: number;
  url: string;
  lingerMs: number;
}

export interface ElectronAPI {
  getGitHubToken: () => Promise<string | undefined>;
  setGitHubToken: (token: string) => Promise<boolean>;
  getRunningActions: () => Promise<RunningAction[]>;
  dismissAction: (key: string) => Promise<boolean>;
  closePopup: () => Promise<boolean>;
  popupEmpty: () => Promise<boolean>;
  setPointerInteractive: (interactive: boolean) => Promise<boolean>;
  setGitHubOAuthCredentials: (clientId: string, clientSecret: string) => Promise<boolean>;
  getGitHubOAuthCredentials: () => Promise<{ clientId: string; hasClientSecret: boolean }>;
  resizeWindow: (width: number, height: number) => Promise<boolean>;
  onActionsUpdate: (callback: (data: RunningAction[]) => void) => void;
  onOAuthError: (callback: (message: string) => void) => void;
}

declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}
