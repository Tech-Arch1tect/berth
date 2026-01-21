export interface OperationRequest {
  command:
    | 'up'
    | 'down'
    | 'start'
    | 'stop'
    | 'restart'
    | 'pull'
    | 'create-archive'
    | 'extract-archive';
  options: string[];
  services: string[];
}

export interface DockerOperationRequest {
  command: 'up' | 'down' | 'start' | 'stop' | 'restart' | 'pull';
  options: string[];
  services: string[];
}

export interface OperationResponse {
  operationId: string;
}

export interface StreamMessage {
  type: 'stdout' | 'stderr' | 'progress' | 'complete' | 'error';
  data?: string;
  timestamp: string;
  success?: boolean;
  exitCode?: number;
}

export interface WebSocketMessage {
  type: 'operation_request' | 'operation_started' | 'stream_data' | 'error' | 'complete';
  data?: unknown;
  error?: string;
  message?: string;
}

export interface OperationPreset {
  id: string;
  name: string;
  description: string;
  command: OperationRequest['command'];
  options: string[];
  icon?: string;
  variant?: 'primary' | 'secondary' | 'success' | 'warning' | 'danger';
}

export interface OperationStatus {
  isRunning: boolean;
  operationId?: string;
  command?: string;
  startTime?: Date;
  logs: StreamMessage[];
}
