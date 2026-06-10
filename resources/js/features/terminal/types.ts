import type {
  TerminalStartMessage,
  TerminalInputMessage,
  TerminalResizeMessage,
  TerminalCloseMessage,
  TerminalOutputMessage,
  TerminalSuccessMessage,
  TerminalErrorMessage,
} from '../../api/generated/models';

export type {
  TerminalStartMessage,
  TerminalInputMessage,
  TerminalResizeMessage,
  TerminalCloseMessage,
  TerminalOutputMessage,
  TerminalSuccessMessage,
  TerminalErrorMessage,
};

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
