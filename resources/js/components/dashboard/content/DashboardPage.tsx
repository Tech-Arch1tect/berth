import React, { useRef, useEffect, useState } from 'react';
import { Link } from '@inertiajs/react';
import {
  ChartBarIcon,
  ServerIcon,
  ShieldCheckIcon,
  ExclamationTriangleIcon,
  CheckCircleIcon,
  ClockIcon,
  XCircleIcon,
  CubeIcon,
  ArrowTopRightOnSquareIcon,
  NoSymbolIcon,
} from '@heroicons/react/24/outline';
import { cn } from '../../../utils/cn';
import { theme } from '../../../theme';
import { Server } from '../../../types/server';
import { HealthSummary } from '../types/dashboard';
import { ActivitySummary, RecentActivity } from '../hooks/useDashboardActivity';
import { useServerStatistics } from '../../../hooks/useServerStatistics';
import { LoadingSpinner } from '../../common/LoadingSpinner';

interface DashboardPageProps {
  servers: Server[];
  healthSummary: HealthSummary;
  activitySummary: ActivitySummary;
  userRoles: string[];
  serverStats: Map<number, { total: number; healthy: number; unhealthy: number }>;
  onSectionChange?: (sectionId: string) => void;
}

export const SECTION_IDS = {
  overview: 'dashboard-overview',
  activity: 'dashboard-activity',
  alerts: 'dashboard-alerts',
  server: (id: number) => `dashboard-server-${id}`,
};

interface StatCardProps {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string | number;
  sublabel?: string;
  color: 'teal' | 'emerald' | 'amber' | 'blue' | 'red' | 'purple';
}

const colorClasses = {
  teal: 'bg-teal-50 dark:bg-teal-900/20 text-teal-600 dark:text-teal-400',
  emerald: 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400',
  amber: 'bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400',
  blue: 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400',
  red: 'bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400',
  purple: 'bg-purple-50 dark:bg-purple-900/20 text-purple-600 dark:text-purple-400',
};

const StatCard: React.FC<StatCardProps> = ({ icon: Icon, label, value, sublabel, color }) => (
  <div
    className={cn(
      'rounded-lg border p-4',
      'border-zinc-200 dark:border-zinc-800',
      'bg-white dark:bg-zinc-900'
    )}
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

const getStatusIcon = (operation: RecentActivity) => {
  if (operation.is_incomplete) {
    return <ExclamationTriangleIcon className="h-4 w-4 text-amber-500" />;
  }
  if (operation.success === true) {
    return <CheckCircleIcon className="h-4 w-4 text-emerald-500" />;
  }
  if (operation.success === false) {
    return <XCircleIcon className="h-4 w-4 text-red-500" />;
  }
  return <ClockIcon className={cn('h-4 w-4', theme.text.subtle)} />;
};

const formatDuration = (duration: number | null, isPartial = false) => {
  if (!duration || duration <= 0) return null;
  let formatted = '';
  if (duration < 1000) formatted = `${duration}ms`;
  else if (duration < 60000) formatted = `${(duration / 1000).toFixed(1)}s`;
  else formatted = `${(duration / 60000).toFixed(1)}m`;
  return isPartial ? `~${formatted}` : formatted;
};

const ServerSection: React.FC<{ server: Server }> = ({ server }) => {
  const { data: statistics, isLoading, error } = useServerStatistics(server.id);
  const isOnline = server.is_active;

  return (
    <section
      id={SECTION_IDS.server(server.id)}
      className={cn(
        'rounded-lg border',
        'border-zinc-200 dark:border-zinc-800',
        'bg-white dark:bg-zinc-900',
        'scroll-mt-4'
      )}
    >
      {/* Server Header */}
      <div
        className={cn(
          'px-4 py-3 border-b flex items-center justify-between',
          'border-zinc-200 dark:border-zinc-800',
          theme.surface.muted
        )}
      >
        <div className="flex items-center gap-3">
          <div
            className={cn(
              'w-8 h-8 rounded-lg flex items-center justify-center',
              isOnline
                ? 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400'
                : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-400'
            )}
          >
            <ServerIcon className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className={cn('font-semibold', theme.text.strong)}>{server.name}</h3>
              <span
                className={cn(
                  'px-1.5 py-0.5 text-xs font-medium rounded',
                  isOnline
                    ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'
                    : 'bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400'
                )}
              >
                {isOnline ? 'Online' : 'Offline'}
              </span>
            </div>
            <p className={cn('text-xs font-mono', theme.text.subtle)}>
              {server.host}:{server.port}
            </p>
          </div>
        </div>
        <Link
          href={`/servers/${server.id}/stacks`}
          className={cn(
            'flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-lg',
            'bg-teal-50 text-teal-700 hover:bg-teal-100',
            'dark:bg-teal-900/20 dark:text-teal-400 dark:hover:bg-teal-900/30',
            'transition-colors'
          )}
        >
          View Stacks
          <ArrowTopRightOnSquareIcon className="w-3.5 h-3.5" />
        </Link>
      </div>

      {/* Server Content */}
      <div className="p-4">
        {!isOnline ? (
          <div className="flex items-center gap-3 py-4">
            <NoSymbolIcon className={cn('w-5 h-5', theme.text.subtle)} />
            <span className={cn('text-sm', theme.text.muted)}>
              Server is offline or unreachable
            </span>
          </div>
        ) : isLoading ? (
          <div className="py-4 flex justify-center">
            <LoadingSpinner size="sm" text="Loading statistics..." />
          </div>
        ) : error ? (
          <div className="flex items-center gap-3 py-4">
            <ExclamationTriangleIcon className={cn('w-5 h-5', theme.text.danger)} />
            <span className={cn('text-sm', theme.text.danger)}>Failed to load statistics</span>
          </div>
        ) : statistics ? (
          <div className="grid grid-cols-3 gap-4">
            <div className="text-center p-3 rounded-lg bg-zinc-50 dark:bg-zinc-800">
              <p className={cn('text-xl font-bold', theme.text.strong)}>
                {statistics.total_stacks}
              </p>
              <p className={cn('text-xs', theme.text.muted)}>Total Stacks</p>
            </div>
            <div className="text-center p-3 rounded-lg bg-emerald-50 dark:bg-emerald-900/20">
              <p className="text-xl font-bold text-emerald-600 dark:text-emerald-400">
                {statistics.healthy_stacks}
              </p>
              <p className={cn('text-xs', theme.text.muted)}>Healthy</p>
            </div>
            <div
              className={cn(
                'text-center p-3 rounded-lg',
                statistics.unhealthy_stacks > 0
                  ? 'bg-red-50 dark:bg-red-900/20'
                  : 'bg-zinc-50 dark:bg-zinc-800'
              )}
            >
              <p
                className={cn(
                  'text-xl font-bold',
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
        ) : null}
      </div>
    </section>
  );
};

export const DashboardPage: React.FC<DashboardPageProps> = ({
  servers,
  healthSummary,
  activitySummary,
  userRoles,
  serverStats,
  onSectionChange,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [activeSection, setActiveSection] = useState<string>(SECTION_IDS.overview);

  const getAccessLevel = () => {
    const isAdmin = userRoles.includes('admin');
    if (isAdmin) return 'Full';
    if (userRoles.length === 0) return 'Limited';
    return userRoles.join(', ');
  };

  const onlineServers = servers.filter((s) => s.is_active);
  const offlineServers = servers.filter((s) => !s.is_active);
  const { recentOperations, failedOperations, loading: activityLoading } = activitySummary;

  const serversWithUnhealthyStacks = servers.filter((s) => {
    const stats = serverStats.get(s.id);
    return stats && stats.unhealthy > 0;
  });

  const hasAlerts =
    healthSummary.unhealthyStacks > 0 ||
    healthSummary.totalOfflineServers > 0 ||
    offlineServers.length > 0;

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleScroll = () => {
      const sections = container.querySelectorAll('[id^="dashboard-"]');
      let current = SECTION_IDS.overview;

      sections.forEach((section) => {
        const rect = section.getBoundingClientRect();
        const containerRect = container.getBoundingClientRect();

        if (rect.top <= containerRect.top + 100) {
          current = section.id;
        }
      });

      if (current !== activeSection) {
        setActiveSection(current);
        onSectionChange?.(current);
      }
    };

    container.addEventListener('scroll', handleScroll);
    return () => container.removeEventListener('scroll', handleScroll);
  }, [activeSection, onSectionChange]);

  return (
    <div ref={containerRef} className="h-full overflow-auto">
      <div className="p-6 space-y-6">
        {/* Overview Section */}
        <section id={SECTION_IDS.overview} className="scroll-mt-4">
          <div className="mb-4">
            <h2 className={cn('text-lg font-bold', theme.text.strong)}>Overview</h2>
            <p className={cn('text-sm', theme.text.subtle)}>
              System health and infrastructure summary
            </p>
          </div>

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard
              icon={healthSummary.unhealthyStacks > 0 ? ExclamationTriangleIcon : CheckCircleIcon}
              label="Health Problems"
              value={healthSummary.unhealthyStacks}
              sublabel={
                healthSummary.unhealthyStacks > 0 ? 'stacks need attention' : 'all stacks healthy'
              }
              color={healthSummary.unhealthyStacks > 0 ? 'red' : 'emerald'}
            />
            <StatCard
              icon={ChartBarIcon}
              label="Stack Health"
              value={`${healthSummary.healthyStacks}/${healthSummary.totalStacks}`}
              sublabel="healthy stacks"
              color={
                healthSummary.healthyStacks === healthSummary.totalStacks ? 'emerald' : 'amber'
              }
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
        </section>

        {/* Alerts Section */}
        <section id={SECTION_IDS.alerts} className="scroll-mt-4">
          <div className="mb-4">
            <h2 className={cn('text-lg font-bold', theme.text.strong)}>Alerts</h2>
            <p className={cn('text-sm', theme.text.subtle)}>Health problems and system warnings</p>
          </div>

          {!hasAlerts ? (
            <div
              className={cn(
                'rounded-lg border p-6 text-center',
                'border-emerald-200 dark:border-emerald-900/50',
                'bg-emerald-50 dark:bg-emerald-900/10'
              )}
            >
              <CheckCircleIcon className="w-10 h-10 mx-auto mb-2 text-emerald-500" />
              <h3 className={cn('font-semibold', theme.text.strong)}>All Systems Healthy</h3>
              <p className={cn('text-sm', theme.text.muted)}>No alerts or warnings at this time</p>
            </div>
          ) : (
            <div className="space-y-3">
              {offlineServers.map((server) => (
                <div
                  key={server.id}
                  className={cn(
                    'rounded-lg border p-4',
                    'border-red-200 dark:border-red-900/50',
                    'bg-red-50 dark:bg-red-900/10'
                  )}
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400">
                      <ServerIcon className="w-4 h-4" />
                    </div>
                    <div className="flex-1">
                      <h4 className={cn('font-medium', theme.text.strong)}>{server.name}</h4>
                      <p className={cn('text-sm', theme.text.muted)}>
                        Server at {server.host}:{server.port} is unreachable
                      </p>
                    </div>
                  </div>
                </div>
              ))}
              {serversWithUnhealthyStacks.map((server) => {
                const stats = serverStats.get(server.id);
                return (
                  <div
                    key={`unhealthy-${server.id}`}
                    className={cn(
                      'rounded-lg border p-4',
                      'border-amber-200 dark:border-amber-900/50',
                      'bg-amber-50 dark:bg-amber-900/10'
                    )}
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400">
                        <CubeIcon className="w-4 h-4" />
                      </div>
                      <div className="flex-1">
                        <h4 className={cn('font-medium', theme.text.strong)}>{server.name}</h4>
                        <p className={cn('text-sm', theme.text.muted)}>
                          {stats?.unhealthy || 0} of {stats?.total || 0} stacks need attention
                        </p>
                      </div>
                      <Link
                        href={`/servers/${server.id}/stacks`}
                        className="text-sm font-medium text-amber-600 hover:text-amber-700 dark:text-amber-400"
                      >
                        Manage stacks
                      </Link>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {/* Activity Section */}
        <section id={SECTION_IDS.activity} className="scroll-mt-4">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h2 className={cn('text-lg font-bold', theme.text.strong)}>Recent Activity</h2>
              <p className={cn('text-sm', theme.text.subtle)}>Operations and system events</p>
            </div>
            <Link href="/operation-logs" className={cn('text-sm font-medium', theme.link.primary)}>
              View all logs
            </Link>
          </div>

          {activityLoading ? (
            <div className="py-8 flex justify-center">
              <LoadingSpinner size="md" text="Loading activity..." />
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
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
                    'px-4 py-2.5 border-b flex items-center gap-2',
                    'border-zinc-200 dark:border-zinc-800',
                    theme.surface.muted
                  )}
                >
                  <ClockIcon className={cn('w-4 h-4', theme.text.subtle)} />
                  <span className={cn('text-sm font-medium', theme.text.strong)}>Recent</span>
                </div>
                <div className="p-3">
                  {recentOperations.length === 0 ? (
                    <p className={cn('text-sm text-center py-4', theme.text.muted)}>
                      No recent operations
                    </p>
                  ) : (
                    <div className="space-y-2">
                      {recentOperations.slice(0, 8).map((op) => (
                        <div
                          key={op.id}
                          className={cn(
                            'flex items-center gap-2 px-2 py-1.5 rounded',
                            'bg-zinc-50 dark:bg-zinc-800/50'
                          )}
                        >
                          {getStatusIcon(op)}
                          <div className="flex-1 min-w-0">
                            <span className={cn('text-sm font-mono', theme.text.strong)}>
                              {op.command}
                            </span>
                            <span className={cn('text-sm mx-1', theme.text.muted)}>on</span>
                            <span className={cn('text-sm', theme.text.strong)}>
                              {op.stack_name}
                            </span>
                          </div>
                          <span className={cn('text-xs', theme.text.subtle)}>
                            {formatDuration(op.duration_ms) || op.formatted_date}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Failed Operations */}
              <div
                className={cn(
                  'rounded-lg border',
                  failedOperations.length > 0
                    ? 'border-red-200 dark:border-red-900/50'
                    : 'border-zinc-200 dark:border-zinc-800',
                  'bg-white dark:bg-zinc-900'
                )}
              >
                <div
                  className={cn(
                    'px-4 py-2.5 border-b flex items-center gap-2',
                    failedOperations.length > 0
                      ? 'border-red-200 dark:border-red-900/50 bg-red-50 dark:bg-red-900/10'
                      : 'border-zinc-200 dark:border-zinc-800',
                    failedOperations.length === 0 && theme.surface.muted
                  )}
                >
                  <XCircleIcon
                    className={cn(
                      'w-4 h-4',
                      failedOperations.length > 0 ? 'text-red-500' : theme.text.subtle
                    )}
                  />
                  <span
                    className={cn(
                      'text-sm font-medium',
                      failedOperations.length > 0
                        ? 'text-red-700 dark:text-red-400'
                        : theme.text.strong
                    )}
                  >
                    Failed
                  </span>
                  {failedOperations.length > 0 && (
                    <span className="px-1.5 py-0.5 text-xs font-medium rounded bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400">
                      {failedOperations.length}
                    </span>
                  )}
                </div>
                <div className="p-3">
                  {failedOperations.length === 0 ? (
                    <div className="text-center py-4">
                      <CheckCircleIcon className={cn('w-8 h-8 mx-auto mb-1', theme.text.success)} />
                      <p className={cn('text-sm', theme.text.muted)}>No recent failures</p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {failedOperations.slice(0, 5).map((op) => (
                        <div
                          key={op.id}
                          className="flex items-center gap-2 px-2 py-1.5 rounded bg-red-50 dark:bg-red-900/10"
                        >
                          <XCircleIcon className="h-4 w-4 text-red-500 flex-shrink-0" />
                          <div className="flex-1 min-w-0">
                            <span className={cn('text-sm font-mono', theme.text.strong)}>
                              {op.command}
                            </span>
                            <span className={cn('text-sm mx-1', theme.text.muted)}>on</span>
                            <span className={cn('text-sm', theme.text.strong)}>
                              {op.stack_name}
                            </span>
                          </div>
                          <span className={cn('text-xs', theme.text.subtle)}>
                            {op.formatted_date}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </section>

        {/* Servers Section */}
        <section className="scroll-mt-4">
          <div className="mb-4">
            <h2 className={cn('text-lg font-bold', theme.text.strong)}>Servers</h2>
            <p className={cn('text-sm', theme.text.subtle)}>
              {onlineServers.length} online, {offlineServers.length} offline
            </p>
          </div>

          <div className="space-y-4">
            {servers.map((server) => (
              <ServerSection key={server.id} server={server} />
            ))}

            {servers.length === 0 && (
              <div
                className={cn(
                  'rounded-lg border p-8 text-center',
                  'border-zinc-200 dark:border-zinc-800',
                  'bg-white dark:bg-zinc-900'
                )}
              >
                <ServerIcon className={cn('w-12 h-12 mx-auto mb-3', theme.text.subtle)} />
                <h3 className={cn('font-semibold mb-1', theme.text.strong)}>
                  No Servers Configured
                </h3>
                <p className={cn('text-sm', theme.text.muted)}>
                  Add a server to start managing your Docker stacks
                </p>
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  );
};
