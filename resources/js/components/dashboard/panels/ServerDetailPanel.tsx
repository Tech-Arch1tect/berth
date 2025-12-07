import React from 'react';
import { Link } from '@inertiajs/react';
import {
  ServerIcon,
  CubeIcon,
  ExclamationTriangleIcon,
  ArrowTopRightOnSquareIcon,
  WifiIcon,
  NoSymbolIcon,
} from '@heroicons/react/24/outline';
import { cn } from '../../../utils/cn';
import { theme } from '../../../theme';
import { Server } from '../../../types/server';
import { useServerStatistics } from '../../../hooks/useServerStatistics';
import { LoadingSpinner } from '../../common/LoadingSpinner';

interface ServerDetailPanelProps {
  server: Server;
}

export const ServerDetailPanel: React.FC<ServerDetailPanelProps> = ({ server }) => {
  const {
    data: statistics,
    isLoading: statisticsLoading,
    error: statisticsError,
  } = useServerStatistics(server.id);

  const isOnline = server.is_active;

  return (
    <div className="h-full overflow-auto p-6">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Server Header */}
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-4">
            <div
              className={cn(
                'w-12 h-12 rounded-lg flex items-center justify-center',
                isOnline
                  ? 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400'
                  : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-400'
              )}
            >
              <ServerIcon className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-3">
                <h2 className={cn('text-xl font-bold', theme.text.strong)}>{server.name}</h2>
                <span
                  className={cn(
                    'px-2 py-0.5 text-xs font-medium rounded-full',
                    isOnline
                      ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'
                      : 'bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400'
                  )}
                >
                  {isOnline ? 'Online' : 'Offline'}
                </span>
              </div>
              <p className={cn('text-sm font-mono', theme.text.subtle)}>
                {server.host}:{server.port}
              </p>
            </div>
          </div>
          <Link
            href={`/servers/${server.id}/stacks`}
            className={cn(
              'flex items-center gap-2 px-3 py-1.5 text-sm font-medium rounded-lg',
              'bg-teal-50 text-teal-700 hover:bg-teal-100',
              'dark:bg-teal-900/20 dark:text-teal-400 dark:hover:bg-teal-900/30',
              'transition-colors'
            )}
          >
            View Stacks
            <ArrowTopRightOnSquareIcon className="w-4 h-4" />
          </Link>
        </div>

        {/* Connection Status */}
        <div
          className={cn(
            'rounded-lg border p-4',
            'border-zinc-200 dark:border-zinc-800',
            'bg-white dark:bg-zinc-900'
          )}
        >
          <div className="flex items-center gap-3">
            {isOnline ? (
              <>
                <div className="w-3 h-3 bg-emerald-500 rounded-full animate-pulse" />
                <WifiIcon className={cn('w-5 h-5', 'text-emerald-600 dark:text-emerald-400')} />
                <span className={cn('text-sm', theme.text.strong)}>Connected and responding</span>
              </>
            ) : (
              <>
                <div className="w-3 h-3 bg-zinc-400 rounded-full" />
                <NoSymbolIcon className={cn('w-5 h-5', theme.text.subtle)} />
                <span className={cn('text-sm', theme.text.muted)}>
                  Server is offline or unreachable
                </span>
              </>
            )}
          </div>
        </div>

        {/* Statistics */}
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
            <h3 className={cn('text-sm font-semibold', theme.text.strong)}>Stack Statistics</h3>
          </div>
          <div className="p-4">
            {statisticsLoading ? (
              <div className="py-8 flex justify-center">
                <LoadingSpinner size="md" text="Loading statistics..." />
              </div>
            ) : statisticsError ? (
              <div className="py-8 text-center">
                <ExclamationTriangleIcon
                  className={cn('w-8 h-8 mx-auto mb-2', theme.text.danger)}
                />
                <p className={cn('text-sm', theme.text.danger)}>Failed to load statistics</p>
              </div>
            ) : statistics ? (
              <div className="grid grid-cols-3 gap-4">
                <div className="text-center p-4 rounded-lg bg-zinc-50 dark:bg-zinc-800">
                  <p className={cn('text-3xl font-bold', theme.text.strong)}>
                    {statistics.total_stacks}
                  </p>
                  <p className={cn('text-xs', theme.text.muted)}>Total Stacks</p>
                </div>
                <div className="text-center p-4 rounded-lg bg-emerald-50 dark:bg-emerald-900/20">
                  <p className="text-3xl font-bold text-emerald-600 dark:text-emerald-400">
                    {statistics.healthy_stacks}
                  </p>
                  <p className={cn('text-xs', theme.text.muted)}>Healthy</p>
                </div>
                <div
                  className={cn(
                    'text-center p-4 rounded-lg',
                    statistics.unhealthy_stacks > 0
                      ? 'bg-red-50 dark:bg-red-900/20'
                      : 'bg-zinc-50 dark:bg-zinc-800'
                  )}
                >
                  <p
                    className={cn(
                      'text-3xl font-bold',
                      statistics.unhealthy_stacks > 0
                        ? 'text-red-600 dark:text-red-400'
                        : theme.text.strong
                    )}
                  >
                    {statistics.unhealthy_stacks}
                  </p>
                  <p className={cn('text-xs', theme.text.muted)}>Unhealthy</p>
                </div>
              </div>
            ) : (
              <div className="py-8 text-center">
                <CubeIcon className={cn('w-8 h-8 mx-auto mb-2', theme.text.subtle)} />
                <p className={cn('text-sm', theme.text.muted)}>No statistics available</p>
              </div>
            )}
          </div>
        </div>

        {/* Actions */}
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
            <h3 className={cn('text-sm font-semibold', theme.text.strong)}>Quick Actions</h3>
          </div>
          <div className="p-4 flex flex-wrap gap-3">
            <Link
              href={`/servers/${server.id}/stacks`}
              className={cn(
                'flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg',
                'bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700',
                theme.text.strong,
                'transition-colors'
              )}
            >
              <CubeIcon className="w-4 h-4" />
              Manage Stacks
            </Link>
            <Link
              href={`/servers/${server.id}/maintenance`}
              className={cn(
                'flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg',
                'bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700',
                theme.text.strong,
                'transition-colors'
              )}
            >
              Maintenance
            </Link>
            <Link
              href={`/servers/${server.id}/registries`}
              className={cn(
                'flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg',
                'bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700',
                theme.text.strong,
                'transition-colors'
              )}
            >
              Registries
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
};
