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
import type { Stack } from '../../api/generated/models';
import { useStackImageUpdates } from '../../hooks/useStackImageUpdates';
import { UpdateAvailableBadge } from '../image-updates';

interface StackCardProps {
  stack: Stack;
  compact?: boolean;
}

export const StackCard: React.FC<StackCardProps> = ({ stack, compact = false }) => {
  const { updateCount } = useStackImageUpdates({
    serverid: stack.server_id,
    stackname: stack.name,
    enabled: true,
  });

  const healthDetails = stack.health_details;

  const healthyPercentage =
    healthDetails?.percentage ??
    (stack.total_containers > 0
      ? Math.round((stack.running_containers / stack.total_containers) * 100)
      : 0);

  const unhealthyPercentage = stack.total_containers > 0 ? 100 - healthyPercentage : 0;

  const getUnhealthyReason = () => {
    if (!healthDetails || healthDetails.reasons.length === 0) {
      return 'Unhealthy';
    }
    return healthDetails.reasons.join(', ');
  };

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
        title={stack.is_healthy ? 'Healthy' : getUnhealthyReason()}
      >
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

            <div className="flex items-center justify-between text-xs">
              <span className={cn('truncate', theme.text.subtle)}>{stack.server_name}</span>
              <span className={cn('font-semibold ml-2 flex-shrink-0', theme.text.strong)}>
                {stack.running_containers}/{stack.total_containers}
              </span>
            </div>
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
      <div className="p-5">
        <div className="mb-4">
          <div className="flex items-center justify-between text-xs mb-1">
            <span className={cn(theme.text.subtle)}>Health Status</span>
            <span
              className={cn(
                'font-medium',
                stack.is_healthy ? theme.text.success : theme.text.danger
              )}
            >
              {healthyPercentage}% healthy
            </span>
          </div>
          <div
            className={cn(
              'relative h-2.5 overflow-hidden rounded-full flex',
              stack.is_healthy
                ? 'bg-emerald-100 dark:bg-emerald-900/20'
                : 'bg-red-100 dark:bg-red-900/20'
            )}
          >
            <div
              className={theme.progress.healthyGradient}
              style={{ width: `${healthyPercentage}%` }}
            />
            {unhealthyPercentage > 0 && (
              <div
                className={theme.progress.unhealthyGradient}
                style={{ width: `${unhealthyPercentage}%` }}
              />
            )}
          </div>
          {!stack.is_healthy && (
            <div className="mt-1 text-xs text-right">
              <span className={cn(theme.text.subtle)}>{getUnhealthyReason()}</span>
            </div>
          )}
        </div>

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
              <XCircleIcon
                className={cn('h-5 w-5', theme.text.danger)}
                title={getUnhealthyReason()}
              />
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
              {healthyPercentage}%
            </div>
          </div>
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
