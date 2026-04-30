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
  const onMessageRef = useRef(onMessage);
  const onConnectRef = useRef(onConnect);
  const onDisconnectRef = useRef(onDisconnect);
  const connectRef = useRef<(() => void) | null>(null);

  // Moving to useEffect causes race conditions where events fire before refs are updated.
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
      ws.current = new WebSocket(url);

      ws.current.onopen = () => {
        if (!mountedRef.current) return;

        setIsConnected(true);
        setConnectionStatus('connected');
        onConnectRef.current?.();
      };

      ws.current.onmessage = (event) => {
        if (!mountedRef.current) return;

        try {
          const message: WebSocketMessage = JSON.parse(event.data);
          onMessageRef.current?.(message);
        } catch (error) {
          console.error('Failed to parse WebSocket message:', error);
        }
      };

      ws.current.onclose = () => {
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
  }, [url, autoReconnect, reconnectInterval]);

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

  const subscribe = useCallback(
    (resource: string, serverid: number, stackname?: string) => {
      const subscribeMessage: SubscribeMessage = {
        type: 'subscribe',
        resource,
        server_id: serverid,
      };

      if (stackname) {
        subscribeMessage.stack_name = stackname;
      }

      return sendMessage(subscribeMessage);
    },
    [sendMessage]
  );

  const unsubscribe = useCallback(
    (resource: string, serverid: number, stackname?: string) => {
      const unsubscribeMessage: UnsubscribeMessage = {
        type: 'unsubscribe',
        resource,
        server_id: serverid,
      };

      if (stackname) {
        unsubscribeMessage.stack_name = stackname;
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
