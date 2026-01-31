import React from 'react';
import { Link } from '@inertiajs/react';
import {
  ClockIcon,
  CheckCircleIcon,
  XCircleIcon,
  ExclamationTriangleIcon,
  ArrowPathIcon,
} from '@heroicons/react/24/outline';
import { cn } from '../../../utils/cn';
import { theme } from '../../../theme';
import { ActivitySummary } from '../hooks/useDashboardActivity';
import type { OperationLogInfo } from '../../../api/generated/models';
import { LoadingSpinner } from '../../common/LoadingSpinner';

interface ActivityPanelProps {
  activitySummary: ActivitySummary;
  onRefresh?: () => void;
}

const getStatusIcon = (operation: OperationLogInfo) => {
  if (operation.is_incomplete) {
    return <ExclamationTriangleIcon className={cn('h-5 w-5', 'text-amber-500')} />;
  }
  if (operation.success === true) {
    return <CheckCircleIcon className={cn('h-5 w-5', 'text-emerald-500')} />;
  }
  if (operation.success === false) {
    return <XCircleIcon className={cn('h-5 w-5', 'text-red-500')} />;
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

const getOperationDuration = (operation: OperationLogInfo) => {
  if (operation.duration_ms != null) {
    return formatDuration(operation.duration_ms, false);
  }
  if (operation.partial_duration_ms != null) {
    return formatDuration(operation.partial_duration_ms, true);
  }
  return 'N/A';
};

interface OperationRowProps {
  operation: OperationLogInfo;
  variant?: 'default' | 'error';
}

const OperationRow: React.FC<OperationRowProps> = ({ operation, variant = 'default' }) => (
  <div
    className={cn(
      'flex items-center justify-between px-4 py-3 rounded-lg border',
      variant === 'error'
        ? 'border-red-200 bg-red-50 dark:border-red-900/50 dark:bg-red-900/10'
        : 'border-zinc-200 bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-800/50'
    )}
  >
    <div className="flex items-center gap-3 min-w-0 flex-1">
      {getStatusIcon(operation)}
      <div className="min-w-0 flex-1">
        <div className={cn('text-sm font-medium truncate', theme.text.strong)}>
          <span className="font-mono">{operation.command}</span> on {operation.stack_name}
        </div>
        <div className={cn('text-xs', theme.text.subtle)}>
          {operation.server_name} · {operation.formatted_date}
          {operation.exit_code !== null && operation.success === false && (
            <span className="ml-2 text-red-500">Exit: {operation.exit_code}</span>
          )}
        </div>
      </div>
    </div>
    <div className={cn('text-xs font-mono tabular-nums', theme.text.subtle)}>
      {getOperationDuration(operation)}
    </div>
  </div>
);

export const ActivityPanel: React.FC<ActivityPanelProps> = ({ activitySummary, onRefresh }) => {
  const { recentOperations, failedOperations, loading, error } = activitySummary;

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center">
        <LoadingSpinner size="lg" text="Loading activity..." />
      </div>
    );
  }

  if (error) {
    return (
      <div className="h-full flex items-center justify-center p-6">
        <div className="text-center">
          <ExclamationTriangleIcon className={cn('w-12 h-12 mx-auto mb-4', theme.text.danger)} />
          <h3 className={cn('text-lg font-medium mb-2', theme.text.strong)}>
            Failed to load activity
          </h3>
          <p className={cn('text-sm mb-4', theme.text.muted)}>{error}</p>
          {onRefresh && (
            <button
              onClick={onRefresh}
              className={cn(
                'flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg mx-auto',
                'bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700',
                theme.text.strong,
                'transition-colors'
              )}
            >
              <ArrowPathIcon className="w-4 h-4" />
              Retry
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="h-full overflow-auto p-6">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h2 className={cn('text-xl font-bold', theme.text.strong)}>Activity</h2>
            <p className={cn('text-sm', theme.text.subtle)}>
              Recent operations and system activity
            </p>
          </div>
          <div className="flex items-center gap-2">
            {onRefresh && (
              <button
                onClick={onRefresh}
                className={cn(theme.buttons.icon, 'p-2')}
                title="Refresh activity"
              >
                <ArrowPathIcon className="w-4 h-4" />
              </button>
            )}
            <Link href="/operation-logs" className={cn('text-sm font-medium', theme.link.primary)}>
              View all logs
            </Link>
          </div>
        </div>

        {/* Failed Operations */}
        {failedOperations.length > 0 && (
          <div
            className={cn(
              'rounded-lg border',
              'border-red-200 dark:border-red-900/50',
              'bg-white dark:bg-zinc-900'
            )}
          >
            <div
              className={cn(
                'px-4 py-3 border-b flex items-center justify-between',
                'border-red-200 dark:border-red-900/50',
                'bg-red-50 dark:bg-red-900/10'
              )}
            >
              <div className="flex items-center gap-2">
                <XCircleIcon className="w-5 h-5 text-red-500" />
                <h3 className={cn('text-sm font-semibold', 'text-red-700 dark:text-red-400')}>
                  Failed Operations
                </h3>
              </div>
              <Link
                href="/operation-logs?status=failed"
                className="text-xs font-medium text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300"
              >
                View all
              </Link>
            </div>
            <div className="p-4 space-y-3">
              {failedOperations.slice(0, 5).map((operation) => (
                <OperationRow key={operation.id} operation={operation} variant="error" />
              ))}
            </div>
          </div>
        )}

        {/* Recent Operations */}
        <div
          className={cn(
            'rounded-lg border',
            'border-zinc-200 dark:border-zinc-800',
            'bg-white dark:bg-zinc-900'
          )}
        >
          <div
            className={cn(
              'px-4 py-3 border-b',
              'border-zinc-200 dark:border-zinc-800',
              theme.surface.muted
            )}
          >
            <div className="flex items-center gap-2">
              <ClockIcon className={cn('w-5 h-5', theme.text.subtle)} />
              <h3 className={cn('text-sm font-semibold', theme.text.strong)}>Recent Operations</h3>
            </div>
          </div>
          <div className="p-4">
            {recentOperations.length === 0 ? (
              <div className="py-8 text-center">
                <ClockIcon className={cn('w-12 h-12 mx-auto mb-2', theme.text.subtle)} />
                <p className={cn('text-sm', theme.text.muted)}>No recent operations</p>
              </div>
            ) : (
              <div className="space-y-3">
                {recentOperations.slice(0, 10).map((operation) => (
                  <OperationRow key={operation.id} operation={operation} />
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
