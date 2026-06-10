import { useEffect, useRef, useState, useCallback } from 'react';
import {
  openAuthenticatedWebSocket,
  type WebSocketConnectionStatus,
} from '../websocket/connection';

export interface UseWebSocketOptions {
  path: string;
  onMessage?: (message: unknown) => void;
  onConnect?: () => void;
  onDisconnect?: () => void;
  autoReconnect?: boolean;
  reconnectInterval?: number;
}

export const useWebSocket = ({
  path,
  onMessage,
  onConnect,
  onDisconnect,
  autoReconnect = true,
  reconnectInterval = 3000,
}: UseWebSocketOptions) => {
  const [isConnected, setIsConnected] = useState(false);
  const [connectionStatus, setConnectionStatus] =
    useState<WebSocketConnectionStatus>('disconnected');
  const ws = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<number | null>(null);
  const mountedRef = useRef(true);
  const onMessageRef = useRef(onMessage);
  const onConnectRef = useRef(onConnect);
  const onDisconnectRef = useRef(onDisconnect);
  const connectRef = useRef<(() => void) | null>(null);

  /* eslint-disable react-hooks/refs */
  onMessageRef.current = onMessage;
  onConnectRef.current = onConnect;
  onDisconnectRef.current = onDisconnect;
  /* eslint-enable react-hooks/refs */

  const connect = useCallback(() => {
    if (ws.current?.readyState === WebSocket.OPEN) {
      return;
    }

    setConnectionStatus('connecting');

    try {
      ws.current = openAuthenticatedWebSocket(path, {
        onOpen: () => {
          if (!mountedRef.current) return;
          setIsConnected(true);
          setConnectionStatus('connected');
          onConnectRef.current?.();
        },
        onMessage: (message) => {
          if (!mountedRef.current) return;
          onMessageRef.current?.(message);
        },
        onClose: () => {
          if (!mountedRef.current) return;
          setIsConnected(false);
          setConnectionStatus('disconnected');
          onDisconnectRef.current?.();

          if (autoReconnect && mountedRef.current) {
            reconnectTimeoutRef.current = setTimeout(() => {
              if (mountedRef.current) {
                connectRef.current?.();
              }
            }, reconnectInterval);
          }
        },
        onError: () => {
          if (!mountedRef.current) return;
          setConnectionStatus('error');
        },
      });
    } catch (error) {
      console.error('Failed to create WebSocket connection:', error);
      setConnectionStatus('error');
    }
  }, [path, autoReconnect, reconnectInterval]);

  // Update connectRef synchronously so reconnection timeout can call the latest connect function
  // eslint-disable-next-line react-hooks/refs
  connectRef.current = connect;

  const disconnect = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }

    if (ws.current) {
      ws.current.close();
      ws.current = null;
    }
  }, []);

  const sendMessage = useCallback((message: unknown) => {
    if (ws.current?.readyState === WebSocket.OPEN) {
      ws.current.send(JSON.stringify(message));
      return true;
    }
    console.warn('WebSocket not connected, cannot send message:', message);
    return false;
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    connect();

    return () => {
      mountedRef.current = false;
      disconnect();
    };
  }, [connect, disconnect]);

  return {
    isConnected,
    connectionStatus,
    sendMessage,
    reconnect: connect,
  };
};
