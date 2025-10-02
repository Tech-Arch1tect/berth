import { useState, useCallback, useRef, useEffect } from 'react';
import {
  OperationRequest,
  OperationResponse,
  OperationStatus,
  StreamMessage,
  WebSocketMessage,
} from '../types/operations';
import { useOperationsContext } from '../contexts/OperationsContext';
import { RunningOperation } from '../types/running-operation';

interface UseOperationsOptions {
  serverid: string;
  stackname: string;
  onOperationComplete?: (success: boolean, exitCode?: number) => void;
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
  const [error, setError] = useState<string | null>(null);
  const { addOperation } = useOperationsContext();

  const wsRef = useRef<WebSocket | null>(null);
  const reconnectAttempts = useRef(0);
  const maxReconnectAttempts = 3;
  const pendingOperationRef = useRef<OperationRequest | null>(null);

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
      setError(null);
      reconnectAttempts.current = 0;
    };

    ws.onmessage = (event) => {
      try {
        const parsedData = JSON.parse(event.data);

        if (parsedData.type === 'operation_started') {
          const wsMessage = parsedData as WebSocketMessage;
          const opResponse = wsMessage.data as OperationResponse;

          setOperationStatus((prev) => ({
            ...prev,
            operationId: opResponse.operationId,
          }));

          if (pendingOperationRef.current) {
            const runningOp: RunningOperation = {
              id: 0,
              user_id: 0,
              server_id: parseInt(serverid),
              stack_name: stackname,
              operation_id: opResponse.operationId,
              command: pendingOperationRef.current.command,
              start_time: new Date().toISOString(),
              last_message_at: new Date().toISOString(),
              user_name: '',
              server_name: '',
              is_incomplete: true,
              partial_duration: null,
              message_count: 0,
            };

            addOperation(runningOp);
            pendingOperationRef.current = null;
          }
          return;
        }

        const message = parsedData as StreamMessage;

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
  }, [serverid, stackname, operationStatus.isRunning, onOperationComplete, onError]);

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
