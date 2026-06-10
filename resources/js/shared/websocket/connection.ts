import { getAccessToken } from '../auth/auth-context';

export type WebSocketConnectionStatus = 'connecting' | 'connected' | 'disconnected' | 'error';

export interface WebSocketHandlers {
  onMessage?: (message: unknown) => void;
  onOpen?: () => void;
  onClose?: (event: CloseEvent) => void;
  onError?: () => void;
}

export const buildWebSocketUrl = (path: string): string => {
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  return `${protocol}//${window.location.host}${path}`;
};

export const openAuthenticatedWebSocket = (
  path: string,
  { onMessage, onOpen, onClose, onError }: WebSocketHandlers
): WebSocket => {
  const url = buildWebSocketUrl(path);
  const token = getAccessToken();
  const ws = token ? new WebSocket(url, ['Bearer', token]) : new WebSocket(url);

  ws.onopen = () => onOpen?.();
  ws.onclose = (event) => onClose?.(event);
  ws.onerror = () => onError?.();
  ws.onmessage = (event) => {
    try {
      onMessage?.(JSON.parse(event.data));
    } catch (error) {
      console.error('Failed to parse WebSocket message:', error);
    }
  };

  return ws;
};
