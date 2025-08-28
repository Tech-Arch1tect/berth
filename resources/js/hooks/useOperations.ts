import { useState, useCallback, useRef, useEffect } from 'react';
import {
  OperationRequest,
  OperationStatus,
  StreamMessage,
  WebSocketMessage,
} from '../types/operations';

interface UseOperationsOptions {
  serverId: string;
  stackName: string;
  onOperationComplete?: (success: boolean, exitCode?: number) => void;
  onError?: (error: string) => void;
}

export const useOperations = ({
  serverId,
  stackName,
  onOperationComplete,
  onError,
}: UseOperationsOptions) => {
  const [operationStatus, setOperationStatus] = useState<OperationStatus>({
    isRunning: false,
    logs: [],
  });
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const wsRef = useRef<WebSocket | null>(null);
  const reconnectAttempts = useRef(0);
  const maxReconnectAttempts = 3;

  const connect = useCallback(() => {
    if (wsRef.current && wsRef.current.readyState !== WebSocket.OPEN) {
      wsRef.current.close();
      wsRef.current = null;
    }

    if (wsRef.current?.readyState === WebSocket.OPEN) {
      return;
    }

    setIsConnecting(true);
    setError(null);

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/ws/ui/servers/${serverId}/stacks/${encodeURIComponent(stackName)}/operations`;

    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      setIsConnecting(false);
      setError(null);
      reconnectAttempts.current = 0;
    };

    ws.onmessage = (event) => {
      try {
        const message: StreamMessage = JSON.parse(event.data);

        setOperationStatus((prev) => ({
          ...prev,
          logs: [...prev.logs, message],
        }));

        if (message.type === 'complete') {
          setOperationStatus((prev) => ({
            ...prev,
            isRunning: false,
          }));

          if (onOperationComplete) {
            onOperationComplete(message.success || false, message.exitCode);
          }
        }
      } catch (err) {
        console.error('Failed to parse WebSocket message:', err);
      }
    };

    ws.onclose = (_event) => {
      setIsConnecting(false);

      if (operationStatus.isRunning && reconnectAttempts.current < maxReconnectAttempts) {
        setTimeout(() => {
          reconnectAttempts.current++;
          connect();
        }, 1000 * reconnectAttempts.current);
      } else {
        setOperationStatus((prev) => ({
          ...prev,
          isRunning: false,
        }));
      }
    };

    ws.onerror = (_event) => {
      const errorMsg = 'WebSocket connection failed';
      setError(errorMsg);
      setIsConnecting(false);

      if (onError) {
        onError(errorMsg);
      }
    };
  }, [serverId, stackName, operationStatus.isRunning, onOperationComplete, onError]);

  const disconnect = useCallback(() => {
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
    setIsConnecting(false);
  }, []);

  const startOperation = useCallback(
    async (operation: OperationRequest) => {
      if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
        connect();

        await new Promise((resolve) => setTimeout(resolve, 1000));
      }

      if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
        throw new Error('WebSocket connection not available');
      }

      setOperationStatus({
        isRunning: true,
        operationId: undefined,
        command: operation.command,
        startTime: new Date(),
        logs: [],
      });

      const message: WebSocketMessage = {
        type: 'operation_request',
        data: operation,
      };

      wsRef.current.send(JSON.stringify(message));
    },
    [connect]
  );

  const clearLogs = useCallback(() => {
    setOperationStatus((prev) => ({
      ...prev,
      logs: [],
    }));
  }, []);

  useEffect(() => {
    return () => {
      disconnect();
    };
  }, [disconnect]);

  const isConnected = wsRef.current?.readyState === WebSocket.OPEN;

  return {
    operationStatus,
    isConnecting,
    error,
    startOperation,
    clearLogs,
    connect,
    disconnect,
    isConnected,
  };
};
