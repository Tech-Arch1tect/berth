import { ClockIcon, ExclamationTriangleIcon } from '@heroicons/react/24/outline';
import { Link } from '@inertiajs/react';
import { ActivitySummary, RecentActivity } from './hooks/useDashboardActivity';

interface DashboardRecentActivityProps {
  activitySummary: ActivitySummary;
}

const getStatusIcon = (operation: RecentActivity) => {
  if (operation.is_incomplete) {
    return <span className="text-amber-500">⚠️</span>;
  }
  if (operation.success === true) {
    return <span className="text-green-500">✅</span>;
  }
  if (operation.success === false) {
    return <span className="text-red-500">❌</span>;
  }
  return <span className="text-gray-500">⏳</span>;
};

const formatDuration = (duration: number | null, isPartial: boolean = false) => {
  if (duration === null || duration === undefined || duration === 0) return 'N/A';
  if (duration < 0) return 'N/A';

  let formattedTime = '';
  if (duration < 1000) formattedTime = `${duration}ms`;
  else if (duration < 60000) formattedTime = `${(duration / 1000).toFixed(1)}s`;
  else formattedTime = `${(duration / 60000).toFixed(1)}m`;

  return isPartial ? `~${formattedTime}` : formattedTime;
};

const getOperationDuration = (operation: RecentActivity) => {
  if (operation.duration_ms !== null) {
    return formatDuration(operation.duration_ms, false);
  } else if (operation.partial_duration_ms !== null) {
    return formatDuration(operation.partial_duration_ms, true);
  }
  return 'N/A';
};

export const DashboardRecentActivity: React.FC<DashboardRecentActivityProps> = ({
  activitySummary,
}) => {
  const { recentOperations, failedOperations, loading, error } = activitySummary;

  if (loading) {
    return (
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
          <div className="animate-pulse">
            <div className="h-4 bg-gray-300 dark:bg-gray-600 rounded w-1/3 mb-4"></div>
            <div className="space-y-3">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="h-4 bg-gray-300 dark:bg-gray-600 rounded"></div>
              ))}
            </div>
          </div>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
          <div className="animate-pulse">
            <div className="h-4 bg-gray-300 dark:bg-gray-600 rounded w-1/3 mb-4"></div>
            <div className="space-y-3">
              {[...Array(2)].map((_, i) => (
                <div key={i} className="h-4 bg-gray-300 dark:bg-gray-600 rounded"></div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="mb-8 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800/50 rounded-xl">
        <div className="flex items-center space-x-3">
          <ExclamationTriangleIcon className="w-5 h-5 text-red-600 dark:text-red-400" />
          <p className="text-sm text-red-800 dark:text-red-200">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
      {/* Recent Activity Feed */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700">
        <div className="p-6 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <ClockIcon className="w-5 h-5 text-gray-600 dark:text-gray-400" />
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                Recent Activity
              </h3>
            </div>
            <Link
              href="/operation-logs"
              className="text-sm text-indigo-600 dark:text-indigo-400 hover:text-indigo-800 dark:hover:text-indigo-300"
            >
              View all
            </Link>
          </div>
        </div>
        <div className="p-6">
          {recentOperations.length === 0 ? (
            <p className="text-sm text-gray-500 dark:text-gray-400 text-center py-4">
              No recent operations
            </p>
          ) : (
            <div className="space-y-4">
              {recentOperations.slice(0, 5).map((operation) => (
                <div
                  key={operation.id}
                  className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg"
                >
                  <div className="flex items-center space-x-3">
                    {getStatusIcon(operation)}
                    <div>
                      <div className="text-sm font-medium text-gray-900 dark:text-white">
                        {operation.command} on {operation.stack_name}
                      </div>
                      <div className="text-xs text-gray-500 dark:text-gray-400">
                        {operation.server_name} • {operation.formatted_date}
                      </div>
                    </div>
                  </div>
                  <div className="text-xs text-gray-500 dark:text-gray-400">
                    {getOperationDuration(operation)}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Failed Operations Panel */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700">
        <div className="p-6 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <ExclamationTriangleIcon className="w-5 h-5 text-red-600 dark:text-red-400" />
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                Failed Operations
              </h3>
            </div>
            <Link
              href="/operation-logs?status=failed"
              className="text-sm text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-300"
            >
              View all
            </Link>
          </div>
        </div>
        <div className="p-6">
          {failedOperations.length === 0 ? (
            <div className="text-center py-4">
              <span className="text-green-500 text-2xl">✅</span>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">No recent failures</p>
            </div>
          ) : (
            <div className="space-y-4">
              {failedOperations.slice(0, 3).map((operation) => (
                <div
                  key={operation.id}
                  className="flex items-center justify-between p-3 bg-red-50 dark:bg-red-900/20 rounded-lg border border-red-200 dark:border-red-800/50"
                >
                  <div className="flex items-center space-x-3">
                    <span className="text-red-500">❌</span>
                    <div>
                      <div className="text-sm font-medium text-gray-900 dark:text-white">
                        {operation.command} on {operation.stack_name}
                      </div>
                      <div className="text-xs text-gray-500 dark:text-gray-400">
                        {operation.server_name} • {operation.formatted_date}
                        {operation.exit_code !== null && (
                          <span className="ml-2">Exit: {operation.exit_code}</span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="text-xs text-gray-500 dark:text-gray-400">
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
