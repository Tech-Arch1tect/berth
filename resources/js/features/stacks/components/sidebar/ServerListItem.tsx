import { Server } from '../../../../shared/types/server';
import { cn } from '../../../../shared/utils/cn';
import { theme } from '../../../../shared/theme';
import { ServerStatus } from '../../../../shared/utils/serverStatus';
import { ServerStatusDot } from '../../../../shared/components/ServerStatusBadge';

interface ServerListItemProps {
  server: Server;
  status: ServerStatus;
  isActive: boolean;
  onClick: () => void;
  stackCount?: {
    total: number;
    healthy: number;
  };
}

export const ServerListItem: React.FC<ServerListItemProps> = ({
  server,
  status,
  isActive,
  onClick,
  stackCount,
}) => {
  return (
    <button
      onClick={onClick}
      className={cn(
        'w-full px-3 py-2 text-left transition-colors',
        'hover:bg-zinc-100 dark:hover:bg-zinc-800',
        isActive && 'bg-teal-50 dark:bg-teal-950/30'
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          {/* Status dot */}
          <ServerStatusDot status={status} />
          <div className="min-w-0">
            {/* Server name */}
            <div
              className={cn(
                'text-sm font-medium truncate',
                isActive ? 'text-teal-700 dark:text-teal-400' : theme.text.strong
              )}
            >
              {server.name}
            </div>
            {/* Host:port */}
            <div className={cn('text-xs truncate', theme.text.subtle)}>
              {server.host}:{server.port}
            </div>
          </div>
        </div>

        {/* Stack count badge */}
        {stackCount && stackCount.total > 0 && (
          <div className="flex-shrink-0">
            <span
              className={cn(
                'px-2 py-0.5 rounded-md text-xs font-medium tabular-nums',
                isActive
                  ? 'bg-teal-100 text-teal-700 dark:bg-teal-900/50 dark:text-teal-300'
                  : 'bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300'
              )}
            >
              {stackCount.healthy}/{stackCount.total}
            </span>
          </div>
        )}
      </div>
    </button>
  );
};
