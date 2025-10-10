import {
  ArrowDownIcon,
  ArrowUpIcon,
  ChartBarIcon,
  CircleStackIcon,
  CpuChipIcon,
  ExclamationCircleIcon,
  GlobeAltIcon,
  ServerIcon,
} from '@heroicons/react/24/outline';
import { theme } from '../../theme';
import { ContainerStats } from '../../hooks/useStackStats';
import { cn } from '../../utils/cn';
import { formatBytes, formatNumber } from '../../utils/formatters';
import { EmptyState } from '../common/EmptyState';

interface StackStatsProps {
  containers: ContainerStats[];
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

const severityStyles: Record<
  Severity,
  { badge: string; icon: string; progress: string; text: string }
> = {
  neutral: {
    badge: cn(theme.badges.tag.base, theme.badges.tag.neutral),
    icon: cn(theme.icon.squareMd, theme.intent.neutral.icon),
    progress: theme.progress.neutral,
    text: theme.intent.neutral.textStrong,
  },
  success: {
    badge: cn(theme.badges.tag.base, theme.badges.tag.success),
    icon: cn(theme.icon.squareMd, theme.intent.success.icon),
    progress: theme.progress.healthy,
    text: theme.intent.success.textStrong,
  },
  info: {
    badge: cn(theme.badges.tag.base, theme.badges.tag.info),
    icon: cn(theme.icon.squareMd, theme.intent.info.icon),
    progress: theme.progress.info,
    text: theme.intent.info.textStrong,
  },
  warning: {
    badge: cn(theme.badges.tag.base, theme.badges.tag.warning),
    icon: cn(theme.icon.squareMd, theme.intent.warning.icon),
    progress: theme.progress.warning,
    text: theme.intent.warning.textStrong,
  },
  danger: {
    badge: cn(theme.badges.tag.base, theme.badges.tag.danger),
    icon: cn(theme.icon.squareMd, theme.intent.danger.icon),
    progress: theme.progress.unhealthy,
    text: theme.intent.danger.textStrong,
  },
};

const MetricCard = ({
  title,
  value,
  subValue,
  percent,
  icon,
}: {
  title: string;
  value: string;
  subValue?: string;
  percent?: number;
  icon: React.ReactNode;
}) => {
  const severity = resolveSeverity(percent);
  const styles = severityStyles[severity];

  return (
    <div className={cn(theme.containers.cardSoft, 'p-6')} aria-label={`${title} metric card`}>
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className={styles.icon}>{icon}</div>
          <div>
            <p className={cn('text-sm', theme.text.subtle)}>{title}</p>
            <p className={cn('text-2xl font-semibold', styles.text)}>{value}</p>
            {subValue && <p className={cn('text-xs', theme.text.subtle)}>{subValue}</p>}
          </div>
        </div>
        {percent !== undefined && <span className={styles.badge}>{formatPercent(percent)}</span>}
      </div>
    </div>
  );
};

const ProgressBar = ({ percent }: { percent: number }) => {
  const severity = resolveSeverity(percent);
  const width = Math.min(Math.max(percent, 0), 100);

  if (percent < 0) {
    return (
      <div
        className={cn(theme.progress.track, 'relative overflow-hidden')}
        aria-label="Usage loading"
      >
        <div className="absolute inset-0 animate-pulse bg-slate-400/40" />
      </div>
    );
  }

  return (
    <div className={cn(theme.progress.track, 'relative overflow-hidden')} aria-label="Usage">
      <div
        className={cn(severityStyles[severity].progress, 'transition-all duration-500 ease-out')}
        style={{ width: `${width}%` }}
      />
    </div>
  );
};

const LoadingSkeleton = () => (
  <div className={cn(theme.containers.cardSoft, 'animate-pulse p-6')}>
    <div className="flex items-center gap-3 mb-4">
      <div className="h-10 w-10 rounded-xl bg-slate-200 dark:bg-slate-700" />
      <div className="space-y-2">
        <div className="h-4 w-28 rounded bg-slate-200 dark:bg-slate-700" />
        <div className="h-3 w-16 rounded bg-slate-200 dark:bg-slate-700" />
      </div>
    </div>
    <div className="space-y-3">
      <div className="h-3 w-full rounded bg-slate-200 dark:bg-slate-700" />
      <div className="grid grid-cols-2 gap-2">
        <div className="h-8 rounded bg-slate-200 dark:bg-slate-700" />
        <div className="h-8 rounded bg-slate-200 dark:bg-slate-700" />
      </div>
    </div>
  </div>
);

export const StackStats = ({ containers, isLoading, error }: StackStatsProps) => {
  if (isLoading) {
    return (
      <div className="space-y-4">
        {[0, 1, 2].map((index) => (
          <LoadingSkeleton key={index} />
        ))}
      </div>
    );
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

  return (
    <div className="space-y-6">
      <header className={cn(theme.containers.sectionHeader)}>
        <div className="flex items-center gap-3">
          <div className={cn(theme.icon.squareMd, theme.brand.accent)}>
            <ChartBarIcon className="h-4 w-4 text-white" />
          </div>
          <div>
            <h2 className={cn('text-lg font-semibold', theme.text.strong)}>Container Statistics</h2>
            <p className={cn('text-xs', theme.text.subtle)}>
              Real-time metrics · Updates every 1s · {containers.length} container
              {containers.length === 1 ? '' : 's'}
            </p>
          </div>
        </div>
        <span
          className={cn(theme.badges.tag.base, theme.badges.tag.success, 'flex items-center gap-1')}
        >
          <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" /> Live
        </span>
      </header>

      <div className="space-y-6">
        {containers.map((container) => {
          const cpuSeverity = resolveSeverity(container.cpu_percent);
          const memorySeverity = resolveSeverity(container.memory_percent);

          return (
            <article
              key={container.name}
              className={cn(theme.containers.cardSoft, 'space-y-6 p-6')}
            >
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                  <h3 className={cn('text-xl font-semibold', theme.text.strong)}>
                    {container.name}
                  </h3>
                  <p className={cn('text-sm', theme.text.subtle)}>
                    Service:{' '}
                    <span className={cn('font-medium', theme.text.strong)}>
                      {container.service_name}
                    </span>
                  </p>
                </div>
                <span className={cn(theme.badges.tag.base, theme.badges.tag.success)}>Running</span>
              </div>

              <div className="grid gap-4 lg:grid-cols-4">
                <MetricCard
                  title="CPU Usage"
                  value={formatPercent(container.cpu_percent)}
                  subValue={`${container.cpu_user_time}ms user · ${container.cpu_system_time}ms system`}
                  percent={container.cpu_percent}
                  icon={<CpuChipIcon className="h-5 w-5" />}
                />
                <MetricCard
                  title="Memory Usage"
                  value={formatBytes(container.memory_usage)}
                  subValue={`Limit ${formatBytes(container.memory_limit)}`}
                  percent={container.memory_percent}
                  icon={<CircleStackIcon className="h-5 w-5" />}
                />
                <MetricCard
                  title="Network I/O"
                  value={`${formatBytes(container.network_rx_bytes + container.network_tx_bytes)}`}
                  subValue={`${formatBytes(container.network_rx_bytes)} received · ${formatBytes(container.network_tx_bytes)} sent`}
                  icon={<GlobeAltIcon className="h-5 w-5" />}
                />
                <MetricCard
                  title="Disk I/O"
                  value={formatBytes(container.block_read_bytes + container.block_write_bytes)}
                  subValue={`${formatNumber(container.block_read_ops + container.block_write_ops)} operations`}
                  icon={<ServerIcon className="h-5 w-5" />}
                />
              </div>

              <div className="grid gap-6 lg:grid-cols-2">
                <section className={cn(theme.surface.soft, 'rounded-xl p-5')}>
                  <div className="flex items-center justify-between">
                    <h4 className={cn('text-sm font-semibold', theme.text.strong)}>CPU Usage</h4>
                    <span className={severityStyles[cpuSeverity].badge}>
                      {formatPercent(container.cpu_percent)}
                    </span>
                  </div>
                  <div className="mt-4">
                    <ProgressBar percent={container.cpu_percent} />
                  </div>
                </section>

                <section className={cn(theme.surface.soft, 'rounded-xl p-5')}>
                  <div className="flex items-center justify-between">
                    <h4 className={cn('text-sm font-semibold', theme.text.strong)}>Memory Usage</h4>
                    <span className={severityStyles[memorySeverity].badge}>
                      {formatPercent(container.memory_percent)}
                    </span>
                  </div>
                  <div className="mt-4">
                    <ProgressBar percent={container.memory_percent} />
                  </div>
                </section>
              </div>

              <div className="grid gap-6 lg:grid-cols-2">
                <section className={cn(theme.surface.soft, 'rounded-xl p-5')}>
                  <h4 className={cn('mb-3 text-sm font-semibold', theme.text.strong)}>
                    Memory Breakdown
                  </h4>
                  <div className="grid grid-cols-2 gap-4 text-center">
                    <div>
                      <p className={cn('text-2xl font-semibold', theme.text.strong)}>
                        {formatBytes(container.memory_rss)}
                      </p>
                      <p className={cn('text-xs', theme.text.subtle)}>RSS</p>
                    </div>
                    <div>
                      <p className={cn('text-2xl font-semibold', theme.text.strong)}>
                        {formatBytes(container.memory_cache)}
                      </p>
                      <p className={cn('text-xs', theme.text.subtle)}>Cache</p>
                    </div>
                    <div>
                      <p className={cn('text-2xl font-semibold', theme.text.strong)}>
                        {formatBytes(container.memory_swap)}
                      </p>
                      <p className={cn('text-xs', theme.text.subtle)}>Swap</p>
                    </div>
                    <div>
                      <p className={cn('text-2xl font-semibold', theme.text.strong)}>
                        {formatNumber(container.page_faults)}
                      </p>
                      <p className={cn('text-xs', theme.text.subtle)}>Page Faults</p>
                    </div>
                  </div>
                </section>

                <section className={cn(theme.surface.soft, 'rounded-xl p-5')}>
                  <h4 className={cn('mb-3 text-sm font-semibold', theme.text.strong)}>Network</h4>
                  <div className="flex justify-between text-sm">
                    <span className={cn('flex items-center gap-1', theme.text.subtle)}>
                      <ArrowDownIcon className="h-4 w-4" />{' '}
                      {formatBytes(container.network_rx_bytes)}
                    </span>
                    <span className={cn('flex items-center gap-1', theme.text.subtle)}>
                      <ArrowUpIcon className="h-4 w-4" /> {formatBytes(container.network_tx_bytes)}
                    </span>
                  </div>
                  <h4 className={cn('mt-6 mb-3 text-sm font-semibold', theme.text.strong)}>
                    Disk I/O
                  </h4>
                  <div className="flex justify-between text-sm">
                    <span className={cn('flex items-center gap-1', theme.text.subtle)}>
                      <ArrowDownIcon className="h-4 w-4" />{' '}
                      {formatBytes(container.block_read_bytes)}
                    </span>
                    <span className={cn('flex items-center gap-1', theme.text.subtle)}>
                      <ArrowUpIcon className="h-4 w-4" /> {formatBytes(container.block_write_bytes)}
                    </span>
                  </div>
                </section>
              </div>
            </article>
          );
        })}
      </div>
    </div>
  );
};

export default StackStats;
