import { Server } from '../../../types/server';
import { cn } from '../../../utils/cn';
import { theme } from '../../../theme';

interface ServerListItemProps {
  server: Server;
  isActive: boolean;
  onClick: () => void;
  stackCount?: {
    total: number;
    healthy: number;
  };
}

export const ServerListItem: React.FC<ServerListItemProps> = ({
  server,
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
          <span
            className={cn(
              'w-2 h-2 rounded-full flex-shrink-0',
              server.is_active ? 'bg-emerald-500' : 'bg-zinc-400 dark:bg-zinc-600'
            )}
          />
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
