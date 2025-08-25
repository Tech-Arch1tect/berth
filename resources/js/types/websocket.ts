export interface BaseWebSocketMessage {
  type: string;
  timestamp: string;
}

export interface WebSocketMessage extends BaseWebSocketMessage {
  [key: string]: any;
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

export interface LogStreamEvent extends BaseWebSocketMessage {
  type: 'log_stream';
  server_id: number;
  stack_name: string;
  service_name: string;
  container_name: string;
  log_line: string;
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
  serverId: number;
  stackName: string;
  enabled?: boolean;
}

export type WebSocketConnectionStatus = 'connecting' | 'connected' | 'disconnected' | 'error';
