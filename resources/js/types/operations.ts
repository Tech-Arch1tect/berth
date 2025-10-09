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

export interface OperationLog {
  id: number;
  user_id: number;
  server_id: number;
  stack_name: string;
  operation_id: string;
  command: string;
  options: string;
  services: string;
  start_time: string;
  end_time: string | null;
  success: boolean | null;
  exit_code: number | null;
  duration_ms: number | null;
  created_at: string;
  updated_at: string;
  user_name: string;
  server_name: string;
  trigger_source: string;
  is_incomplete: boolean;
  formatted_date: string;
  message_count: number;
  partial_duration_ms: number | null;
}

export interface PaginationInfo {
  current_page: number;
  page_size: number;
  total: number;
  total_pages: number;
  has_next: boolean;
  has_prev: boolean;
}

export interface OperationLogStatsSummary {
  total_operations: number;
  incomplete_operations: number;
  failed_operations: number;
  successful_operations: number;
  recent_operations: number;
}

export interface OperationLogMessage {
  id: number;
  operation_log_id: number;
  message_type: string;
  message_data: string;
  timestamp: string;
  sequence_number: number;
  created_at: string;
  updated_at: string;
}

export interface OperationLogDetail {
  log: OperationLog;
  messages: OperationLogMessage[];
}
