export interface ServerWithAgentStack {
  serverId: number;
  serverName: string;
  serverHost: string;
  hasAgentStack: boolean;
  currentImages?: {
    'berth-agent'?: string;
    'berth-updater'?: string;
    'berth-socket-proxy'?: string;
    'berth-grype-scanner'?: string;
  };
}

export type UpdateStatus =
  | 'pending'
  | 'updating_image'
  | 'pulling'
  | 'restarting'
  | 'health_check'
  | 'success'
  | 'failed'
  | 'skipped';

export interface AgentUpdateProgress {
  serverId: number;
  serverName: string;
  status: UpdateStatus;
  message?: string;
}
