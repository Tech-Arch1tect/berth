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

  const sessionIdRef = useRef('');
  const sessionActiveRef = useRef(false);
  const sessionEndedRef = useRef(false);
  const errorReportedRef = useRef(false);
  const deliberateCloseRef = useRef(false);
  const terminalRef = useRef<{ cols: number; rows: number }>({ cols: 80, rows: 24 });

  const handleMessage = useCallback(
    (raw: unknown) => {
      const message = raw as { type?: string };
      switch (message.type) {
        case 'success': {
          const successEvent = message as TerminalSuccessMessage;
          if (successEvent.session_id && !sessionEndedRef.current && !deliberateCloseRef.current) {
            sessionIdRef.current = successEvent.session_id;
            sessionActiveRef.current = true;
            errorReportedRef.current = false;
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
          if (
            outputEvent.session_id === sessionIdRef.current &&
            !sessionEndedRef.current &&
            !deliberateCloseRef.current
          ) {
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
          if (
            closeEvent.session_id === sessionIdRef.current &&
            !sessionEndedRef.current &&
            !deliberateCloseRef.current
          ) {
            sessionActiveRef.current = false;
            sessionEndedRef.current = true;
            setSession((prev) => ({
              ...prev,
              isConnected: false,
              isConnecting: false,
            }));
            onDisconnect?.(
              typeof closeEvent.exit_code === 'number' ? closeEvent.exit_code : undefined
            );
          }
          break;
        }

        case 'error': {
          if (sessionEndedRef.current || deliberateCloseRef.current) break;
          const errorMessage = (message as TerminalErrorMessage).error || 'Unknown terminal error';
          errorReportedRef.current = true;
          if (!sessionActiveRef.current) {
            setSession((prev) => ({
              ...prev,
              isConnected: false,
              isConnecting: false,
              error: errorMessage,
            }));
          }
          onError?.(errorMessage);
          break;
        }
      }
    },
    [onOutput, onConnect, onDisconnect, onError]
  );

  const handleConnect = useCallback(() => {
    setSession((prev) => ({ ...prev, error: undefined }));
    sessionIdRef.current = '';
    sessionActiveRef.current = false;
    sessionEndedRef.current = false;
    errorReportedRef.current = false;
    deliberateCloseRef.current = false;
  }, []);

  const handleDisconnect = useCallback(() => {
    const notify =
      !sessionEndedRef.current &&
      !deliberateCloseRef.current &&
      (sessionActiveRef.current || !errorReportedRef.current);
    sessionIdRef.current = '';
    sessionActiveRef.current = false;
    sessionEndedRef.current = true;
    setSession((prev) => ({
      ...prev,
      id: '',
      isConnected: false,
      isConnecting: false,
    }));
    if (notify) onDisconnect?.();
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
      if (
        !wsConnected ||
        session.isConnecting ||
        sessionActiveRef.current ||
        sessionEndedRef.current ||
        deliberateCloseRef.current
      ) {
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
    [wsConnected, session.isConnecting, serviceName, containerName, sendMessage]
  );

  const sendInput = useCallback(
    (input: string | Uint8Array) => {
      if (!sessionActiveRef.current || !sessionIdRef.current) {
        return false;
      }

      const inputData = typeof input === 'string' ? new TextEncoder().encode(input) : input;

      const inputMessage: TerminalInputMessage = {
        type: 'terminal_input',
        timestamp: new Date().toISOString(),
        session_id: sessionIdRef.current,
        input: Array.from(inputData),
      };

      return sendMessage(inputMessage);
    },
    [sendMessage]
  );

  const resizeTerminal = useCallback(
    (cols: number, rows: number) => {
      if (!sessionActiveRef.current || !sessionIdRef.current) {
        return false;
      }

      terminalRef.current = { cols, rows };

      const resizeMessage: TerminalResizeMessage = {
        type: 'terminal_resize',
        timestamp: new Date().toISOString(),
        session_id: sessionIdRef.current,
        cols,
        rows,
      };

      return sendMessage(resizeMessage);
    },
    [sendMessage]
  );

  const closeTerminal = useCallback(() => {
    if (!sessionActiveRef.current || !sessionIdRef.current) {
      return;
    }
    deliberateCloseRef.current = true;

    const closeMessage: TerminalCloseMessage = {
      type: 'terminal_close',
      timestamp: new Date().toISOString(),
      session_id: sessionIdRef.current,
    };

    try {
      sendMessage(closeMessage);
    } catch {
      return;
    }
  }, [sendMessage]);

  useEffect(() => {
    if (
      enabled &&
      wsConnected &&
      !session.isConnecting &&
      !session.isConnected &&
      !session.error &&
      !sessionEndedRef.current
    ) {
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
