import { useEffect, useRef, useState, useCallback } from 'react';
import { useWebSocket } from './useWebSocket';
import type { WebSocketMessage } from '../types/websocket';
import type {
  UseTerminalOptions,
  TerminalSession,
  TerminalStartMessage,
  TerminalOutputEvent,
  TerminalCloseEvent,
  TerminalSuccessEvent,
} from '../types/terminal';

const getWebSocketUrl = (serverId: number): string => {
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  const host = window.location.host;
  return `${protocol}//${host}/ws/ui/servers/${serverId}/terminal`;
};

export const useTerminal = ({
  serverId,
  stackName,
  serviceName,
  containerName,
  enabled = true,
  onOutput,
  onConnect,
  onDisconnect,
  onError,
}: UseTerminalOptions) => {
  const [session, setSession] = useState<TerminalSession>({
    id: '',
    isConnected: false,
    isConnecting: false,
    serverId,
    stackName,
    serviceName,
    containerName,
  });

  const sessionStartedRef = useRef(false);
  const terminalRef = useRef<{ cols: number; rows: number }>({ cols: 80, rows: 24 });

  const handleMessage = useCallback(
    (message: WebSocketMessage) => {
      switch (message.type) {
        case 'success': {
          const successEvent = message as unknown as TerminalSuccessEvent;
          if (successEvent.session_id) {
            setSession((prev) => ({
              ...prev,
              id: successEvent.session_id,
              isConnected: true,
              isConnecting: false,
              error: undefined,
            }));
            onConnect?.(successEvent.session_id);
          }
          break;
        }

        case 'terminal_output': {
          const outputEvent = message as unknown as TerminalOutputEvent;
          if (outputEvent.session_id === session.id) {
            let outputData: Uint8Array;
            if (typeof outputEvent.output === 'string') {
              const base64String = outputEvent.output;
              const binaryString = atob(base64String);
              const bytes = new Uint8Array(binaryString.length);
              for (let i = 0; i < binaryString.length; i++) {
                bytes[i] = binaryString.charCodeAt(i);
              }
              outputData = bytes;
            } else {
              outputData = new Uint8Array(outputEvent.output);
            }

            onOutput?.(outputData);
          }
          break;
        }

        case 'terminal_close': {
          const closeEvent = message as unknown as TerminalCloseEvent;
          if (closeEvent.session_id === session.id) {
            setSession((prev) => ({
              ...prev,
              isConnected: false,
              isConnecting: false,
            }));
            onDisconnect?.(closeEvent.exit_code);
          }
          break;
        }

        case 'error': {
          const errorMessage: string = (message.error as string) || 'Unknown terminal error';
          setSession(
            (prev) =>
              ({
                ...prev,
                isConnected: false,
                isConnecting: false,
                error: errorMessage,
              }) as TerminalSession
          );
          if (onError) {
            onError(errorMessage);
          }
          break;
        }
      }
    },
    [session.id, onOutput, onConnect, onDisconnect, onError]
  );

  const handleConnect = useCallback(() => {
    setSession((prev) => ({ ...prev, error: undefined }));
    sessionStartedRef.current = false;
  }, []);

  const handleDisconnect = useCallback(() => {
    setSession((prev) => ({
      ...prev,
      id: '',
      isConnected: false,
      isConnecting: false,
    }));
    sessionStartedRef.current = false;
    onDisconnect?.();
  }, [onDisconnect]);

  const {
    isConnected: wsConnected,
    sendMessage,
    connectionStatus,
  } = useWebSocket({
    url: getWebSocketUrl(serverId),
    onMessage: handleMessage,
    onConnect: handleConnect,
    onDisconnect: handleDisconnect,
    autoReconnect: enabled,
  });

  const startTerminal = useCallback(
    (cols: number = 80, rows: number = 24) => {
      if (!wsConnected || session.isConnecting || session.isConnected) {
        return;
      }

      terminalRef.current = { cols, rows };

      const startMessage: TerminalStartMessage = {
        type: 'terminal_start',
        stack_name: stackName,
        service_name: serviceName,
        container_name: containerName,
        cols,
        rows,
      };

      const success = sendMessage(startMessage);
      if (success) {
        setSession((prev) => ({ ...prev, isConnecting: true }));
      }
    },
    [
      wsConnected,
      session.isConnecting,
      session.isConnected,
      stackName,
      serviceName,
      containerName,
      sendMessage,
    ]
  );

  const sendInput = useCallback(
    (input: string | Uint8Array) => {
      if (!session.isConnected || !session.id) {
        return false;
      }

      const inputData = typeof input === 'string' ? new TextEncoder().encode(input) : input;
      const inputArray = Array.from(inputData);

      const inputMessage = {
        type: 'terminal_input',
        timestamp: new Date().toISOString(),
        session_id: session.id,
        input: inputArray,
      };

      return sendMessage(inputMessage);
    },
    [session.isConnected, session.id, sendMessage]
  );

  const resizeTerminal = useCallback(
    (cols: number, rows: number) => {
      if (!session.isConnected || !session.id) {
        return false;
      }

      terminalRef.current = { cols, rows };

      const resizeMessage = {
        type: 'terminal_resize',
        timestamp: new Date().toISOString(),
        session_id: session.id,
        cols,
        rows,
      };

      return sendMessage(resizeMessage);
    },
    [session.isConnected, session.id, sendMessage]
  );

  const closeTerminal = useCallback(() => {
    if (!session.id) {
      return;
    }

    const closeMessage = {
      type: 'terminal_close',
      timestamp: new Date().toISOString(),
      session_id: session.id,
      exit_code: 0,
    };

    const messageSent = sendMessage(closeMessage);
    if (!messageSent) {
      onDisconnect?.(0);
    }
  }, [session.id, sendMessage, onDisconnect]);

  useEffect(() => {
    if (enabled && wsConnected && !session.isConnecting && !session.isConnected && !session.error) {
      const timer = setTimeout(() => {
        startTerminal(terminalRef.current.cols, terminalRef.current.rows);
      }, 100);

      return () => clearTimeout(timer);
    }
  }, [
    enabled,
    wsConnected,
    session.isConnecting,
    session.isConnected,
    session.error,
    startTerminal,
  ]);

  return {
    session,
    connectionStatus,
    sendInput,
    resizeTerminal,
    closeTerminal,
  };
};
