import { useEffect, useRef, useState, useCallback } from 'react';
import { useWebSocket } from '../../../shared/hooks/useWebSocket';
import type {
  UseTerminalOptions,
  TerminalSession,
  TerminalStartMessage,
  TerminalInputMessage,
  TerminalResizeMessage,
  TerminalCloseMessage,
  TerminalOutputMessage,
  TerminalSuccessMessage,
  TerminalErrorMessage,
} from '../types';

export const useTerminal = ({
  serverid,
  stackname,
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
    serverid,
    stackname,
    serviceName,
    containerName,
  });

  const sessionStartedRef = useRef(false);
  const terminalRef = useRef<{ cols: number; rows: number }>({ cols: 80, rows: 24 });

  const handleMessage = useCallback(
    (raw: unknown) => {
      const message = raw as { type?: string };
      switch (message.type) {
        case 'success': {
          const successEvent = message as TerminalSuccessMessage;
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
          const outputEvent = message as TerminalOutputMessage;
          if (outputEvent.session_id === session.id) {
            const binaryString = atob(outputEvent.output);
            const bytes = new Uint8Array(binaryString.length);
            for (let i = 0; i < binaryString.length; i++) {
              bytes[i] = binaryString.charCodeAt(i);
            }
            onOutput?.(bytes);
          }
          break;
        }

        case 'terminal_close': {
          const closeEvent = message as TerminalCloseMessage;
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
          const errorMessage = (message as TerminalErrorMessage).error || 'Unknown terminal error';
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
    path: `/ws/api/servers/${serverid}/stacks/${encodeURIComponent(stackname)}/terminal`,
    onMessage: handleMessage,
    onConnect: handleConnect,
    onDisconnect: handleDisconnect,
    autoReconnect: false,
  });

  const startTerminal = useCallback(
    (cols: number = 80, rows: number = 24) => {
      if (!wsConnected || session.isConnecting || session.isConnected) {
        return;
      }

      terminalRef.current = { cols, rows };

      const startMessage: TerminalStartMessage = {
        type: 'terminal_start',
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

      const inputMessage: TerminalInputMessage = {
        type: 'terminal_input',
        timestamp: new Date().toISOString(),
        session_id: session.id,
        input: Array.from(inputData),
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

      const resizeMessage: TerminalResizeMessage = {
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

    const closeMessage: TerminalCloseMessage = {
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
