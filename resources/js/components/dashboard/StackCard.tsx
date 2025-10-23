import { Link } from '@inertiajs/react';
import {
  ServerIcon,
  CircleStackIcon,
  CheckCircleIcon,
  XCircleIcon,
  FolderIcon,
} from '@heroicons/react/24/outline';
import { cn } from '../../utils/cn';
import { theme } from '../../theme';
import { Stack } from '../../types/stack';
import { useStackImageUpdates } from '../../hooks/useStackImageUpdates';
import { UpdateAvailableBadge } from '../image-updates';

interface StackCardProps {
  stack: Stack;
  compact?: boolean;
}

export const StackCard: React.FC<StackCardProps> = ({ stack, compact = false }) => {
  const healthPercentage =
    stack.total_containers > 0
      ? Math.round((stack.running_containers / stack.total_containers) * 100)
      : 0;

  // Fetch image updates for this stack
  const { updateCount } = useStackImageUpdates({
    serverid: stack.server_id,
    stackname: stack.name,
    enabled: true,
  });

  if (compact) {
    return (
      <Link
        href={`/servers/${stack.server_id}/stacks/${stack.name}`}
        className={cn(
          'group relative block rounded-xl border-2 transition-all duration-200 overflow-hidden',
          'bg-white dark:bg-zinc-900',
          stack.is_healthy
            ? 'border-emerald-200 hover:border-emerald-400 dark:border-emerald-900/50 dark:hover:border-emerald-700'
            : 'border-rose-200 hover:border-rose-400 dark:border-rose-900/50 dark:hover:border-rose-700',
          'hover:shadow-xl hover:-translate-y-0.5'
        )}
      >
        {/* Color accent bar at bottom */}
        <div
          className={cn(
            'absolute bottom-0 left-0 right-0 h-1',
            stack.is_healthy ? 'bg-emerald-500 dark:bg-emerald-400' : 'bg-rose-500 dark:bg-rose-400'
          )}
          style={{ width: `${healthPercentage}%` }}
        />

        <div className="p-3 pb-4">
          <div className="flex items-start justify-between gap-2 mb-2">
            <div className="flex items-center gap-2 min-w-0 flex-1">
              <CircleStackIcon
                className={cn(
                  'h-4 w-4 flex-shrink-0',
                  stack.is_healthy
                    ? 'text-emerald-600 dark:text-emerald-400'
                    : 'text-rose-600 dark:text-rose-400'
                )}
              />
              <h3 className={cn('truncate text-sm font-semibold', theme.text.strong)}>
                {stack.name}
              </h3>
            </div>
            <div className="flex items-center gap-1.5 flex-shrink-0">
              {stack.is_healthy ? (
                <CheckCircleIcon className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
              ) : (
                <XCircleIcon className="h-3.5 w-3.5 text-rose-600 dark:text-rose-400" />
              )}
              <UpdateAvailableBadge count={updateCount} variant="compact" />
            </div>
          </div>

          <div className="flex items-center justify-between text-xs">
            <span className={cn('truncate', theme.text.subtle)}>{stack.server_name}</span>
            <span className={cn('font-semibold ml-2 flex-shrink-0', theme.text.strong)}>
              {stack.running_containers}/{stack.total_containers}
            </span>
          </div>
        </div>
      </Link>
    );
  }

  return (
    <Link
      href={`/servers/${stack.server_id}/stacks/${stack.name}`}
      className={cn(
        'group relative block rounded-xl border transition-all duration-200 overflow-hidden',
        'bg-white shadow-sm dark:bg-zinc-900',
        'border-zinc-200 dark:border-zinc-800',
        'hover:border-teal-300 hover:shadow-xl hover:-translate-y-1 dark:hover:border-teal-700'
      )}
    >
      {/* Health accent bar at top */}
      <div
        className={cn(
          'h-1.5',
          stack.is_healthy ? 'bg-emerald-500 dark:bg-emerald-400' : 'bg-rose-500 dark:bg-rose-400'
        )}
      />

      <div className="p-5">
        {/* Header with name and status */}
        <div className="flex items-start justify-between gap-3 mb-4">
          <div className="flex items-center space-x-3 min-w-0 flex-1">
            <div
              className={cn(
                theme.icon.squareMd,
                stack.is_healthy
                  ? 'bg-emerald-600 dark:bg-emerald-500'
                  : 'bg-rose-600 dark:bg-rose-500',
                'shadow-md flex-shrink-0'
              )}
            >
              <CircleStackIcon className="h-5 w-5" />
            </div>
            <div className="min-w-0 flex-1">
              <h3 className={cn('truncate text-lg font-bold mb-1', theme.text.strong)}>
                {stack.name}
              </h3>
              <div className="flex items-center space-x-2 text-xs">
                <ServerIcon className={cn('h-3.5 w-3.5 flex-shrink-0', theme.text.subtle)} />
                <span className={cn('truncate', theme.text.muted)}>{stack.server_name}</span>
              </div>
            </div>
          </div>
          <div className="flex flex-col items-end gap-2 flex-shrink-0">
            {/* Icon-only health indicator */}
            {stack.is_healthy ? (
              <CheckCircleIcon
                className="h-5 w-5 text-emerald-600 dark:text-emerald-400"
                title="Healthy"
              />
            ) : (
              <XCircleIcon className="h-5 w-5 text-rose-600 dark:text-rose-400" title="Unhealthy" />
            )}
            <UpdateAvailableBadge count={updateCount} variant="compact" />
          </div>
        </div>

        {/* Container count */}
        <div className="flex items-center justify-between mb-3 pb-3 border-b border-zinc-100 dark:border-zinc-800">
          <div className="flex items-center gap-2">
            <div
              className={cn(
                'flex items-center justify-center h-8 w-8 rounded-lg',
                stack.is_healthy
                  ? 'bg-emerald-50 dark:bg-emerald-900/20'
                  : 'bg-rose-50 dark:bg-rose-900/20'
              )}
            >
              <ServerIcon
                className={cn(
                  'h-4 w-4',
                  stack.is_healthy
                    ? 'text-emerald-600 dark:text-emerald-400'
                    : 'text-rose-600 dark:text-rose-400'
                )}
              />
            </div>
            <div>
              <div className={cn('text-xs font-medium', theme.text.subtle)}>Containers</div>
              <div className={cn('text-lg font-bold', theme.text.strong)}>
                {stack.running_containers}/{stack.total_containers}
              </div>
            </div>
          </div>
          <div className="text-right">
            <div
              className={cn(
                'text-2xl font-bold',
                stack.is_healthy
                  ? 'text-emerald-600 dark:text-emerald-400'
                  : 'text-rose-600 dark:text-rose-400'
              )}
            >
              {healthPercentage}%
            </div>
            <div className={cn('text-xs', theme.text.subtle)}>healthy</div>
          </div>
        </div>

        {/* Progress bar */}
        <div className="relative h-2 mb-3">
          <div className="absolute inset-0 rounded-full bg-zinc-100 dark:bg-zinc-800" />
          <div
            className={cn(
              'absolute inset-y-0 left-0 rounded-full transition-all',
              stack.is_healthy
                ? 'bg-gradient-to-r from-emerald-500 to-emerald-400'
                : 'bg-gradient-to-r from-rose-500 to-rose-400'
            )}
            style={{ width: `${healthPercentage}%` }}
          />
        </div>

        {/* Compose file path */}
        <div className="flex items-center space-x-2">
          <FolderIcon className={cn('h-3.5 w-3.5 flex-shrink-0', theme.text.subtle)} />
          <p className={cn('truncate font-mono text-xs', theme.text.subtle)}>
            {stack.compose_file}
          </p>
        </div>
      </div>
    </Link>
  );
};
