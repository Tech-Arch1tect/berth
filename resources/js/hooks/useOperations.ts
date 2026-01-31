import { useState, useCallback, useRef, useEffect } from 'react';
import {
  OperationRequest,
  OperationResponse,
  OperationStatus,
  StreamMessage,
  WebSocketMessage,
} from '../types/operations';
import { useOperationsContext, NewOperationInput } from '../contexts/OperationsContext';
import { getApiV1OperationLogsByOperationIdOperationId } from '../api/generated/operation-logs/operation-logs';

interface UseOperationsOptions {
  serverid: string;
  stackname: string;
  onOperationComplete?: (success: boolean, exitCode?: number, summary?: string) => void;
  onError?: (error: string) => void;
}

export const useOperations = ({
  serverid,
  stackname,
  onOperationComplete,
  onError,
}: UseOperationsOptions) => {
  const [operationStatus, setOperationStatus] = useState<OperationStatus>({
    isRunning: false,
    logs: [],
  });
  const [isConnecting, setIsConnecting] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { addOperation, addOperationLog } = useOperationsContext();

  const wsRef = useRef<WebSocket | null>(null);
  const reconnectAttempts = useRef(0);
  const maxReconnectAttempts = 3;
  const pendingOperationRef = useRef<OperationRequest | null>(null);
  const currentOperationIdRef = useRef<string | undefined>(undefined);
  const connectRef = useRef<() => void>(() => {});

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
    const wsUrl = `${protocol}//${window.location.host}/ws/ui/servers/${serverid}/stacks/${encodeURIComponent(stackname)}/operations`;

    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      setIsConnecting(false);
      setIsConnected(true);
      setError(null);
      reconnectAttempts.current = 0;
    };

    ws.onmessage = (event) => {
      try {
        const parsedData = JSON.parse(event.data);

        if (parsedData.type === 'operation_started') {
          const wsMessage = parsedData as WebSocketMessage;
          const opResponse = wsMessage.data as OperationResponse;

          currentOperationIdRef.current = opResponse.operationId;

          setOperationStatus((prev) => ({
            ...prev,
            operationId: opResponse.operationId,
          }));

          if (pendingOperationRef.current) {
            const newOp: NewOperationInput = {
              server_id: parseInt(serverid),
              stack_name: stackname,
              operation_id: opResponse.operationId,
              command: pendingOperationRef.current.command,
              is_incomplete: true,
              skipWebSocket: true,
            };

            addOperation(newOp);
            pendingOperationRef.current = null;
          }
          return;
        }

        if (parsedData.type === 'error') {
          const errorMsg = parsedData.data?.error || parsedData.error || 'Operation failed';

          setOperationStatus((prev) => ({
            ...prev,
            isRunning: false,
          }));

          pendingOperationRef.current = null;

          if (onError) {
            onError(errorMsg);
          }
          return;
        }

        const message = parsedData as StreamMessage;

        setOperationStatus((prev) => ({
          ...prev,
          logs: [...prev.logs, message],
        }));

        if (currentOperationIdRef.current) {
          addOperationLog(currentOperationIdRef.current, message);
        }

        if (message.type === 'complete') {
          setOperationStatus((prev) => ({
            ...prev,
            isRunning: false,
          }));

          if (onOperationComplete && currentOperationIdRef.current) {
            getApiV1OperationLogsByOperationIdOperationId(currentOperationIdRef.current)
              .then((response) => {
                onOperationComplete(
                  message.success || false,
                  message.exitCode,
                  response.data?.data?.log?.summary || undefined
                );
              })
              .catch(() => {
                onOperationComplete(message.success || false, message.exitCode);
              });
          } else if (onOperationComplete) {
            onOperationComplete(message.success || false, message.exitCode);
          }
        }
      } catch (err) {
        console.error('Failed to parse WebSocket message:', err);
      }
    };

    ws.onclose = (_event) => {
      setIsConnecting(false);
      setIsConnected(false);

      if (operationStatus.isRunning && reconnectAttempts.current < maxReconnectAttempts) {
        setTimeout(() => {
          reconnectAttempts.current++;
          connectRef.current();
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
  }, [
    serverid,
    stackname,
    operationStatus.isRunning,
    onOperationComplete,
    onError,
    addOperation,
    addOperationLog,
  ]);

  useEffect(() => {
    connectRef.current = connect;
  });

  const disconnect = useCallback(() => {
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
    currentOperationIdRef.current = undefined;
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

      pendingOperationRef.current = operation;

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
