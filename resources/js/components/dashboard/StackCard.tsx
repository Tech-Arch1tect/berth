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

interface StackCardProps {
  stack: Stack;
}

export const StackCard: React.FC<StackCardProps> = ({ stack }) => {
  const healthPercentage =
    stack.total_containers > 0
      ? Math.round((stack.running_containers / stack.total_containers) * 100)
      : 0;

  const healthVariant = stack.is_healthy ? 'healthy' : 'unhealthy';

  return (
    <Link
      href={`/servers/${stack.server_id}/stacks/${stack.name}`}
      className={cn(
        theme.cards.shell,
        theme.cards.translucent,
        theme.cards.interactive,
        theme.cards.padded
      )}
    >
      <div className="space-y-4">
        <div className="flex items-start justify-between">
          <div className="flex items-center space-x-3">
            <div className={cn(theme.icon.squareMd, theme.brand.stack)}>
              <CircleStackIcon className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <h3 className={cn('truncate text-lg font-semibold', theme.text.strong)}>
                {stack.name}
              </h3>
              <div className="mt-1 flex items-center space-x-2">
                <ServerIcon className={cn('h-3.5 w-3.5 flex-shrink-0', theme.text.subtle)} />
                <span className={cn('truncate text-sm', theme.text.muted)}>
                  {stack.server_name}
                </span>
              </div>
            </div>
          </div>
          <span className={cn(theme.badges.health.base, theme.badges.health[healthVariant])}>
            {stack.is_healthy ? (
              <CheckCircleIcon className="h-3.5 w-3.5" />
            ) : (
              <XCircleIcon className="h-3.5 w-3.5" />
            )}
            <span>{stack.is_healthy ? 'Healthy' : 'Unhealthy'}</span>
          </span>
        </div>

        <div className="flex items-center space-x-2">
          <FolderIcon className={cn('h-3.5 w-3.5 flex-shrink-0', theme.text.subtle)} />
          <p className={cn('truncate font-mono text-xs', theme.text.subtle)}>
            {stack.compose_file}
          </p>
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className={theme.text.muted}>Containers</span>
            <span className={cn('font-medium', theme.text.strong)}>
              {stack.running_containers}/{stack.total_containers}
            </span>
          </div>

          <div className="relative">
            <div className={theme.progress.track}>
              <div
                className={cn(stack.is_healthy ? theme.progress.healthy : theme.progress.unhealthy)}
                style={{ width: `${healthPercentage}%` }}
              />
            </div>
          </div>

          <div className="flex items-center justify-between text-xs">
            <span className={theme.text.subtle}>Health: {healthPercentage}%</span>
            {!stack.is_healthy && (
              <span className={cn('font-medium', theme.text.danger)}>
                {stack.total_containers - stack.running_containers} down
              </span>
            )}
          </div>
        </div>
      </div>
    </Link>
  );
};
