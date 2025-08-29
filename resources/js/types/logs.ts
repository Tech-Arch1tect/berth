export interface LogEntry {
  timestamp: string;
  message: string;
  source: string;
  level?: 'info' | 'warn' | 'error';
}

export interface LogsResponse {
  logs: LogEntry[];
}

export interface LogViewerProps {
  serverid: number;
  stackname: string;
  serviceName?: string;
  containerName?: string;
  containers?: Container[];
}

export interface Container {
  name: string;
  service_name?: string;
  status?: string;
  image?: string;
}

export interface LogFilterOptions {
  tail: number;
  since: string;
  timestamps: boolean;
  search: string;
  level?: 'info' | 'warn' | 'error';
}
