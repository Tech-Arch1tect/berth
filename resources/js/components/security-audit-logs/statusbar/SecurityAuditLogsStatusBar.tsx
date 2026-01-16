import { FunnelIcon, ClockIcon } from '@heroicons/react/24/outline';
import { cn } from '../../../utils/cn';
import { theme } from '../../../theme';

interface PaginationInfo {
  total: number;
  totalPages: number;
  currentPage: number;
  pageSize: number;
}

interface SecurityAuditLogsStatusBarProps {
  pagination: PaginationInfo | null;
  hasActiveFilters: boolean;
  activeFilterCount: number;
  lastUpdated: Date | null;
}

export const SecurityAuditLogsStatusBar: React.FC<SecurityAuditLogsStatusBarProps> = ({
  pagination,
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
        {pagination && (
          <span className={theme.text.muted}>
            Showing{' '}
            <span className={cn('font-medium', theme.text.standard)}>
              {((pagination.currentPage - 1) * pagination.pageSize + 1).toLocaleString()}
            </span>
            {' - '}
            <span className={cn('font-medium', theme.text.standard)}>
              {Math.min(
                pagination.currentPage * pagination.pageSize,
                pagination.total
              ).toLocaleString()}
            </span>
            {' of '}
            <span className={cn('font-medium', theme.text.standard)}>
              {pagination.total.toLocaleString()}
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
