export interface BaseWebSocketMessage {
  type: string;
  timestamp: string;
}

export interface WebSocketMessage extends BaseWebSocketMessage {
  [key: string]: unknown;
}

export interface SubscribeMessage {
  type: 'subscribe';
  resource: string;
  server_id: number;
  stack_name?: string;
}

export interface UnsubscribeMessage {
  type: 'unsubscribe';
  resource: string;
  server_id: number;
  stack_name?: string;
}

export interface ContainerStatusEvent extends BaseWebSocketMessage {
  type: 'container_status';
  server_id: number;
  stack_name: string;
  service_name: string;
  container_name: string;
  container_id: string;
  status: string;
  health?: string;
  image: string;
  ports?: Array<{
    private: number;
    public?: number;
    type: string;
  }>;
}

export interface StackStatusEvent extends BaseWebSocketMessage {
  type: 'stack_status';
  server_id: number;
  stack_name: string;
  status: string;
  services: number;
  running: number;
  stopped: number;
}

export interface OperationProgressEvent extends BaseWebSocketMessage {
  type: 'operation_progress';
  server_id: number;
  stack_name?: string;
  operation: string;
  progress: number;
  message: string;
}

export interface SuccessEvent extends BaseWebSocketMessage {
  type: 'success';
  message: string;
  context?: string;
}

export interface ErrorEvent extends BaseWebSocketMessage {
  type: 'error';
  error: string;
  context?: string;
}

export interface UseWebSocketOptions {
  url: string;
  onMessage?: (message: WebSocketMessage) => void;
  onConnect?: () => void;
  onDisconnect?: () => void;
  autoReconnect?: boolean;
  reconnectInterval?: number;
}

export interface UseStackWebSocketOptions {
  serverid: number;
  stackname: string;
  enabled?: boolean;
}

export type WebSocketConnectionStatus = 'connecting' | 'connected' | 'disconnected' | 'error';

export interface TerminalInputEvent extends BaseWebSocketMessage {
  type: 'terminal_input';
  session_id: string;
  input: Uint8Array;
}

export interface TerminalOutputEvent extends BaseWebSocketMessage {
  type: 'terminal_output';
  session_id: string;
  output: Uint8Array;
}

export interface TerminalResizeEvent extends BaseWebSocketMessage {
  type: 'terminal_resize';
  session_id: string;
  cols: number;
  rows: number;
}

export interface TerminalCloseEvent extends BaseWebSocketMessage {
  type: 'terminal_close';
  session_id: string;
  exit_code: number;
}
