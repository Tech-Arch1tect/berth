import {
  CircleStackIcon,
  MagnifyingGlassIcon,
  ExclamationTriangleIcon,
} from '@heroicons/react/24/outline';
import { cn } from '../../../utils/cn';
import { theme } from '../../../theme';
import type { GetApiV1ServersServeridStacks200StacksItem } from '../../../api/generated/models';
import { Server } from '../../../types/server';
import { CompactStatistics } from './CompactStatistics';
import { StackCard } from '../../dashboard/StackCard';
import { EmptyState } from '../../common/EmptyState';
import { LoadingSpinner } from '../../common/LoadingSpinner';

interface StacksContentProps {
  stacks: GetApiV1ServersServeridStacks200StacksItem[];
  statistics: {
    total: number;
    healthy: number;
    unhealthy: number;
    running: number;
    totalContainers: number;
  };
  layoutMode: 'compact' | 'normal';
  isLoading: boolean;
  hasError: boolean;
  errors: Array<{ server: Server; error: Error }>;
  hasActiveFilters: boolean;
}

export const StacksContent: React.FC<StacksContentProps> = ({
  stacks,
  statistics,
  layoutMode,
  isLoading,
  hasError,
  errors,
  hasActiveFilters,
}) => {
  return (
    <div className="flex-1 overflow-auto">
      <div className="p-6">
        {/* Compact Statistics */}
        <CompactStatistics statistics={statistics} />

        {/* Error Banner */}
        {hasError && errors.length > 0 && (
          <div className={cn('mb-6 rounded-xl p-4', theme.intent.danger.surface)}>
            <div className="flex items-start space-x-3">
              <ExclamationTriangleIcon
                className={cn('w-5 h-5 flex-shrink-0 mt-0.5', theme.intent.danger.icon)}
              />
              <div className="flex-1">
                <h3 className={cn('text-sm font-semibold mb-2', theme.intent.danger.textStrong)}>
                  Failed to load stacks from some servers
                </h3>
                <ul className="space-y-1">
                  {errors.map(({ server, error }) => (
                    <li key={server.id} className={cn('text-sm', theme.intent.danger.textMuted)}>
                      {server.name}: {error.message}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        )}

        {/* Loading State */}
        {isLoading ? (
          <LoadingSpinner size="lg" text="Loading stacks from all servers..." fullScreen />
        ) : (
          <>
            {/* Empty State or Grid */}
            {stacks.length === 0 ? (
              <EmptyState
                icon={hasActiveFilters ? MagnifyingGlassIcon : CircleStackIcon}
                title="No stacks found"
                description={
                  hasActiveFilters
                    ? 'Try adjusting your search or filter criteria.'
                    : 'There are no Docker Compose stacks configured on any server.'
                }
              />
            ) : (
              <div
                className={cn(
                  'grid gap-6',
                  layoutMode === 'compact'
                    ? 'md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4'
                    : 'md:grid-cols-2 lg:grid-cols-3'
                )}
              >
                {stacks.map((stack) => (
                  <StackCard
                    key={`${stack.server_id}-${stack.name}`}
                    stack={stack}
                    compact={layoutMode === 'compact'}
                  />
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};
