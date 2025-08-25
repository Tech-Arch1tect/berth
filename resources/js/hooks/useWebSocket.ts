import { useEffect, useRef, useState, useCallback } from 'react';
import type {
  WebSocketMessage,
  SubscribeMessage,
  UnsubscribeMessage,
  UseWebSocketOptions,
  WebSocketConnectionStatus,
} from '../types/websocket';

export const useWebSocket = ({
  url,
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

  const connect = useCallback(() => {
    if (ws.current?.readyState === WebSocket.OPEN) {
      return;
    }

    setConnectionStatus('connecting');

    try {
      ws.current = new WebSocket(url);

      ws.current.onopen = () => {
        if (!mountedRef.current) return;

        setIsConnected(true);
        setConnectionStatus('connected');
        onConnect?.();
      };

      ws.current.onmessage = (event) => {
        if (!mountedRef.current) return;

        try {
          const message: WebSocketMessage = JSON.parse(event.data);
          onMessage?.(message);
        } catch (error) {
          console.error('Failed to parse WebSocket message:', error);
        }
      };

      ws.current.onclose = () => {
        if (!mountedRef.current) return;

        setIsConnected(false);
        setConnectionStatus('disconnected');
        onDisconnect?.();

        if (autoReconnect && mountedRef.current) {
          reconnectTimeoutRef.current = setTimeout(() => {
            if (mountedRef.current) {
              connect();
            }
          }, reconnectInterval);
        }
      };

      ws.current.onerror = (error) => {
        if (!mountedRef.current) return;

        setConnectionStatus('error');
        console.error('WebSocket error:', error);
      };
    } catch (error) {
      console.error('Failed to create WebSocket connection:', error);
      setConnectionStatus('error');
    }
  }, [url, onMessage, onConnect, onDisconnect, autoReconnect, reconnectInterval]);

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

  const sendMessage = useCallback((message: any) => {
    if (ws.current?.readyState === WebSocket.OPEN) {
      ws.current.send(JSON.stringify(message));
      return true;
    }
    console.warn('WebSocket not connected, cannot send message:', message);
    return false;
  }, []);

  const subscribe = useCallback(
    (resource: string, serverId: number, stackName?: string) => {
      const subscribeMessage: SubscribeMessage = {
        type: 'subscribe',
        resource,
        server_id: serverId,
      };

      if (stackName) {
        subscribeMessage.stack_name = stackName;
      }

      return sendMessage(subscribeMessage);
    },
    [sendMessage]
  );

  const unsubscribe = useCallback(
    (resource: string, serverId: number, stackName?: string) => {
      const unsubscribeMessage: UnsubscribeMessage = {
        type: 'unsubscribe',
        resource,
        server_id: serverId,
      };

      if (stackName) {
        unsubscribeMessage.stack_name = stackName;
      }

      return sendMessage(unsubscribeMessage);
    },
    [sendMessage]
  );

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
    subscribe,
    unsubscribe,
    reconnect: connect,
  };
};
