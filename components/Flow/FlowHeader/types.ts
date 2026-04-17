export interface LiveSession {
  flowId: string | undefined;
  liveId: string;
  shareToken: string;
  useOwnerKeys: boolean;
}

export interface FlowHeaderProps {
  // Sidebar state
  autopilotOpen: boolean;
  autopilotWidth: number;
  responsesOpen: boolean;
  responsesWidth: number;
  isResizing: boolean;

  // Toggle callbacks
  onAutopilotToggle: () => void;
  onResponsesToggle: () => void;
  onSettingsOpen: () => void;

  // Published-flow state (null when the current flow has not been published)
  liveSession: LiveSession | null;

  // Flow state
  showLabels: boolean;
  showSettingsWarning: boolean;

  // Share dialog state
  shareDialogOpen: boolean;
  onShareDialogChange: (open: boolean) => void;

  // Flow operations
  isAuthenticated: boolean;
  onSaveFlow: () => void;
  onNewFlow: () => void;
  onOpenTemplates: () => void;
  onOpenMyFlows: () => void;
  onOpenFlow: () => void;
  onDownload: () => void;

  // Published flow callbacks
  onOwnerKeysChange?: (enabled: boolean) => void;

  // Logo state
  isPanning: boolean;
  canvasWidth: number;

  // Updates state
  hasUnseenUpdates: boolean;
  onUpdatesOpen: () => void;
}

export interface LeftControlsProps {
  autopilotOpen: boolean;
  onAutopilotToggle: () => void;
  showLabels: boolean;

  // Flow dropdown
  isAuthenticated: boolean;
  onSaveFlow: () => void;
  onNewFlow: () => void;
  onOpenTemplates: () => void;
  onOpenMyFlows: () => void;
  onOpenFlow: () => void;
  onDownload: () => void;

  // Share button
  liveSession: LiveSession | null;
  onShareDialogChange: (open: boolean) => void;
}

export interface RightControlsProps {
  responsesOpen: boolean;
  onResponsesToggle: () => void;
  showLabels: boolean;
  showSettingsWarning: boolean;
  onSettingsOpen: () => void;
  hasUnseenUpdates: boolean;
  onUpdatesOpen: () => void;
}
