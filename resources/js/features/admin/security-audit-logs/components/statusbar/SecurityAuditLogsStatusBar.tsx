import { FunnelIcon, ClockIcon } from '@heroicons/react/24/outline';
import { cn } from '../../../../../shared/utils/cn';
import { theme } from '../../../../../shared/theme';
import type { Meta } from '../../../../../api/generated/models';

interface SecurityAuditLogsStatusBarProps {
  meta: Meta | null;
  hasActiveFilters: boolean;
  activeFilterCount: number;
  lastUpdated: Date | null;
}

export const SecurityAuditLogsStatusBar: React.FC<SecurityAuditLogsStatusBarProps> = ({
  meta,
  hasActiveFilters,
  activeFilterCount,
  lastUpdated,
}) => {
  const formatTime = (date: Date) => {
    return date.toLocaleTimeString(undefined, {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  };

  const showCounts =
    meta != null && meta.page != null && meta.pageSize != null && meta.totalCount != null;

  return (
    <div
      className={cn(
        'flex items-center justify-between px-4 py-2',
        'bg-zinc-50 dark:bg-zinc-800/50',
        'text-xs'
      )}
    >
      {/* Left side - Results count */}
      <div className="flex items-center gap-4">
        {showCounts && (
          <span className={theme.text.muted}>
            Showing{' '}
            <span className={cn('font-medium', theme.text.standard)}>
              {((meta.page! - 1) * meta.pageSize! + 1).toLocaleString()}
            </span>
            {' - '}
            <span className={cn('font-medium', theme.text.standard)}>
              {Math.min(meta.page! * meta.pageSize!, meta.totalCount!).toLocaleString()}
            </span>
            {' of '}
            <span className={cn('font-medium', theme.text.standard)}>
              {meta.totalCount!.toLocaleString()}
            </span>{' '}
            events
          </span>
        )}

        {hasActiveFilters && (
          <div
            className={cn(
              'flex items-center gap-1.5 px-2 py-0.5 rounded-full',
              'bg-teal-100 dark:bg-teal-900/30',
              'text-teal-700 dark:text-teal-300'
            )}
          >
            <FunnelIcon className="h-3 w-3" />
            <span className="font-medium">
              {activeFilterCount} filter{activeFilterCount !== 1 ? 's' : ''} active
            </span>
          </div>
        )}
      </div>

      {/* Right side - Last updated */}
      <div className="flex items-center gap-4">
        {lastUpdated && (
          <div className={cn('flex items-center gap-1.5', theme.text.muted)}>
            <ClockIcon className="h-3.5 w-3.5" />
            <span>Updated {formatTime(lastUpdated)}</span>
          </div>
        )}
      </div>
    </div>
  );
};
