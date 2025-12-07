import React from 'react';
import {
  ChartBarIcon,
  ServerIcon,
  ShieldCheckIcon,
  ExclamationTriangleIcon,
  CheckCircleIcon,
  CubeIcon,
} from '@heroicons/react/24/outline';
import { cn } from '../../../utils/cn';
import { theme } from '../../../theme';
import { Server } from '../../../types/server';
import { HealthSummary } from '../types/dashboard';

interface OverviewPanelProps {
  servers: Server[];
  healthSummary: HealthSummary;
  userRoles: string[];
  onSelectServer: (serverId: number) => void;
  onSelectAlerts: () => void;
}

interface StatCardProps {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string | number;
  sublabel?: string;
  color: 'teal' | 'emerald' | 'amber' | 'blue' | 'red' | 'purple';
  onClick?: () => void;
}

const colorClasses = {
  teal: 'bg-teal-50 dark:bg-teal-900/20 text-teal-600 dark:text-teal-400',
  emerald: 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400',
  amber: 'bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400',
  blue: 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400',
  red: 'bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400',
  purple: 'bg-purple-50 dark:bg-purple-900/20 text-purple-600 dark:text-purple-400',
};

const StatCard: React.FC<StatCardProps> = ({
  icon: Icon,
  label,
  value,
  sublabel,
  color,
  onClick,
}) => (
  <div
    className={cn(
      'rounded-lg border p-4',
      'border-zinc-200 dark:border-zinc-800',
      'bg-white dark:bg-zinc-900',
      onClick && 'cursor-pointer hover:border-teal-300 dark:hover:border-teal-700 transition-colors'
    )}
    onClick={onClick}
  >
    <div className="flex items-center gap-3">
      <div
        className={cn('w-10 h-10 rounded-lg flex items-center justify-center', colorClasses[color])}
      >
        <Icon className="w-5 h-5" />
      </div>
      <div>
        <p className={cn('text-2xl font-bold tabular-nums', theme.text.strong)}>{value}</p>
        <p className={cn('text-xs', theme.text.muted)}>
          {label}
          {sublabel && <span className="ml-1 text-zinc-400">· {sublabel}</span>}
        </p>
      </div>
    </div>
  </div>
);

export const OverviewPanel: React.FC<OverviewPanelProps> = ({
  servers,
  healthSummary,
  userRoles,
  onSelectServer,
  onSelectAlerts,
}) => {
  const getAccessLevel = () => {
    const isAdmin = userRoles.includes('admin');
    if (isAdmin) return 'Full';
    if (userRoles.length === 0) return 'Limited';
    return userRoles.join(', ');
  };

  const onlineServers = servers.filter((s) => s.is_active);

  return (
    <div className="h-full overflow-auto p-6">
      <div className="max-w-5xl mx-auto space-y-6">
        {/* Header */}
        <div>
          <h2 className={cn('text-xl font-bold', theme.text.strong)}>Dashboard Overview</h2>
          <p className={cn('text-sm', theme.text.subtle)}>
            System health and infrastructure summary
          </p>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            icon={healthSummary.unhealthyStacks > 0 ? ExclamationTriangleIcon : CheckCircleIcon}
            label="Health Problems"
            value={healthSummary.unhealthyStacks}
            sublabel={
              healthSummary.unhealthyStacks > 0 ? 'stacks need attention' : 'all stacks healthy'
            }
            color={healthSummary.unhealthyStacks > 0 ? 'red' : 'emerald'}
            onClick={healthSummary.unhealthyStacks > 0 ? onSelectAlerts : undefined}
          />
          <StatCard
            icon={ChartBarIcon}
            label="Stack Health"
            value={`${healthSummary.healthyStacks}/${healthSummary.totalStacks}`}
            sublabel="healthy stacks"
            color={healthSummary.healthyStacks === healthSummary.totalStacks ? 'emerald' : 'amber'}
          />
          <StatCard
            icon={ServerIcon}
            label="Server Status"
            value={`${healthSummary.serversOnline}/${healthSummary.totalActiveServers}`}
            sublabel={
              healthSummary.totalOfflineServers > 0
                ? `${healthSummary.totalOfflineServers} offline`
                : healthSummary.serversLoading > 0
                  ? 'checking...'
                  : 'all reachable'
            }
            color={healthSummary.totalOfflineServers > 0 ? 'red' : 'emerald'}
          />
          <StatCard
            icon={ShieldCheckIcon}
            label="Your Access"
            value={getAccessLevel()}
            sublabel={`${userRoles.length} role${userRoles.length !== 1 ? 's' : ''}`}
            color="blue"
          />
        </div>

        {/* Server Quick Access */}
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
            <h3 className={cn('text-sm font-semibold', theme.text.strong)}>Quick Access</h3>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 p-4">
            {onlineServers.slice(0, 6).map((server) => (
              <button
                key={server.id}
                onClick={() => onSelectServer(server.id)}
                className={cn(
                  'flex items-center gap-3 p-3 rounded-lg',
                  'border border-zinc-200 dark:border-zinc-700',
                  'hover:border-teal-300 dark:hover:border-teal-700',
                  'hover:bg-zinc-50 dark:hover:bg-zinc-800/50',
                  'transition-colors text-left'
                )}
              >
                <div
                  className={cn(
                    'w-8 h-8 rounded-lg flex items-center justify-center',
                    'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400'
                  )}
                >
                  <ServerIcon className="w-4 h-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className={cn('font-medium truncate', theme.text.strong)}>{server.name}</p>
                  <p className={cn('text-xs truncate', theme.text.subtle)}>
                    {server.host}:{server.port}
                  </p>
                </div>
              </button>
            ))}
            {onlineServers.length === 0 && (
              <div className="col-span-full py-8 text-center">
                <CubeIcon className={cn('w-12 h-12 mx-auto mb-2', theme.text.subtle)} />
                <p className={cn('text-sm', theme.text.muted)}>No servers online</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
