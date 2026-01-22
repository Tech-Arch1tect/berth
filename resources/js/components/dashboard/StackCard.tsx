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
import type { GetApiV1ServersServeridStacks200StacksItem } from '../../api/generated/models';
import { useStackImageUpdates } from '../../hooks/useStackImageUpdates';
import { UpdateAvailableBadge } from '../image-updates';

interface StackCardProps {
  stack: GetApiV1ServersServeridStacks200StacksItem;
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
          theme.cards.stack.compact.base,
          stack.is_healthy
            ? theme.cards.stack.compact.healthy
            : theme.cards.stack.compact.unhealthy,
          theme.cards.stack.compact.lift
        )}
      >
        {/* Color accent bar at bottom */}
        <div
          className={
            stack.is_healthy ? theme.progress.compactHealthy : theme.progress.compactUnhealthy
          }
          style={{ width: `${healthPercentage}%` }}
        />

        <div className="p-3 pb-4">
          <div className="flex items-start justify-between gap-2 mb-2">
            <div className="flex items-center gap-2 min-w-0 flex-1">
              <CircleStackIcon
                className={cn(
                  'h-4 w-4 flex-shrink-0',
                  stack.is_healthy ? theme.text.success : theme.text.danger
                )}
              />
              <h3 className={cn('truncate text-sm font-semibold', theme.text.strong)}>
                {stack.name}
              </h3>
            </div>
            <div className="flex items-center gap-1.5 flex-shrink-0">
              {stack.is_healthy ? (
                <CheckCircleIcon className={cn('h-3.5 w-3.5', theme.text.success)} />
              ) : (
                <XCircleIcon className={cn('h-3.5 w-3.5', theme.text.danger)} />
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
      className={cn(theme.cards.stack.normal.base, theme.cards.stack.normal.hover)}
    >
      {/* Health accent bar at top */}
      <div
        className={cn(
          'h-1.5',
          stack.is_healthy ? theme.intent.success.icon : theme.intent.danger.icon
        )}
      />

      <div className="p-5">
        {/* Header with name and status */}
        <div className="flex items-start justify-between gap-3 mb-4">
          <div className="flex items-center space-x-3 min-w-0 flex-1">
            <div
              className={cn(
                theme.icon.squareMd,
                stack.is_healthy ? theme.intent.success.icon : theme.intent.danger.icon,
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
              <CheckCircleIcon className={cn('h-5 w-5', theme.text.success)} title="Healthy" />
            ) : (
              <XCircleIcon className={cn('h-5 w-5', theme.text.danger)} title="Unhealthy" />
            )}
            <UpdateAvailableBadge count={updateCount} variant="compact" />
          </div>
        </div>

        {/* Container count */}
        <div
          className={cn('flex items-center justify-between mb-3 pb-3', theme.cards.sectionDivider)}
        >
          <div className="flex items-center gap-2">
            <div
              className={cn(
                'flex items-center justify-center h-8 w-8 rounded-lg',
                stack.is_healthy ? theme.intent.success.surface : theme.intent.danger.surface
              )}
            >
              <ServerIcon
                className={cn('h-4 w-4', stack.is_healthy ? theme.text.success : theme.text.danger)}
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
                stack.is_healthy ? theme.text.success : theme.text.danger
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
            className={
              stack.is_healthy ? theme.progress.healthyGradient : theme.progress.unhealthyGradient
            }
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
