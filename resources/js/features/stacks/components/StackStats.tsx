import { useState } from 'react';
import {
  BoltSlashIcon,
  ChartBarIcon,
  ChevronDownIcon,
  ChevronRightIcon,
  CircleStackIcon,
  CpuChipIcon,
  ExclamationCircleIcon,
  FireIcon,
  ServerIcon,
} from '@heroicons/react/24/outline';
import { theme } from '../../../shared/theme';
import type { ContainerStats, StackStats as StackStatsData } from '../../../api/generated/models';
import { cn } from '../../../shared/utils/cn';
import { formatBytes, formatNumber } from '../../../shared/utils/formatters';
import { EmptyState } from '../../../shared/components/EmptyState';

interface StackStatsProps {
  stats?: StackStatsData;
  isLoading: boolean;
  error: Error | null;
}

type Tone = 'neutral' | 'ok' | 'warning' | 'danger';

const missing = 'n/a';

const toneText: Record<Tone, string> = {
  neutral: theme.text.strong,
  ok: theme.text.strong,
  warning: theme.text.warning,
  danger: theme.text.danger,
};

const toneBar: Record<Tone, string> = {
  neutral: 'bg-zinc-400 dark:bg-zinc-500',
  ok: 'bg-teal-500',
  warning: 'bg-amber-500',
  danger: 'bg-rose-500',
};

const toneFor = (percent: number | null | undefined): Tone => {
  if (percent === null || percent === undefined) return 'neutral';
  if (percent >= 90) return 'danger';
  if (percent >= 75) return 'warning';
  return 'ok';
};

const formatCores = (value: number | null | undefined): string =>
  value === null || value === undefined ? missing : `${value.toFixed(2)}`;

const formatPercent = (value: number | null | undefined, digits = 0): string =>
  value === null || value === undefined ? missing : `${value.toFixed(digits)}%`;

const formatRate = (value: number | null | undefined): string =>
  value === null || value === undefined ? missing : `${formatBytes(value)}/s`;

const isRunning = (container: ContainerStats) => container.state === 'running';

const sumRates = (containers: ContainerStats[], pick: (c: ContainerStats) => number | null) => {
  const measured = containers.map(pick).filter((value): value is number => value !== null);
  return measured.length === 0 ? null : measured.reduce((total, value) => total + value, 0);
};

const Meter = ({ percent, tone }: { percent: number; tone: Tone }) => (
  <div className="mt-1 h-1.5 w-full rounded-full bg-zinc-200 dark:bg-zinc-700">
    <div
      className={cn('h-full rounded-full transition-all duration-300', toneBar[tone])}
      style={{ width: `${Math.min(Math.max(percent, 0), 100)}%` }}
    />
  </div>
);

const StatTile = ({
  icon: Icon,
  label,
  value,
  detail,
  tone = 'neutral',
}: {
  icon: typeof CpuChipIcon;
  label: string;
  value: string;
  detail: string;
  tone?: Tone;
}) => (
  <div className={cn('rounded-xl p-4', theme.surface.panel)}>
    <div className="flex items-center gap-2">
      <Icon className={cn('h-4 w-4', theme.text.subtle)} />
      <p className={cn('text-xs font-medium', theme.text.subtle)}>{label}</p>
    </div>
    <p className={cn('mt-2 text-2xl font-semibold tabular-nums', toneText[tone])}>{value}</p>
    <p className={cn('mt-0.5 text-xs', theme.text.subtle)}>{detail}</p>
  </div>
);

const Badge = ({ tone, children }: { tone: Tone; children: React.ReactNode }) => (
  <span
    className={cn(
      'rounded-full px-2 py-0.5 text-[11px] font-medium',
      tone === 'danger' && 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300',
      tone === 'warning' && 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300',
      tone === 'neutral' && 'bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400',
      tone === 'ok' && 'bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-300'
    )}
  >
    {children}
  </span>
);

const Metric = ({
  label,
  value,
  detail,
  tone = 'neutral',
  meter,
}: {
  label: string;
  value: string;
  detail?: string;
  tone?: Tone;
  meter?: number | null;
}) => (
  <div className="min-w-0">
    <p className={cn('text-xs', theme.text.subtle)}>{label}</p>
    <p className={cn('truncate text-sm font-medium tabular-nums', toneText[tone])}>{value}</p>
    {meter !== null && meter !== undefined ? <Meter percent={meter} tone={tone} /> : null}
    {detail ? <p className={cn('mt-0.5 truncate text-xs', theme.text.subtle)}>{detail}</p> : null}
  </div>
);

const DetailRow = ({ label, value }: { label: string; value: string }) => (
  <div className="flex items-baseline justify-between gap-3 text-xs">
    <span className={theme.text.subtle}>{label}</span>
    <span className={cn('tabular-nums', theme.text.standard)}>{value}</span>
  </div>
);

const DetailPanel = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <div className={cn('rounded-lg p-3', theme.surface.subtle)}>
    <h4 className={cn('mb-2 text-xs font-semibold', theme.text.strong)}>{title}</h4>
    <div className="space-y-1.5">{children}</div>
  </div>
);

const memoryDetail = (container: ContainerStats): string => {
  if (!isRunning(container)) return container.state;
  if (container.memory_limit > 0) {
    return `${formatPercent(container.memory_percent_of_limit)} of ${formatBytes(container.memory_limit)}`;
  }
  return `no limit, ${formatPercent(container.memory_percent_of_host, 1)} of host`;
};

const cpuDetail = (container: ContainerStats): string => {
  if (!isRunning(container)) return container.state;
  if (container.cpu_quota_cores > 0) {
    return `${formatPercent(container.cpu_percent_of_quota)} of ${container.cpu_quota_cores} limit`;
  }
  return `no limit, ${formatPercent(container.cpu_percent_of_host, 1)} of host`;
};

const ContainerRow = ({
  container,
  isExpanded,
  onToggle,
}: {
  container: ContainerStats;
  isExpanded: boolean;
  onToggle: () => void;
}) => {
  const running = isRunning(container);
  const memoryTone =
    container.memory_limit > 0 ? toneFor(container.memory_percent_of_limit) : 'neutral';
  const cpuTone =
    container.cpu_quota_cores > 0 ? toneFor(container.cpu_percent_of_quota) : 'neutral';
  const throttled = container.cpu_throttled_percent ?? 0;
  const alarming = container.oom_kills > 0 || throttled >= 1;

  return (
    <div
      className={cn(
        'rounded-xl border',
        alarming
          ? 'border-rose-300 bg-rose-50/40 dark:border-rose-900 dark:bg-rose-900/10'
          : 'border-zinc-200 bg-white dark:border-zinc-700 dark:bg-zinc-900'
      )}
    >
      <button
        onClick={onToggle}
        aria-expanded={isExpanded}
        className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left transition-colors hover:bg-zinc-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 dark:hover:bg-zinc-800/50"
      >
        <span className={cn('flex-shrink-0', theme.text.subtle)}>
          {isExpanded ? (
            <ChevronDownIcon className="h-5 w-5" />
          ) : (
            <ChevronRightIcon className="h-5 w-5" />
          )}
        </span>
        <span
          className={cn(
            'h-2.5 w-2.5 flex-shrink-0 rounded-full',
            running ? 'bg-emerald-500' : 'bg-zinc-400 dark:bg-zinc-600'
          )}
        />
        <span className="min-w-0 flex-1">
          <span className={cn('block truncate text-sm font-medium', theme.text.strong)}>
            {container.service_name}
          </span>
          <span className={cn('block truncate font-mono text-xs', theme.text.subtle)}>
            {container.name}
          </span>
        </span>
        <span className="flex flex-shrink-0 flex-wrap items-center justify-end gap-1">
          {!running ? <Badge tone="neutral">{container.state}</Badge> : null}
          {container.oom_kills > 0 ? (
            <Badge tone="danger">{`${container.oom_kills} OOM ${container.oom_kills === 1 ? 'kill' : 'kills'}`}</Badge>
          ) : null}
          {throttled >= 1 ? (
            <Badge tone="warning">{`throttled ${formatPercent(throttled)}`}</Badge>
          ) : null}
        </span>
      </button>

      <div className="grid grid-cols-2 gap-3 px-3 pb-3 sm:grid-cols-4">
        <Metric
          label="CPU"
          value={running ? `${formatCores(container.cpu_usage_cores)} cores` : missing}
          detail={cpuDetail(container)}
          tone={cpuTone}
          meter={container.cpu_quota_cores > 0 ? container.cpu_percent_of_quota : null}
        />
        <Metric
          label="Memory"
          value={running ? formatBytes(container.memory_working_set) : missing}
          detail={memoryDetail(container)}
          tone={memoryTone}
          meter={container.memory_limit > 0 ? container.memory_percent_of_limit : null}
        />
        <Metric
          label="Network"
          value={running ? formatRate(container.network_rx_bytes_per_second) : missing}
          detail={running ? `${formatRate(container.network_tx_bytes_per_second)} out` : undefined}
        />
        <Metric
          label="Disk"
          value={running ? formatRate(container.block_read_bytes_per_second) : missing}
          detail={
            running ? `${formatRate(container.block_write_bytes_per_second)} write` : undefined
          }
        />
      </div>

      {isExpanded ? (
        <div className="grid gap-3 border-t border-zinc-100 px-3 py-3 sm:grid-cols-2 xl:grid-cols-4 dark:border-zinc-800">
          <DetailPanel title="CPU">
            <DetailRow label="In use" value={`${formatCores(container.cpu_usage_cores)} cores`} />
            <DetailRow
              label="Limit"
              value={
                container.cpu_quota_cores > 0 ? `${container.cpu_quota_cores} cores` : 'none set'
              }
            />
            <DetailRow label="Of limit" value={formatPercent(container.cpu_percent_of_quota, 1)} />
            <DetailRow label="Of host" value={formatPercent(container.cpu_percent_of_host, 1)} />
            <DetailRow
              label="Throttled"
              value={formatPercent(container.cpu_throttled_percent, 1)}
            />
            <DetailRow label="User time" value={`${formatNumber(container.cpu_user_time)} ms`} />
            <DetailRow
              label="System time"
              value={`${formatNumber(container.cpu_system_time)} ms`}
            />
          </DetailPanel>

          <DetailPanel title="Memory">
            <DetailRow label="Working set" value={formatBytes(container.memory_working_set)} />
            <DetailRow label="Total in use" value={formatBytes(container.memory_current)} />
            <DetailRow label="Anonymous" value={formatBytes(container.memory_anon)} />
            <DetailRow label="Page cache" value={formatBytes(container.memory_file)} />
            <DetailRow
              label="Reclaimable cache"
              value={formatBytes(container.memory_inactive_file)}
            />
            <DetailRow label="Swap" value={formatBytes(container.memory_swap)} />
            <DetailRow label="Peak" value={formatBytes(container.memory_peak)} />
            <DetailRow
              label="Limit"
              value={container.memory_limit > 0 ? formatBytes(container.memory_limit) : 'none set'}
            />
            <DetailRow label="Limit reached" value={formatNumber(container.memory_limit_hits)} />
            <DetailRow label="OOM kills" value={formatNumber(container.oom_kills)} />
          </DetailPanel>

          <DetailPanel title="Network">
            <DetailRow label="In" value={formatRate(container.network_rx_bytes_per_second)} />
            <DetailRow label="Out" value={formatRate(container.network_tx_bytes_per_second)} />
            <DetailRow label="Received" value={formatBytes(container.network_rx_bytes)} />
            <DetailRow label="Sent" value={formatBytes(container.network_tx_bytes)} />
            <DetailRow label="Packets in" value={formatNumber(container.network_rx_packets)} />
            <DetailRow label="Packets out" value={formatNumber(container.network_tx_packets)} />
          </DetailPanel>

          <DetailPanel title="Disk">
            <DetailRow label="Read" value={formatRate(container.block_read_bytes_per_second)} />
            <DetailRow label="Write" value={formatRate(container.block_write_bytes_per_second)} />
            <DetailRow label="Read total" value={formatBytes(container.block_read_bytes)} />
            <DetailRow label="Written total" value={formatBytes(container.block_write_bytes)} />
            <DetailRow label="Read ops" value={formatNumber(container.block_read_ops)} />
            <DetailRow label="Write ops" value={formatNumber(container.block_write_ops)} />
            <DetailRow label="Page faults" value={formatNumber(container.page_faults)} />
            <DetailRow label="Major faults" value={formatNumber(container.page_major_faults)} />
          </DetailPanel>
        </div>
      ) : null}
    </div>
  );
};

const Summary = ({ stats }: { stats: StackStatsData }) => {
  const running = stats.containers.filter(isRunning);
  const cores = sumRates(running, (c) => c.cpu_usage_cores);
  const memory = running.reduce((total, c) => total + c.memory_working_set, 0);
  const oomKills = stats.containers.reduce((total, c) => total + c.oom_kills, 0);
  const throttled = running.filter((c) => (c.cpu_throttled_percent ?? 0) >= 1).length;
  const unlimited = running.filter((c) => c.memory_limit === 0).length;

  const hostCores = stats.host.cpu_cores;
  const hostMemory = stats.host.memory_total;

  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      <StatTile
        icon={CpuChipIcon}
        label="CPU in use"
        value={cores === null ? missing : formatCores(cores)}
        detail={
          hostCores > 0
            ? `of ${hostCores} host cores${cores === null ? '' : ` (${((cores / hostCores) * 100).toFixed(1)}%)`}`
            : 'cores'
        }
      />
      <StatTile
        icon={CircleStackIcon}
        label="Memory in use"
        value={formatBytes(memory)}
        detail={
          hostMemory > 0
            ? `of ${formatBytes(hostMemory)} on the host (${((memory / hostMemory) * 100).toFixed(1)}%)`
            : 'working set'
        }
      />
      <StatTile
        icon={BoltSlashIcon}
        label="Throttled"
        value={throttled === 0 ? 'None' : `${throttled}`}
        detail={
          throttled === 0 ? 'nothing is hitting a CPU limit' : 'containers hitting a CPU limit'
        }
        tone={throttled === 0 ? 'neutral' : 'warning'}
      />
      <StatTile
        icon={FireIcon}
        label="OOM kills"
        value={formatNumber(oomKills)}
        detail={oomKills === 0 ? 'no container has been killed' : 'since the containers started'}
        tone={oomKills === 0 ? 'neutral' : 'danger'}
      />
      <div className="col-span-2 lg:col-span-4">
        <div
          className={cn(
            'flex flex-wrap items-center gap-x-4 gap-y-1 rounded-lg px-3 py-2 text-xs',
            theme.surface.subtle,
            theme.text.subtle
          )}
        >
          <span className="flex items-center gap-1.5">
            <ServerIcon className="h-3.5 w-3.5" />
            {running.length} of {stats.containers.length} containers running
          </span>
          <span>
            host load {stats.host.load_1.toFixed(2)}, {stats.host.load_5.toFixed(2)},{' '}
            {stats.host.load_15.toFixed(2)}
          </span>
          {unlimited > 0 ? (
            <span>
              {unlimited} of {running.length} without a memory limit
            </span>
          ) : null}
          <span className="ml-auto flex items-center gap-1.5">
            {stats.sample_window_seconds === null ? (
              <>
                <span className="h-2 w-2 rounded-full bg-zinc-400" />
                Waiting for the next sample
              </>
            ) : (
              <>
                <span className="h-2 w-2 animate-pulse rounded-full bg-emerald-500" />
                Live
              </>
            )}
          </span>
        </div>
      </div>
    </div>
  );
};

const LoadingSkeleton = () => (
  <div className="space-y-3">
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      {[0, 1, 2, 3].map((i) => (
        <div key={i} className="h-24 animate-pulse rounded-xl bg-zinc-100 dark:bg-zinc-800" />
      ))}
    </div>
    {[0, 1, 2].map((i) => (
      <div key={i} className="h-28 animate-pulse rounded-xl bg-zinc-100 dark:bg-zinc-800" />
    ))}
  </div>
);

export const StackStats = ({ stats, isLoading, error }: StackStatsProps) => {
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const toggle = (name: string) => {
    setExpanded((current) => {
      const next = new Set(current);
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

  if (!stats || stats.containers.length === 0) {
    return (
      <EmptyState
        icon={ChartBarIcon}
        title="No containers to measure"
        description="Statistics appear once this stack has containers. Start your services to see live resource usage."
        variant="info"
        size="lg"
      />
    );
  }

  const containers = [...stats.containers].sort(
    (a, b) => a.service_name.localeCompare(b.service_name) || a.name.localeCompare(b.name)
  );

  return (
    <div className="space-y-4">
      <Summary stats={stats} />

      <div className="space-y-2">
        {containers.map((container) => (
          <ContainerRow
            key={container.name}
            container={container}
            isExpanded={expanded.has(container.name)}
            onToggle={() => toggle(container.name)}
          />
        ))}
      </div>
    </div>
  );
};

export default StackStats;
