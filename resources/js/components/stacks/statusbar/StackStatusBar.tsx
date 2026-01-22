import React from 'react';
import type { GetApiV1ServersServeridStacksStackname200ServicesItem } from '../../../api/generated/models';
import { WebSocketConnectionStatus } from '../../../types/websocket';
import { cn } from '../../../utils/cn';
import { theme } from '../../../theme';

interface StackStatusBarProps {
  services: GetApiV1ServersServeridStacksStackname200ServicesItem[];
  connectionStatus: WebSocketConnectionStatus;
  lastUpdated: Date | null;
  isOperationRunning: boolean;
  runningOperation?: string;
}

export const StackStatusBar: React.FC<StackStatusBarProps> = ({
  services,
  connectionStatus,
  lastUpdated,
  isOperationRunning,
  runningOperation,
}) => {
  const runningCount = services.filter((s) =>
    s.containers?.some((c) => c.state?.toLowerCase() === 'running')
  ).length;
  const totalCount = services.length;

  const connectionConfig: Record<WebSocketConnectionStatus, { dot: string; text: string }> = {
    connected: {
      dot: 'bg-emerald-500',
      text: 'Connected',
    },
    connecting: {
      dot: 'bg-amber-500 animate-pulse',
      text: 'Connecting...',
    },
    disconnected: {
      dot: 'bg-zinc-400',
      text: 'Disconnected',
    },
    error: {
      dot: 'bg-red-500',
      text: 'Error',
    },
  };

  const conn = connectionConfig[connectionStatus];

  const formatLastUpdated = (date: Date | null): string => {
    if (!date) return 'Never';
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffSec = Math.floor(diffMs / 1000);

    if (diffSec < 5) return 'Just now';
    if (diffSec < 60) return `${diffSec}s ago`;
    const diffMin = Math.floor(diffSec / 60);
    if (diffMin < 60) return `${diffMin}m ago`;
    const diffHr = Math.floor(diffMin / 60);
    if (diffHr < 24) return `${diffHr}h ago`;
    return date.toLocaleDateString();
  };

  return (
    <div
      className={cn(
        'h-6 px-3 flex items-center justify-between text-xs border-t',
        'border-zinc-200 dark:border-zinc-800',
        theme.surface.muted
      )}
    >
      {/* Left side */}
      <div className="flex items-center gap-4">
        {/* Connection status */}
        <div className="flex items-center gap-1.5">
          <span className={cn('w-2 h-2 rounded-full', conn.dot)} />
          <span className={theme.text.muted}>{conn.text}</span>
        </div>

        {/* Service counts */}
        <div className={theme.text.muted}>
          <span
            className={runningCount === totalCount ? 'text-emerald-600 dark:text-emerald-400' : ''}
          >
            {runningCount}
          </span>
          <span className={theme.text.subtle}>/</span>
          <span>{totalCount}</span>
          <span className={cn('ml-1', theme.text.subtle)}>services</span>
        </div>
      </div>

      {/* Right side */}
      <div className="flex items-center gap-4">
        {/* Operation status */}
        {isOperationRunning && runningOperation && (
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-teal-500 animate-pulse" />
            <span className="text-teal-600 dark:text-teal-400">{runningOperation}</span>
          </div>
        )}

        {/* Last updated */}
        <div className={theme.text.subtle}>Updated {formatLastUpdated(lastUpdated)}</div>
      </div>
    </div>
  );
};
