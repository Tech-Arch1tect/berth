import React from 'react';
import { Link } from '@inertiajs/react';
import {
  ExclamationTriangleIcon,
  CheckCircleIcon,
  ServerIcon,
  CubeIcon,
  NoSymbolIcon,
} from '@heroicons/react/24/outline';
import { cn } from '../../../utils/cn';
import { theme } from '../../../theme';
import { Server } from '../../../types/server';
import { HealthSummary } from '../types/dashboard';

interface AlertsPanelProps {
  servers: Server[];
  healthSummary: HealthSummary;
  serverStats: Map<number, { total: number; healthy: number; unhealthy: number }>;
  onSelectServer: (serverId: number) => void;
}

interface AlertCardProps {
  icon: React.ReactNode;
  title: string;
  description: string;
  severity: 'error' | 'warning' | 'info';
  action?: React.ReactNode;
}

const severityStyles = {
  error: {
    border: 'border-red-200 dark:border-red-900/50',
    bg: 'bg-red-50 dark:bg-red-900/10',
    iconBg: 'bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400',
  },
  warning: {
    border: 'border-amber-200 dark:border-amber-900/50',
    bg: 'bg-amber-50 dark:bg-amber-900/10',
    iconBg: 'bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400',
  },
  info: {
    border: 'border-blue-200 dark:border-blue-900/50',
    bg: 'bg-blue-50 dark:bg-blue-900/10',
    iconBg: 'bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400',
  },
};

const AlertCard: React.FC<AlertCardProps> = ({ icon, title, description, severity, action }) => {
  const styles = severityStyles[severity];

  return (
    <div className={cn('rounded-lg border p-4', styles.border, styles.bg)}>
      <div className="flex items-start gap-3">
        <div className={cn('w-10 h-10 rounded-lg flex items-center justify-center', styles.iconBg)}>
          {icon}
        </div>
        <div className="flex-1 min-w-0">
          <h4 className={cn('font-medium', theme.text.strong)}>{title}</h4>
          <p className={cn('text-sm mt-0.5', theme.text.muted)}>{description}</p>
          {action && <div className="mt-3">{action}</div>}
        </div>
      </div>
    </div>
  );
};

export const AlertsPanel: React.FC<AlertsPanelProps> = ({
  servers,
  healthSummary,
  serverStats,
  onSelectServer,
}) => {
  const offlineServers = servers.filter((s) => !s.is_active);
  const serversWithUnhealthyStacks = servers.filter((s) => {
    const stats = serverStats.get(s.id);
    return stats && stats.unhealthy > 0;
  });

  const hasAlerts =
    healthSummary.unhealthyStacks > 0 ||
    healthSummary.totalOfflineServers > 0 ||
    offlineServers.length > 0;

  return (
    <div className="h-full overflow-auto p-6">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <div>
          <h2 className={cn('text-xl font-bold', theme.text.strong)}>Alerts</h2>
          <p className={cn('text-sm', theme.text.subtle)}>Health problems and system warnings</p>
        </div>

        {/* No Alerts State */}
        {!hasAlerts && (
          <div
            className={cn(
              'rounded-lg border p-8 text-center',
              'border-emerald-200 dark:border-emerald-900/50',
              'bg-emerald-50 dark:bg-emerald-900/10'
            )}
          >
            <CheckCircleIcon className="w-16 h-16 mx-auto mb-4 text-emerald-500" />
            <h3 className={cn('text-lg font-semibold mb-2', theme.text.strong)}>
              All Systems Healthy
            </h3>
            <p className={cn('text-sm', theme.text.muted)}>
              No alerts or warnings at this time. All servers are online and stacks are healthy.
            </p>
          </div>
        )}

        {/* Offline Servers */}
        {offlineServers.length > 0 && (
          <div className="space-y-3">
            <h3 className={cn('text-sm font-semibold flex items-center gap-2', theme.text.strong)}>
              <NoSymbolIcon className="w-4 h-4 text-red-500" />
              Offline Servers ({offlineServers.length})
            </h3>
            {offlineServers.map((server) => (
              <AlertCard
                key={server.id}
                icon={<ServerIcon className="w-5 h-5" />}
                title={server.name}
                description={`Server at ${server.host}:${server.port} is unreachable`}
                severity="error"
                action={
                  <button
                    onClick={() => onSelectServer(server.id)}
                    className={cn(
                      'text-sm font-medium',
                      'text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300'
                    )}
                  >
                    View details
                  </button>
                }
              />
            ))}
          </div>
        )}

        {/* Unhealthy Stacks */}
        {serversWithUnhealthyStacks.length > 0 && (
          <div className="space-y-3">
            <h3 className={cn('text-sm font-semibold flex items-center gap-2', theme.text.strong)}>
              <ExclamationTriangleIcon className="w-4 h-4 text-amber-500" />
              Servers with Unhealthy Stacks ({serversWithUnhealthyStacks.length})
            </h3>
            {serversWithUnhealthyStacks.map((server) => {
              const stats = serverStats.get(server.id);
              return (
                <AlertCard
                  key={server.id}
                  icon={<CubeIcon className="w-5 h-5" />}
                  title={server.name}
                  description={`${stats?.unhealthy || 0} of ${stats?.total || 0} stacks need attention`}
                  severity="warning"
                  action={
                    <Link
                      href={`/servers/${server.id}/stacks`}
                      className={cn(
                        'text-sm font-medium',
                        'text-amber-600 hover:text-amber-700 dark:text-amber-400 dark:hover:text-amber-300'
                      )}
                    >
                      Manage stacks
                    </Link>
                  }
                />
              );
            })}
          </div>
        )}

        {/* Summary */}
        {hasAlerts && (
          <div
            className={cn(
              'rounded-lg border p-4',
              'border-zinc-200 dark:border-zinc-800',
              'bg-white dark:bg-zinc-900'
            )}
          >
            <h3 className={cn('text-sm font-semibold mb-3', theme.text.strong)}>Summary</h3>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-center">
              <div>
                <p className={cn('text-2xl font-bold', theme.text.strong)}>
                  {healthSummary.totalStacks}
                </p>
                <p className={cn('text-xs', theme.text.muted)}>Total Stacks</p>
              </div>
              <div>
                <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">
                  {healthSummary.healthyStacks}
                </p>
                <p className={cn('text-xs', theme.text.muted)}>Healthy</p>
              </div>
              <div>
                <p
                  className={cn(
                    'text-2xl font-bold',
                    healthSummary.unhealthyStacks > 0
                      ? 'text-red-600 dark:text-red-400'
                      : theme.text.strong
                  )}
                >
                  {healthSummary.unhealthyStacks}
                </p>
                <p className={cn('text-xs', theme.text.muted)}>Unhealthy</p>
              </div>
              <div>
                <p
                  className={cn(
                    'text-2xl font-bold',
                    healthSummary.totalOfflineServers > 0
                      ? 'text-red-600 dark:text-red-400'
                      : theme.text.strong
                  )}
                >
                  {healthSummary.totalOfflineServers}
                </p>
                <p className={cn('text-xs', theme.text.muted)}>Offline Servers</p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
