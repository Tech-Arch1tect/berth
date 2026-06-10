import { useEffect, useCallback, useRef } from 'react';
import { useWebSocket } from '../../../shared/hooks/useWebSocket';
import { useQueryClient } from '@tanstack/react-query';
import type { ContainerStatusEvent, StackStatusEvent } from '../../../api/generated/models';
import {
  getGetApiV1ServersServeridStacksQueryKey,
  getGetApiV1ServersServeridStacksStacknameQueryKey,
} from '../../../api/generated/stacks/stacks';

export interface UseStackWebSocketOptions {
  serverid: number;
  stackname: string;
}

export const useStackWebSocket = ({ serverid, stackname }: UseStackWebSocketOptions) => {
  const queryClient = useQueryClient();
  const invalidationTimeoutRef = useRef<number | null>(null);

  const debouncedInvalidateQueries = useCallback(() => {
    if (invalidationTimeoutRef.current) {
      clearTimeout(invalidationTimeoutRef.current);
    }

    invalidationTimeoutRef.current = setTimeout(() => {
      queryClient.invalidateQueries({
        queryKey: getGetApiV1ServersServeridStacksStacknameQueryKey(serverid, stackname),
      });

      queryClient.invalidateQueries({
        queryKey: getGetApiV1ServersServeridStacksQueryKey(serverid),
      });

      invalidationTimeoutRef.current = null;
    }, 300);
  }, [queryClient, serverid, stackname]);

  const handleMessage = useCallback(
    (message: unknown) => {
      const event = message as ContainerStatusEvent | StackStatusEvent;
      if (event.type === 'container_status' || event.type === 'stack_status') {
        debouncedInvalidateQueries();
      }
    },
    [debouncedInvalidateQueries]
  );

  const { isConnected, connectionStatus } = useWebSocket({
    path: `/ws/api/servers/${serverid}/stacks/${encodeURIComponent(stackname)}/events`,
    onMessage: handleMessage,
    autoReconnect: true,
    reconnectInterval: 3000,
  });

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
