import { useEffect, useCallback, useRef } from 'react';
import { useWebSocket } from './useWebSocket';
import { useQueryClient } from '@tanstack/react-query';
import type {
  ContainerStatusEvent,
  StackStatusEvent,
  UseStackWebSocketOptions,
} from '../types/websocket';

export const useStackWebSocket = ({
  serverId,
  stackName,
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
        queryKey: ['stackDetails', serverId, stackName],
      });

      queryClient.invalidateQueries({
        queryKey: ['serverStacks', serverId],
      });

      invalidationTimeoutRef.current = null;
    }, 300);
  }, [queryClient, serverId, stackName]);

  const handleMessage = useCallback(
    (message: any) => {
      switch (message.type) {
        case 'container_status': {
          const event = message as ContainerStatusEvent;

          if (event.server_id === serverId && event.stack_name === stackName) {
            debouncedInvalidateQueries();
          }
          break;
        }

        case 'stack_status': {
          const event = message as StackStatusEvent;

          if (event.server_id === serverId && event.stack_name === stackName) {
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
    [serverId, stackName, debouncedInvalidateQueries]
  );

  const handleConnect = useCallback(() => {}, []);

  const handleDisconnect = useCallback(() => {}, []);

  const { isConnected, connectionStatus, subscribe, unsubscribe } = useWebSocket({
    url: `/ws/ui/stack-status/${serverId}`,
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

    const subscriptionKey = `stack_status:${serverId}:${stackName}`;

    if (!subscriptionsRef.current.has(subscriptionKey)) {
      if (subscribe('stack_status', serverId, stackName)) {
        subscriptionsRef.current.add(subscriptionKey);
      }
    }

    return () => {
      if (subscriptionsRef.current.has(subscriptionKey)) {
        unsubscribe('stack_status', serverId, stackName);
        subscriptionsRef.current.delete(subscriptionKey);
      }
    };
  }, [isConnected, enabled, serverId, stackName, subscribe, unsubscribe]);

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
