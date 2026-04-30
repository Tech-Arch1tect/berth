interface LogViewerContainer {
  name: string;
}

export interface LogViewerProps {
  containerName?: string;
  containers?: LogViewerContainer[];
  compact?: boolean;
}

export interface LogFilterOptions {
  tail: number;
  since: string;
  timestamps: boolean;
  search: string;
  level?: 'info' | 'warn' | 'error';
}
