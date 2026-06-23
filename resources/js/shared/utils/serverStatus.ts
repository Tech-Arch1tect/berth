export type ServerStatus = 'online' | 'checking' | 'offline' | 'disabled';

export interface ServerStatsQueryState {
  dataUpdatedAt: number;
  errorUpdatedAt: number;
}

export function deriveServerStatus(isActive: boolean, query: ServerStatsQueryState): ServerStatus {
  if (!isActive) {
    return 'disabled';
  }

  if (query.errorUpdatedAt > 0 && query.errorUpdatedAt >= query.dataUpdatedAt) {
    return 'offline';
  }
  if (query.dataUpdatedAt > 0) {
    return 'online';
  }
  return 'checking';
}

export const SERVER_STATUS_LABEL: Record<ServerStatus, string> = {
  online: 'Online',
  checking: 'Checking…',
  offline: 'Offline',
  disabled: 'Disabled',
};

export const SERVER_STATUS_DOT: Record<ServerStatus, string> = {
  online: 'bg-emerald-500',
  checking: 'bg-amber-500',
  offline: 'bg-red-500',
  disabled: 'bg-zinc-400 dark:bg-zinc-500',
};

export const SERVER_STATUS_PULSE: Record<ServerStatus, boolean> = {
  online: true,
  checking: true,
  offline: false,
  disabled: false,
};

export const SERVER_STATUS_BADGE: Record<ServerStatus, string> = {
  online: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
  checking: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  offline: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  disabled: 'bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400',
};
