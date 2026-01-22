import { useState } from 'react';
import {
  ArrowDownIcon,
  ArrowUpIcon,
  ChartBarIcon,
  ChevronDownIcon,
  ChevronRightIcon,
  CpuChipIcon,
  ExclamationCircleIcon,
  ExclamationTriangleIcon,
  CircleStackIcon,
  GlobeAltIcon,
  ServerIcon,
} from '@heroicons/react/24/outline';
import { theme } from '../../theme';
import type { GetApiV1ServersServeridStacksStacknameStats200ContainersItem } from '../../api/generated/models';
import { cn } from '../../utils/cn';
import { formatBytes, formatNumber } from '../../utils/formatters';
import { EmptyState } from '../common/EmptyState';
import { MemoryProgressBar } from './MemoryProgressBar';

interface StackStatsProps {
  containers: GetApiV1ServersServeridStacksStacknameStats200ContainersItem[];
  isLoading: boolean;
  error: Error | null;
}

type Severity = 'neutral' | 'success' | 'info' | 'warning' | 'danger';

const formatPercent = (value: number): string => {
  if (value < 0) return '—';
  return `${value.toFixed(1)}%`;
};

const resolveSeverity = (value?: number): Severity => {
  if (value === undefined || value < 0) return 'neutral';
  if (value >= 90) return 'danger';
  if (value >= 70) return 'warning';
  if (value >= 50) return 'info';
  return 'success';
};

const getRssPercent = (
  container: GetApiV1ServersServeridStacksStacknameStats200ContainersItem
): number => {
  if (container.memory_limit <= 0) return 0;
  return (container.memory_rss / container.memory_limit) * 100;
};

const getCachePercent = (
  container: GetApiV1ServersServeridStacksStacknameStats200ContainersItem
): number => {
  if (container.memory_limit <= 0) return 0;
  return (container.memory_cache / container.memory_limit) * 100;
};

const severityColors: Record<Severity, { bar: string; text: string }> = {
  neutral: {
    bar: 'bg-zinc-300 dark:bg-zinc-600',
    text: 'text-zinc-600 dark:text-zinc-400',
  },
  success: {
    bar: 'bg-emerald-500',
    text: 'text-emerald-600 dark:text-emerald-400',
  },
  info: {
    bar: 'bg-blue-500',
    text: 'text-blue-600 dark:text-blue-400',
  },
  warning: {
    bar: 'bg-amber-500',
    text: 'text-amber-600 dark:text-amber-400',
  },
  danger: {
    bar: 'bg-red-500',
    text: 'text-red-600 dark:text-red-400',
  },
};

const SummaryBar: React.FC<{
  containers: GetApiV1ServersServeridStacksStacknameStats200ContainersItem[];
}> = ({ containers }) => {
  const totalRss = containers.reduce((sum, c) => sum + c.memory_rss, 0);
  const totalCache = containers.reduce((sum, c) => sum + c.memory_cache, 0);
  const totalMemoryLimit = containers.reduce((sum, c) => sum + c.memory_limit, 0);
  const avgCpu = containers.reduce((sum, c) => sum + c.cpu_percent, 0) / containers.length;
  const maxCpu = Math.max(...containers.map((c) => c.cpu_percent));

  const warningCount = containers.filter(
    (c) => c.cpu_percent >= 70 || getRssPercent(c) >= 70
  ).length;
  const dangerCount = containers.filter(
    (c) => c.cpu_percent >= 90 || getRssPercent(c) >= 90
  ).length;

  return (
    <div
      className={cn(
        'flex flex-wrap items-center gap-4 rounded-lg border px-4 py-3',
        'border-zinc-200 dark:border-zinc-700',
        'bg-zinc-50 dark:bg-zinc-800/50'
      )}
    >
      {/* Container count */}
      <div className="flex items-center gap-2">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-teal-100 dark:bg-teal-900/30">
          <ServerIcon className="h-4 w-4 text-teal-600 dark:text-teal-400" />
        </div>
        <div>
          <p className={cn('text-sm font-semibold tabular-nums', theme.text.strong)}>
            {containers.length}
          </p>
          <p className={cn('text-xs', theme.text.subtle)}>containers</p>
        </div>
      </div>

      <div className="h-8 w-px bg-zinc-200 dark:bg-zinc-700" />

      {/* CPU stats */}
      <div className="flex items-center gap-2">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-100 dark:bg-blue-900/30">
          <CpuChipIcon className="h-4 w-4 text-blue-600 dark:text-blue-400" />
        </div>
        <div>
          <p className={cn('text-sm font-semibold tabular-nums', theme.text.strong)}>
            {formatPercent(avgCpu)}
            <span className={cn('text-xs font-normal ml-1', theme.text.subtle)}>
              (max {formatPercent(maxCpu)})
            </span>
          </p>
          <p className={cn('text-xs', theme.text.subtle)}>avg CPU</p>
        </div>
      </div>

      <div className="h-8 w-px bg-zinc-200 dark:bg-zinc-700" />

      {/* Memory stats */}
      <div className="flex items-center gap-2">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-purple-100 dark:bg-purple-900/30">
          <CircleStackIcon className="h-4 w-4 text-purple-600 dark:text-purple-400" />
        </div>
        <div>
          <p className={cn('text-sm font-semibold tabular-nums', theme.text.strong)}>
            {formatBytes(totalRss)}
            <span className={cn('text-xs font-normal ml-1', theme.text.muted)}>
              + {formatBytes(totalCache)} cache
            </span>
          </p>
          <p className={cn('text-xs', theme.text.subtle)}>used / {formatBytes(totalMemoryLimit)}</p>
        </div>
      </div>

      {/* Warnings/Alerts */}
      {(warningCount > 0 || dangerCount > 0) && (
        <>
          <div className="h-8 w-px bg-zinc-200 dark:bg-zinc-700" />
          <div className="flex items-center gap-2">
            <div
              className={cn(
                'flex h-8 w-8 items-center justify-center rounded-lg',
                dangerCount > 0
                  ? 'bg-red-100 dark:bg-red-900/30'
                  : 'bg-amber-100 dark:bg-amber-900/30'
              )}
            >
              <ExclamationTriangleIcon
                className={cn(
                  'h-4 w-4',
                  dangerCount > 0
                    ? 'text-red-600 dark:text-red-400'
                    : 'text-amber-600 dark:text-amber-400'
                )}
              />
            </div>
            <div>
              <p
                className={cn(
                  'text-sm font-semibold tabular-nums',
                  dangerCount > 0
                    ? 'text-red-600 dark:text-red-400'
                    : 'text-amber-600 dark:text-amber-400'
                )}
              >
                {dangerCount > 0 ? dangerCount : warningCount}
              </p>
              <p className={cn('text-xs', theme.text.subtle)}>
                {dangerCount > 0 ? 'critical' : 'warnings'}
              </p>
            </div>
          </div>
        </>
      )}

      {/* Live indicator */}
      <div className="ml-auto flex items-center gap-1.5">
        <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
        <span className={cn('text-xs font-medium', theme.text.subtle)}>Live</span>
      </div>
    </div>
  );
};

const CompactProgressBar: React.FC<{ percent: number; className?: string }> = ({
  percent,
  className,
}) => {
  const severity = resolveSeverity(percent);
  const width = Math.min(Math.max(percent, 0), 100);

  return (
    <div className={cn('h-1.5 w-full rounded-full bg-zinc-200 dark:bg-zinc-700', className)}>
      <div
        className={cn(
          'h-full rounded-full transition-all duration-300',
          severityColors[severity].bar
        )}
        style={{ width: `${width}%` }}
      />
    </div>
  );
};

const ContainerRow: React.FC<{
  container: GetApiV1ServersServeridStacksStacknameStats200ContainersItem;
  isExpanded: boolean;
  onToggle: () => void;
}> = ({ container, isExpanded, onToggle }) => {
  const rssPercent = getRssPercent(container);
  const cachePercent = getCachePercent(container);
  const cpuSeverity = resolveSeverity(container.cpu_percent);
  const memorySeverity = resolveSeverity(rssPercent);

  const hasWarning = container.cpu_percent >= 70 || rssPercent >= 70;
  const hasDanger = container.cpu_percent >= 90 || rssPercent >= 90;

  return (
    <div
      className={cn(
        'rounded-lg border transition-colors',
        'border-zinc-200 dark:border-zinc-700',
        hasDanger
          ? 'bg-red-50/50 dark:bg-red-900/10'
          : hasWarning
            ? 'bg-amber-50/50 dark:bg-amber-900/10'
            : 'bg-white dark:bg-zinc-900'
      )}
    >
      {/* Main Row */}
      <button
        onClick={onToggle}
        className="w-full flex items-center gap-4 px-4 py-3 text-left hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors rounded-lg"
      >
        {/* Expand indicator */}
        <div className={cn('flex-shrink-0', theme.text.subtle)}>
          {isExpanded ? (
            <ChevronDownIcon className="h-4 w-4" />
          ) : (
            <ChevronRightIcon className="h-4 w-4" />
          )}
        </div>

        {/* Status dot */}
        <span
          className={cn(
            'h-2.5 w-2.5 rounded-full flex-shrink-0',
            hasDanger ? 'bg-red-500' : hasWarning ? 'bg-amber-500' : 'bg-emerald-500'
          )}
        />

        {/* Container name */}
        <div className="min-w-0 flex-shrink-0 w-48">
          <p className={cn('text-sm font-medium truncate', theme.text.strong)}>
            {container.service_name}
          </p>
          <p className={cn('text-xs truncate', theme.text.subtle)}>{container.name}</p>
        </div>

        {/* CPU */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between mb-1">
            <span className={cn('text-xs', theme.text.subtle)}>CPU</span>
            <span
              className={cn('text-xs font-medium tabular-nums', severityColors[cpuSeverity].text)}
            >
              {formatPercent(container.cpu_percent)}
            </span>
          </div>
          <CompactProgressBar percent={container.cpu_percent} />
        </div>

        {/* Memory */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between mb-1">
            <span className={cn('text-xs', theme.text.subtle)}>
              Memory
              {cachePercent > 5 && (
                <span className={cn('ml-1', theme.text.muted)}>
                  (+{formatPercent(cachePercent)} cache)
                </span>
              )}
            </span>
            <span
              className={cn(
                'text-xs font-medium tabular-nums',
                severityColors[memorySeverity].text
              )}
            >
              {formatPercent(rssPercent)}
            </span>
          </div>
          <MemoryProgressBar
            rssPercent={rssPercent}
            cachePercent={cachePercent}
            rssBytes={container.memory_rss}
            cacheBytes={container.memory_cache}
            limitBytes={container.memory_limit}
          />
        </div>

        {/* Quick stats */}
        <div className="hidden lg:flex items-center gap-4 text-xs flex-shrink-0">
          <div className="flex items-center gap-1" title="Network I/O">
            <GlobeAltIcon className={cn('h-3.5 w-3.5', theme.text.subtle)} />
            <span className={cn('tabular-nums', theme.text.muted)}>
              {formatBytes(container.network_rx_bytes + container.network_tx_bytes)}
            </span>
          </div>
          <div className="flex items-center gap-1" title="Disk I/O">
            <ServerIcon className={cn('h-3.5 w-3.5', theme.text.subtle)} />
            <span className={cn('tabular-nums', theme.text.muted)}>
              {formatBytes(container.block_read_bytes + container.block_write_bytes)}
            </span>
          </div>
        </div>
      </button>

      {/* Expanded Details */}
      {isExpanded && (
        <div className="px-4 pb-4 pt-2 border-t border-zinc-100 dark:border-zinc-800">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Memory Breakdown */}
            <div className={cn('rounded-lg p-3', 'bg-zinc-50 dark:bg-zinc-800/50')}>
              <h4 className={cn('text-xs font-semibold mb-2', theme.text.strong)}>
                Memory Breakdown
              </h4>
              <div className="space-y-1.5">
                <div className="flex justify-between text-xs">
                  <span className={theme.text.subtle}>RSS</span>
                  <span className={cn('font-medium tabular-nums', theme.text.strong)}>
                    {formatBytes(container.memory_rss)}
                  </span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className={theme.text.subtle}>Cache</span>
                  <span className={cn('tabular-nums', theme.text.muted)}>
                    {formatBytes(container.memory_cache)}
                  </span>
                </div>
                <div className="flex justify-between text-xs pt-1 border-t border-zinc-200 dark:border-zinc-700">
                  <span className={theme.text.subtle}>Total</span>
                  <span className={cn('tabular-nums', theme.text.muted)}>
                    {formatBytes(container.memory_usage)} / {formatBytes(container.memory_limit)}
                  </span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className={theme.text.subtle}>Swap</span>
                  <span className={cn('tabular-nums', theme.text.muted)}>
                    {formatBytes(container.memory_swap)}
                  </span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className={theme.text.subtle}>Page Faults</span>
                  <span className={cn('tabular-nums', theme.text.muted)}>
                    {formatNumber(container.page_faults)}
                  </span>
                </div>
              </div>
            </div>

            {/* Network I/O */}
            <div className={cn('rounded-lg p-3', 'bg-zinc-50 dark:bg-zinc-800/50')}>
              <h4 className={cn('text-xs font-semibold mb-2', theme.text.strong)}>Network I/O</h4>
              <div className="space-y-1.5">
                <div className="flex justify-between text-xs">
                  <span className={cn('flex items-center gap-1', theme.text.subtle)}>
                    <ArrowDownIcon className="h-3 w-3" /> Received
                  </span>
                  <span className={cn('font-medium tabular-nums', theme.text.strong)}>
                    {formatBytes(container.network_rx_bytes)}
                  </span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className={cn('flex items-center gap-1', theme.text.subtle)}>
                    <ArrowUpIcon className="h-3 w-3" /> Sent
                  </span>
                  <span className={cn('font-medium tabular-nums', theme.text.strong)}>
                    {formatBytes(container.network_tx_bytes)}
                  </span>
                </div>
                <div className="flex justify-between text-xs pt-1 border-t border-zinc-200 dark:border-zinc-700">
                  <span className={theme.text.subtle}>Packets RX</span>
                  <span className={cn('tabular-nums', theme.text.muted)}>
                    {formatNumber(container.network_rx_packets)}
                  </span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className={theme.text.subtle}>Packets TX</span>
                  <span className={cn('tabular-nums', theme.text.muted)}>
                    {formatNumber(container.network_tx_packets)}
                  </span>
                </div>
              </div>
            </div>

            {/* Disk I/O */}
            <div className={cn('rounded-lg p-3', 'bg-zinc-50 dark:bg-zinc-800/50')}>
              <h4 className={cn('text-xs font-semibold mb-2', theme.text.strong)}>Disk I/O</h4>
              <div className="space-y-1.5">
                <div className="flex justify-between text-xs">
                  <span className={cn('flex items-center gap-1', theme.text.subtle)}>
                    <ArrowDownIcon className="h-3 w-3" /> Read
                  </span>
                  <span className={cn('font-medium tabular-nums', theme.text.strong)}>
                    {formatBytes(container.block_read_bytes)}
                  </span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className={cn('flex items-center gap-1', theme.text.subtle)}>
                    <ArrowUpIcon className="h-3 w-3" /> Write
                  </span>
                  <span className={cn('font-medium tabular-nums', theme.text.strong)}>
                    {formatBytes(container.block_write_bytes)}
                  </span>
                </div>
                <div className="flex justify-between text-xs pt-1 border-t border-zinc-200 dark:border-zinc-700">
                  <span className={theme.text.subtle}>Read Ops</span>
                  <span className={cn('tabular-nums', theme.text.muted)}>
                    {formatNumber(container.block_read_ops)}
                  </span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className={theme.text.subtle}>Write Ops</span>
                  <span className={cn('tabular-nums', theme.text.muted)}>
                    {formatNumber(container.block_write_ops)}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* CPU Details */}
          <div
            className={cn(
              'mt-3 rounded-lg p-3 flex items-center gap-6',
              'bg-zinc-50 dark:bg-zinc-800/50'
            )}
          >
            <span className={cn('text-xs font-semibold', theme.text.strong)}>CPU Time</span>
            <div className="flex items-center gap-4 text-xs">
              <span className={theme.text.muted}>
                User:{' '}
                <span className={cn('font-medium tabular-nums', theme.text.strong)}>
                  {container.cpu_user_time}ms
                </span>
              </span>
              <span className={theme.text.muted}>
                System:{' '}
                <span className={cn('font-medium tabular-nums', theme.text.strong)}>
                  {container.cpu_system_time}ms
                </span>
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const LoadingSkeleton = () => (
  <div className="space-y-3">
    {/* Summary skeleton */}
    <div className="h-16 rounded-lg bg-zinc-100 dark:bg-zinc-800 animate-pulse" />
    {/* Row skeletons */}
    {[0, 1, 2].map((i) => (
      <div key={i} className="h-16 rounded-lg bg-zinc-100 dark:bg-zinc-800 animate-pulse" />
    ))}
  </div>
);

export const StackStats = ({ containers, isLoading, error }: StackStatsProps) => {
  const [expandedContainers, setExpandedContainers] = useState<Set<string>>(new Set());

  const toggleExpanded = (name: string) => {
    setExpandedContainers((prev) => {
      const next = new Set(prev);
      if (next.has(name)) {
        next.delete(name);
      } else {
        next.add(name);
      }
      return next;
    });
  };

  if (isLoading) {
    return <LoadingSkeleton />;
  }

  if (error) {
    return (
      <EmptyState
        icon={ExclamationCircleIcon}
        title="Failed to load statistics"
        description={error.message}
        variant="error"
        size="lg"
      />
    );
  }

  if (!containers || containers.length === 0) {
    return (
      <EmptyState
        icon={ChartBarIcon}
        title="No running containers"
        description="Statistics will appear once containers are running. Start your services to view real-time metrics."
        variant="info"
        size="lg"
      />
    );
  }

  const sortedContainers = [...containers].sort((a, b) => {
    const aRss = getRssPercent(a);
    const bRss = getRssPercent(b);
    const aScore =
      (a.cpu_percent >= 90 || aRss >= 90 ? 2 : 0) + (a.cpu_percent >= 70 || aRss >= 70 ? 1 : 0);
    const bScore =
      (b.cpu_percent >= 90 || bRss >= 90 ? 2 : 0) + (b.cpu_percent >= 70 || bRss >= 70 ? 1 : 0);
    if (aScore !== bScore) return bScore - aScore;
    return a.service_name.localeCompare(b.service_name);
  });

  return (
    <div className="space-y-4">
      {/* Summary Bar */}
      <SummaryBar containers={containers} />

      {/* Container List */}
      <div className="space-y-2">
        {sortedContainers.map((container) => (
          <ContainerRow
            key={container.name}
            container={container}
            isExpanded={expandedContainers.has(container.name)}
            onToggle={() => toggleExpanded(container.name)}
          />
        ))}
      </div>
    </div>
  );
};

export default StackStats;
