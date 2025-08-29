import { useEffect, useCallback, useRef } from 'react';
import { useWebSocket } from './useWebSocket';
import { useQueryClient } from '@tanstack/react-query';
import type {
  ContainerStatusEvent,
  StackStatusEvent,
  UseStackWebSocketOptions,
  WebSocketMessage,
} from '../types/websocket';

export const useStackWebSocket = ({
  serverid,
  stackname,
  enabled = true,
}: UseStackWebSocketOptions) => {
  const queryClient = useQueryClient();
  const subscriptionsRef = useRef<Set<string>>(new Set());
  const invalidationTimeoutRef = useRef<number | null>(null);

  const debouncedInvalidateQueries = useCallback(() => {
    if (invalidationTimeoutRef.current) {
      clearTimeout(invalidationTimeoutRef.current);
    }

    invalidationTimeoutRef.current = setTimeout(() => {
      queryClient.invalidateQueries({
        queryKey: ['stackDetails', serverid, stackname],
      });

      queryClient.invalidateQueries({
        queryKey: ['serverStacks', serverid],
      });

      invalidationTimeoutRef.current = null;
    }, 300);
  }, [queryClient, serverid, stackname]);

  const handleMessage = useCallback(
    (message: WebSocketMessage) => {
      switch (message.type) {
        case 'container_status': {
          const event = message as unknown as ContainerStatusEvent;

          if (event.server_id === serverid && event.stack_name === stackname) {
            debouncedInvalidateQueries();
          }
          break;
        }

        case 'stack_status': {
          const event = message as unknown as StackStatusEvent;

          if (event.server_id === serverid && event.stack_name === stackname) {
            debouncedInvalidateQueries();
          }
          break;
        }

        case 'success': {
          break;
        }

        case 'error': {
          const event = message as {
            type: 'error';
            error: string;
            context?: string;
            timestamp: string;
          };
          console.error('WebSocket error:', event.error);
          break;
        }
      }
    },
    [serverid, stackname, debouncedInvalidateQueries]
  );

  const handleConnect = useCallback(() => {}, []);

  const handleDisconnect = useCallback(() => {}, []);

  const { isConnected, connectionStatus, subscribe, unsubscribe } = useWebSocket({
    url: `/ws/ui/stack-status/${serverid}`,
    onMessage: handleMessage,
    onConnect: handleConnect,
    onDisconnect: handleDisconnect,
    autoReconnect: true,
    reconnectInterval: 3000,
  });

  useEffect(() => {
    if (!enabled || !isConnected) {
      return;
    }

    const subscriptionKey = `stack_status:${serverid}:${stackname}`;
    const subscriptions = subscriptionsRef.current;

    if (!subscriptions.has(subscriptionKey)) {
      if (subscribe('stack_status', serverid, stackname)) {
        subscriptions.add(subscriptionKey);
      }
    }

    return () => {
      if (subscriptions.has(subscriptionKey)) {
        unsubscribe('stack_status', serverid, stackname);
        subscriptions.delete(subscriptionKey);
      }
    };
  }, [isConnected, enabled, serverid, stackname, subscribe, unsubscribe]);

  useEffect(() => {
    return () => {
      if (invalidationTimeoutRef.current) {
        clearTimeout(invalidationTimeoutRef.current);
      }
    };
  }, []);

  return {
    isConnected,
    connectionStatus,
  };
};
