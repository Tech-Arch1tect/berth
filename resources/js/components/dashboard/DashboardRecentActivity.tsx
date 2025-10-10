import {
  ClockIcon,
  ExclamationTriangleIcon,
  CheckCircleIcon,
  XCircleIcon,
} from '@heroicons/react/24/outline';
import { Link } from '@inertiajs/react';
import { cn } from '../../utils/cn';
import { theme } from '../../theme';
import { ActivitySummary, RecentActivity } from './hooks/useDashboardActivity';

interface DashboardRecentActivityProps {
  activitySummary: ActivitySummary;
}

const getStatusIcon = (operation: RecentActivity) => {
  if (operation.is_incomplete) {
    return <ExclamationTriangleIcon className={cn('h-5 w-5', theme.text.warning)} />;
  }
  if (operation.success === true) {
    return <CheckCircleIcon className={cn('h-5 w-5', theme.text.success)} />;
  }
  if (operation.success === false) {
    return <XCircleIcon className={cn('h-5 w-5', theme.text.danger)} />;
  }
  return <ClockIcon className={cn('h-5 w-5', theme.text.subtle)} />;
};

const formatDuration = (duration: number | null, isPartial = false) => {
  if (!duration || duration <= 0) return 'N/A';

  let formatted = '';
  if (duration < 1000) formatted = `${duration}ms`;
  else if (duration < 60000) formatted = `${(duration / 1000).toFixed(1)}s`;
  else formatted = `${(duration / 60000).toFixed(1)}m`;

  return isPartial ? `~${formatted}` : formatted;
};

const getOperationDuration = (operation: RecentActivity) => {
  if (operation.duration_ms !== null) {
    return formatDuration(operation.duration_ms, false);
  }
  if (operation.partial_duration_ms !== null) {
    return formatDuration(operation.partial_duration_ms, true);
  }
  return 'N/A';
};

const LoadingCard = () => (
  <div className={theme.containers.subtle}>
    <div className="animate-pulse space-y-3">
      <div className="h-4 w-1/3 rounded bg-slate-200 dark:bg-slate-700" />
      {[...Array(3)].map((_, index) => (
        <div key={index} className="h-4 rounded bg-slate-200 dark:bg-slate-700" />
      ))}
    </div>
  </div>
);

export const DashboardRecentActivity = ({ activitySummary }: DashboardRecentActivityProps) => {
  const { recentOperations, failedOperations, loading, error } = activitySummary;

  if (loading) {
    return (
      <div className="mb-8 grid grid-cols-1 gap-6 lg:grid-cols-2">
        <LoadingCard />
        <LoadingCard />
      </div>
    );
  }

  if (error) {
    return (
      <div
        className={cn(
          'mb-8 rounded-xl border p-4',
          theme.intent.danger.border,
          theme.intent.danger.surface
        )}
      >
        <div className="flex items-center gap-3">
          <ExclamationTriangleIcon className={cn('h-5 w-5', theme.intent.danger.textStrong)} />
          <p className={cn('text-sm', theme.intent.danger.textStrong)}>{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="mb-8 grid grid-cols-1 gap-6 lg:grid-cols-2">
      <div className={theme.containers.subtle}>
        <header className="flex items-center justify-between border-b border-slate-200/60 pb-4 dark:border-slate-700/60">
          <div className="flex items-center gap-2">
            <ClockIcon className={cn('h-5 w-5', theme.text.subtle)} />
            <h3 className={cn('text-lg font-semibold', theme.text.strong)}>Recent Activity</h3>
          </div>
          <Link
            href="/operation-logs"
            className={cn('text-sm font-medium transition-colors', theme.link.primary)}
          >
            View all
          </Link>
        </header>
        <div className="pt-6">
          {recentOperations.length === 0 ? (
            <p className={cn('py-4 text-center text-sm', theme.text.subtle)}>
              No recent operations
            </p>
          ) : (
            <div className="space-y-4">
              {recentOperations.slice(0, 5).map((operation) => (
                <div
                  key={operation.id}
                  className={cn(
                    'flex items-center justify-between rounded-lg border px-3 py-3',
                    theme.intent.neutral.border,
                    theme.intent.neutral.surface
                  )}
                >
                  <div className="flex items-center gap-3">
                    {getStatusIcon(operation)}
                    <div>
                      <div className={cn('text-sm font-medium', theme.text.strong)}>
                        {operation.command} on {operation.stack_name}
                      </div>
                      <div className={cn('text-xs', theme.text.subtle)}>
                        {operation.server_name} • {operation.formatted_date}
                      </div>
                    </div>
                  </div>
                  <div className={cn('text-xs', theme.text.subtle)}>
                    {getOperationDuration(operation)}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className={theme.containers.subtle}>
        <header className="flex items-center justify-between border-b border-slate-200/60 pb-4 dark:border-slate-700/60">
          <div className="flex items-center gap-2">
            <ExclamationTriangleIcon className={cn('h-5 w-5', theme.intent.danger.textStrong)} />
            <h3 className={cn('text-lg font-semibold', theme.text.strong)}>Failed Operations</h3>
          </div>
          <Link
            href="/operation-logs?status=failed"
            className={cn(
              'text-sm font-medium transition-colors',
              theme.text.danger,
              'hover:text-red-700 dark:hover:text-red-300'
            )}
          >
            View all
          </Link>
        </header>
        <div className="pt-6">
          {failedOperations.length === 0 ? (
            <div className="py-4 text-center">
              <CheckCircleIcon className={cn('h-12 w-12 mx-auto', theme.text.success)} />
              <p className={cn('mt-2 text-sm', theme.text.subtle)}>No recent failures</p>
            </div>
          ) : (
            <div className="space-y-4">
              {failedOperations.slice(0, 3).map((operation) => (
                <div
                  key={operation.id}
                  className={cn(
                    'flex items-center justify-between rounded-lg border px-3 py-3',
                    theme.intent.danger.border,
                    theme.intent.danger.surface
                  )}
                >
                  <div className="flex items-center gap-3">
                    <XCircleIcon className={cn('h-5 w-5', theme.text.danger)} />
                    <div>
                      <div className={cn('text-sm font-medium', theme.text.strong)}>
                        {operation.command} on {operation.stack_name}
                      </div>
                      <div className={cn('text-xs', theme.text.subtle)}>
                        {operation.server_name} • {operation.formatted_date}
                        {operation.exit_code !== null && (
                          <span className="ml-2">Exit: {operation.exit_code}</span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className={cn('text-xs', theme.text.subtle)}>
                    {getOperationDuration(operation)}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
