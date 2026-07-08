import React, { useRef, useEffect, useState } from 'react';
import { Link } from '@tanstack/react-router';
import {
  ServerIcon,
  ExclamationTriangleIcon,
  CheckCircleIcon,
  XCircleIcon,
  ClockIcon,
  ChevronDownIcon,
  ChevronRightIcon,
  ArrowPathIcon,
  ArrowRightIcon,
  NoSymbolIcon,
} from '@heroicons/react/24/outline';
import { cn } from '../../../../shared/utils/cn';
import { theme } from '../../../../shared/theme';
import { Server } from '../../../../shared/types/server';
import { ActivitySummary } from '../../hooks/useDashboardActivity';
import type { OperationLogInfo } from '../../../../api/generated/models';
import { ServerStatus, SERVER_STATUS_LABEL } from '../../../../shared/utils/serverStatus';
import { ServerStatusDot } from '../../../../shared/components/ServerStatusBadge';

interface DashboardPageProps {
  servers: Server[];
  activitySummary: ActivitySummary;
  serverStats: Map<number, { total: number; healthy: number; unhealthy: number }>;
  serverStatus: Map<number, ServerStatus>;
  onSectionChange?: (sectionId: string) => void;
}

export const SECTION_IDS = {
  attention: 'dashboard-attention',
  servers: 'dashboard-servers',
  activity: 'dashboard-activity',
};

const operationIcon = (operation: OperationLogInfo) => {
  if (operation.is_incomplete) {
    return <ExclamationTriangleIcon className="h-4 w-4 flex-shrink-0 text-amber-500" />;
  }
  if (operation.success === true) {
    return <CheckCircleIcon className="h-4 w-4 flex-shrink-0 text-emerald-500" />;
  }
  if (operation.success === false) {
    return <XCircleIcon className="h-4 w-4 flex-shrink-0 text-red-500" />;
  }
  return <ClockIcon className={cn('h-4 w-4 flex-shrink-0', theme.text.subtle)} />;
};

const formatDuration = (duration: number | null) => {
  if (!duration || duration <= 0) return null;
  if (duration < 1000) return `${duration}ms`;
  if (duration < 60000) return `${(duration / 1000).toFixed(1)}s`;
  return `${(duration / 60000).toFixed(1)}m`;
};

const SectionHeading: React.FC<{
  id: string;
  title: string;
  count?: number;
  action?: React.ReactNode;
}> = ({ id, title, count, action }) => (
  <div id={id} className="scroll-mt-4 flex items-center justify-between mb-2">
    <h2 className={cn('text-sm font-bold uppercase tracking-wider', theme.text.subtle)}>
      {title}
      {count !== undefined && count > 0 && <span className="ml-2 tabular-nums">{count}</span>}
    </h2>
    {action}
  </div>
);

const attentionRowClass = cn(
  'group flex items-center gap-3 px-3 py-2 text-sm',
  'hover:bg-zinc-100 dark:hover:bg-zinc-800/60 transition-colors'
);

const AttentionRowContent: React.FC<{
  icon: React.ReactNode;
  name: string;
  detail: string;
  actionLabel: string;
}> = ({ icon, name, detail, actionLabel }) => (
  <>
    {icon}
    <span className={cn('font-medium flex-shrink-0', theme.text.strong)}>{name}</span>
    <span className={cn('truncate', theme.text.muted)}>{detail}</span>
    <span
      className={cn(
        'ml-auto flex items-center gap-1 flex-shrink-0 text-xs font-medium',
        'text-teal-600 dark:text-teal-400 opacity-0 group-hover:opacity-100 transition-opacity'
      )}
    >
      {actionLabel}
      <ArrowRightIcon className="w-3 h-3" />
    </span>
  </>
);

export const DashboardPage: React.FC<DashboardPageProps> = ({
  servers,
  activitySummary,
  serverStats,
  serverStatus,
  onSectionChange,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [activeSection, setActiveSection] = useState<string>(SECTION_IDS.servers);
  const [activityExpanded, setActivityExpanded] = useState(true);

  const statusOf = (server: Server): ServerStatus => serverStatus.get(server.id) ?? 'checking';
  const unhealthyOf = (server: Server): number => serverStats.get(server.id)?.unhealthy ?? 0;

  const unreachableServers = servers.filter((s) => statusOf(s) === 'offline');
  const unhealthyServers = servers.filter((s) => unhealthyOf(s) > 0);
  const { recentOperations, failedOperations } = activitySummary;

  const attentionCount =
    unreachableServers.length + unhealthyServers.length + failedOperations.length;

  const sortedServers = [...servers].sort((a, b) => a.name.localeCompare(b.name));

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleScroll = () => {
      const sections = container.querySelectorAll('[id^="dashboard-"]');
      let current = SECTION_IDS.servers;
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

  const anyChecking = servers.some((server) => statusOf(server) === 'checking');

  const attentionSection = (
    <section>
      <SectionHeading id={SECTION_IDS.attention} title="Needs attention" count={attentionCount} />
      {attentionCount === 0 ? (
        anyChecking ? (
          <div
            className={cn(
              'flex items-center gap-2 px-3 py-2.5 rounded-md text-sm',
              'bg-zinc-50 dark:bg-zinc-800/50',
              theme.text.muted
            )}
          >
            <ArrowPathIcon className="w-4 h-4 animate-spin" />
            Checking servers…
          </div>
        ) : (
          <div
            className={cn(
              'flex items-center gap-2 px-3 py-2.5 rounded-md text-sm',
              'bg-emerald-50 dark:bg-emerald-900/10',
              'text-emerald-700 dark:text-emerald-400'
            )}
          >
            <CheckCircleIcon className="w-4 h-4" />
            All systems healthy
          </div>
        )
      ) : (
        <div className="rounded-lg border border-zinc-200 dark:border-zinc-800 divide-y divide-zinc-100 dark:divide-zinc-800">
          {unreachableServers.map((server) => (
            <Link
              key={`offline-${server.id}`}
              to="/servers/$serverid/stacks"
              params={{ serverid: String(server.id) }}
              className={attentionRowClass}
            >
              <AttentionRowContent
                icon={<span className="w-2 h-2 rounded-full bg-red-500 flex-shrink-0" />}
                name={server.name}
                detail="unreachable"
                actionLabel="view"
              />
            </Link>
          ))}
          {unhealthyServers.map((server) => {
            const stats = serverStats.get(server.id);
            return (
              <Link
                key={`unhealthy-${server.id}`}
                to="/servers/$serverid/stacks"
                params={{ serverid: String(server.id) }}
                className={attentionRowClass}
              >
                <AttentionRowContent
                  icon={
                    <ExclamationTriangleIcon className="w-4 h-4 flex-shrink-0 text-amber-500" />
                  }
                  name={server.name}
                  detail={`${stats?.unhealthy ?? 0} of ${stats?.total ?? 0} stacks unhealthy`}
                  actionLabel="stacks"
                />
              </Link>
            );
          })}
          {failedOperations.map((op) => (
            <Link
              key={`failed-${op.id}`}
              to="/operation-logs"
              search={{ status: 'failed' }}
              className={attentionRowClass}
            >
              <AttentionRowContent
                icon={<XCircleIcon className="w-4 h-4 flex-shrink-0 text-red-500" />}
                name={op.command}
                detail={`failed ${op.formatted_date} · ${op.server_name}`}
                actionLabel="logs"
              />
            </Link>
          ))}
        </div>
      )}
    </section>
  );

  return (
    <div ref={containerRef} className="h-full overflow-auto">
      <div className="p-6 space-y-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
          <div className="lg:col-span-2 space-y-6">
            <section>
              <SectionHeading
                id={SECTION_IDS.servers}
                title="Servers"
                action={
                  <Link
                    to="/stacks"
                    className={cn(
                      'flex items-center gap-1 text-xs font-medium',
                      theme.link.primary
                    )}
                  >
                    All stacks
                    <ArrowRightIcon className="w-3 h-3" />
                  </Link>
                }
              />
              {servers.length === 0 ? (
                <div
                  className={cn(
                    'rounded-lg border p-8 text-center',
                    'border-zinc-200 dark:border-zinc-800'
                  )}
                >
                  <ServerIcon className={cn('w-10 h-10 mx-auto mb-2', theme.text.subtle)} />
                  <p className={cn('text-sm', theme.text.muted)}>No servers configured</p>
                </div>
              ) : (
                <div className="rounded-lg border border-zinc-200 dark:border-zinc-800 divide-y divide-zinc-100 dark:divide-zinc-800">
                  {sortedServers.map((server) => {
                    const status = statusOf(server);
                    const stats = serverStats.get(server.id);
                    const disabled = status === 'disabled';
                    return (
                      <Link
                        key={server.id}
                        to="/servers/$serverid/stacks"
                        params={{ serverid: String(server.id) }}
                        className={cn(
                          'group flex items-center gap-3 px-3 py-2.5 text-sm',
                          'hover:bg-zinc-100 dark:hover:bg-zinc-800/60 transition-colors',
                          disabled && 'opacity-60'
                        )}
                      >
                        <ServerStatusDot status={status} />
                        <div className="min-w-0 flex-1">
                          <div className={cn('font-medium truncate', theme.text.strong)}>
                            {server.name}
                          </div>
                          <div className={cn('text-xs font-mono truncate', theme.text.subtle)}>
                            {server.host}:{server.port}
                          </div>
                        </div>
                        <span className={cn('text-xs flex-shrink-0', theme.text.muted)}>
                          {SERVER_STATUS_LABEL[status]}
                        </span>
                        {stats ? (
                          <span
                            className={cn(
                              'flex-shrink-0 tabular-nums text-xs px-2 py-0.5 rounded-md',
                              stats.unhealthy > 0
                                ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'
                                : 'bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300'
                            )}
                            title={`${stats.healthy} healthy of ${stats.total} stacks`}
                          >
                            {stats.healthy}/{stats.total}
                          </span>
                        ) : (
                          <span className="w-12 flex-shrink-0" />
                        )}
                        <ArrowRightIcon
                          className={cn(
                            'w-4 h-4 flex-shrink-0',
                            theme.text.subtle,
                            'opacity-0 group-hover:opacity-100 transition-opacity'
                          )}
                        />
                      </Link>
                    );
                  })}
                </div>
              )}
            </section>
            {attentionSection}
          </div>

          <section className="lg:col-span-1">
            <div className="flex items-center justify-between mb-2">
              <button
                onClick={() => setActivityExpanded((v) => !v)}
                className={cn(
                  'flex items-center gap-1.5 text-sm font-bold uppercase tracking-wider',
                  theme.text.subtle
                )}
              >
                {activityExpanded ? (
                  <ChevronDownIcon className="w-4 h-4" />
                ) : (
                  <ChevronRightIcon className="w-4 h-4" />
                )}
                <span id={SECTION_IDS.activity} className="scroll-mt-4">
                  Recent activity
                </span>
              </button>
              <Link to="/operation-logs" className={cn('text-xs font-medium', theme.link.primary)}>
                View all logs
              </Link>
            </div>

            {activityExpanded &&
              (recentOperations.length === 0 ? (
                <div
                  className={cn(
                    'flex items-center gap-2 px-3 py-2.5 rounded-md text-sm',
                    theme.text.muted
                  )}
                >
                  <NoSymbolIcon className="w-4 h-4" />
                  No recent operations
                </div>
              ) : (
                <div className="rounded-lg border border-zinc-200 dark:border-zinc-800 divide-y divide-zinc-100 dark:divide-zinc-800">
                  {recentOperations.slice(0, 8).map((op) => {
                    const duration = formatDuration(op.duration_ms ?? null);
                    return (
                      <div key={op.id} className="flex items-center gap-3 px-3 py-2 text-sm">
                        {operationIcon(op)}
                        <span className={cn('font-mono flex-shrink-0', theme.text.strong)}>
                          {op.command}
                        </span>
                        <span className={cn('truncate', theme.text.muted)}>
                          {op.stack_name} · {op.server_name}
                        </span>
                        <span
                          className={cn(
                            'ml-auto flex-shrink-0 text-xs tabular-nums',
                            theme.text.subtle
                          )}
                        >
                          {duration ? `${duration} · ` : ''}
                          {op.formatted_date}
                        </span>
                      </div>
                    );
                  })}
                </div>
              ))}
          </section>
        </div>
      </div>
    </div>
  );
};
