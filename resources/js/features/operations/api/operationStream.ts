import type { StreamMessage } from '../../../api/generated/models';
import { openAuthenticatedWebSocket } from '../../../shared/websocket/connection';

export interface OperationStreamHandlers {
  onMessage?: (message: StreamMessage) => void;
  onComplete?: (success: boolean, exitCode?: number) => void;
  onError?: (error: string) => void;
  onClose?: () => void;
}

export interface OperationStream {
  close: () => void;
}

export const streamOperation = (
  serverId: number,
  stackName: string,
  operationId: string,
  handlers: OperationStreamHandlers
): OperationStream => {
  const path = `/ws/api/servers/${serverId}/stacks/${encodeURIComponent(stackName)}/operations/${encodeURIComponent(operationId)}`;

  const ws = openAuthenticatedWebSocket(path, {
    onMessage: (message) => {
      const frame = message as StreamMessage;
      handlers.onMessage?.(frame);

      if (frame.type === 'complete') {
        handlers.onComplete?.(frame.success ?? false, frame.exitCode ?? undefined);
      } else if (frame.type === 'error') {
        handlers.onError?.(frame.data || 'Operation stream failed');
      }
    },
    onClose: () => handlers.onClose?.(),
    onError: () => handlers.onError?.('Operation stream connection failed'),
  });

  return {
    close: () => ws.close(),
  };
};
