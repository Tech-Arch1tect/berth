import type { BaseWebSocketMessage } from './websocket';

export interface TerminalStartMessage {
  type: 'terminal_start';
  stack_name: string;
  service_name: string;
  container_name?: string;
  cols: number;
  rows: number;
}

export interface TerminalInputEvent extends BaseWebSocketMessage {
  type: 'terminal_input';
  session_id: string;
  input: Uint8Array;
  timestamp: string;
}

export interface TerminalOutputEvent extends BaseWebSocketMessage {
  type: 'terminal_output';
  session_id: string;
  output: Uint8Array;
  timestamp: string;
}

export interface TerminalResizeEvent extends BaseWebSocketMessage {
  type: 'terminal_resize';
  session_id: string;
  cols: number;
  rows: number;
  timestamp: string;
}

export interface TerminalCloseEvent extends BaseWebSocketMessage {
  type: 'terminal_close';
  session_id: string;
  exit_code: number;
  timestamp: string;
}

export interface TerminalSuccessEvent extends BaseWebSocketMessage {
  type: 'success';
  message: string;
  session_id: string;
  timestamp: string;
}

export interface UseTerminalOptions {
  serverid: number;
  stackname: string;
  serviceName: string;
  containerName?: string;
  enabled?: boolean;
  onOutput?: (data: Uint8Array) => void;
  onConnect?: (sessionId: string) => void;
  onDisconnect?: (exitCode?: number) => void;
  onError?: (error: string) => void;
}

export interface TerminalSession {
  id: string;
  isConnected: boolean;
  isConnecting: boolean;
  error?: string;
  serverid: number;
  stackname: string;
  serviceName: string;
  containerName?: string;
}

export type TerminalMessage =
  | TerminalStartMessage
  | TerminalInputEvent
  | TerminalOutputEvent
  | TerminalResizeEvent
  | TerminalCloseEvent
  | TerminalSuccessEvent;
