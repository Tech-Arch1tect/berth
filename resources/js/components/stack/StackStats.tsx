import React from 'react';
import { ContainerStats } from '../../hooks/useStackStats';
import {
  CpuChipIcon,
  CircleStackIcon,
  GlobeAltIcon,
  ServerIcon,
  ChartBarIcon,
  ExclamationCircleIcon,
  ArrowUpIcon,
  ArrowDownIcon,
} from '@heroicons/react/24/outline';
import {
  CpuChipIcon as CpuChipIconSolid,
  CircleStackIcon as CircleStackIconSolid,
  GlobeAltIcon as GlobeAltIconSolid,
  ServerIcon as ServerIconSolid,
} from '@heroicons/react/24/solid';

interface StackStatsProps {
  containers: ContainerStats[];
  isLoading: boolean;
  error: Error | null;
}

const formatBytes = (bytes: number): string => {
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB', 'PB'];
  if (bytes === 0) return '0 B';

  if (bytes >= Number.MAX_SAFE_INTEGER) return 'Unlimited';

  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  const size = Math.min(i, sizes.length - 1);
  return `${(bytes / Math.pow(1024, size)).toFixed(1)} ${sizes[size]}`;
};

const formatPercent = (percent: number): string => {
  return `${percent.toFixed(1)}%`;
};

const formatNumber = (num: number): string => {
  return num.toLocaleString();
};

const getUsageColor = (percent: number) => {
  if (percent >= 90) return 'from-red-500 to-pink-500';
  if (percent >= 70) return 'from-yellow-500 to-orange-500';
  if (percent >= 50) return 'from-blue-500 to-cyan-500';
  return 'from-green-500 to-emerald-500';
};

const getUsageBadgeStyle = (percent: number) => {
  if (percent >= 90)
    return 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 border-red-200 dark:border-red-800';
  if (percent >= 70)
    return 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300 border-yellow-200 dark:border-yellow-800';
  if (percent >= 50)
    return 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800';
  return 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 border-green-200 dark:border-green-800';
};

const MetricCard: React.FC<{
  title: string;
  value: string;
  subValue?: string;
  percent?: number;
  icon: React.ElementType;
  iconSolid: React.ElementType;
  gradient: string;
  children?: React.ReactNode;
}> = ({
  title,
  value,
  subValue,
  percent,
  icon: Icon,
  iconSolid: IconSolid,
  gradient,
  children,
}) => {
  return (
    <div className="group relative bg-gradient-to-br from-white/80 to-slate-50/80 dark:from-slate-800/80 dark:to-slate-900/80 backdrop-blur-sm rounded-2xl border border-slate-200/50 dark:border-slate-700/50 p-6 hover:from-white dark:hover:from-slate-800 transition-all duration-300 hover:shadow-xl hover:shadow-slate-200/20 dark:hover:shadow-slate-900/20">
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center space-x-3">
          <div
            className={`relative w-12 h-12 bg-gradient-to-br ${gradient} rounded-xl flex items-center justify-center shadow-lg shadow-slate-200/50 dark:shadow-slate-900/50 group-hover:scale-110 transition-transform duration-300`}
          >
            <Icon className="w-6 h-6 text-white opacity-0 group-hover:opacity-100 absolute inset-0 m-auto transition-opacity duration-300" />
            <IconSolid className="w-6 h-6 text-white opacity-100 group-hover:opacity-0 transition-opacity duration-300" />
          </div>
          <div>
            <h4 className="text-sm font-medium text-slate-600 dark:text-slate-400">{title}</h4>
            <p className="text-2xl font-bold text-slate-900 dark:text-white">{value}</p>
            {subValue && <p className="text-xs text-slate-500 dark:text-slate-400">{subValue}</p>}
          </div>
        </div>
        {percent !== undefined && (
          <div
            className={`px-3 py-1.5 rounded-lg border text-xs font-medium ${getUsageBadgeStyle(percent)}`}
          >
            {formatPercent(percent)}
          </div>
        )}
      </div>
      {children}
    </div>
  );
};

const ProgressBar: React.FC<{ percent: number; gradient: string }> = ({ percent, gradient }) => {
  return (
    <div className="w-full bg-slate-200/50 dark:bg-slate-700/50 rounded-full h-3 overflow-hidden">
      <div
        className={`h-full bg-gradient-to-r ${gradient} transition-all duration-1000 ease-out relative overflow-hidden`}
        style={{ width: `${Math.min(percent, 100)}%` }}
      >
        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent -skew-x-12 animate-pulse"></div>
      </div>
    </div>
  );
};

const LoadingCard: React.FC = () => (
  <div className="bg-gradient-to-br from-white/80 to-slate-50/80 dark:from-slate-800/80 dark:to-slate-900/80 backdrop-blur-sm rounded-2xl border border-slate-200/50 dark:border-slate-700/50 p-6">
    <div className="animate-pulse">
      <div className="flex items-center space-x-3 mb-4">
        <div className="w-12 h-12 bg-slate-200 dark:bg-slate-700 rounded-xl"></div>
        <div className="space-y-2">
          <div className="h-4 w-32 bg-slate-200 dark:bg-slate-700 rounded"></div>
          <div className="h-6 w-20 bg-slate-200 dark:bg-slate-700 rounded"></div>
        </div>
      </div>
      <div className="space-y-3">
        <div className="h-3 w-full bg-slate-200 dark:bg-slate-700 rounded-full"></div>
        <div className="grid grid-cols-2 gap-3">
          <div className="h-8 bg-slate-200 dark:bg-slate-700 rounded"></div>
          <div className="h-8 bg-slate-200 dark:bg-slate-700 rounded"></div>
        </div>
      </div>
    </div>
  </div>
);

const StackStats: React.FC<StackStatsProps> = ({ containers, isLoading, error }) => {
  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 bg-slate-200 dark:bg-slate-700 rounded-lg animate-pulse"></div>
            <div className="space-y-1">
              <div className="h-5 w-48 bg-slate-200 dark:bg-slate-700 rounded animate-pulse"></div>
              <div className="h-3 w-32 bg-slate-200 dark:bg-slate-700 rounded animate-pulse"></div>
            </div>
          </div>
        </div>
        <div className="grid gap-6">
          {[1, 2].map((i) => (
            <div
              key={i}
              className="bg-gradient-to-br from-white/80 to-slate-50/80 dark:from-slate-800/80 dark:to-slate-900/80 backdrop-blur-sm rounded-2xl border border-slate-200/50 dark:border-slate-700/50 p-6"
            >
              <div className="animate-pulse">
                <div className="flex items-center space-x-3 mb-6">
                  <div className="w-12 h-12 bg-slate-200 dark:bg-slate-700 rounded-xl"></div>
                  <div className="space-y-2">
                    <div className="h-5 w-32 bg-slate-200 dark:bg-slate-700 rounded"></div>
                    <div className="h-3 w-24 bg-slate-200 dark:bg-slate-700 rounded"></div>
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  {[1, 2, 3, 4].map((j) => (
                    <LoadingCard key={j} />
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="w-16 h-16 bg-gradient-to-br from-red-500 to-pink-500 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-lg shadow-red-500/25">
            <ExclamationCircleIcon className="w-8 h-8 text-white" />
          </div>
          <h3 className="text-xl font-semibold text-slate-900 dark:text-white mb-3">
            Failed to load statistics
          </h3>
          <p className="text-slate-600 dark:text-slate-400 max-w-md">{error.message}</p>
        </div>
      </div>
    );
  }

  if (!containers || containers.length === 0) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="w-16 h-16 bg-gradient-to-br from-slate-400 to-slate-500 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-lg shadow-slate-400/25">
            <ChartBarIcon className="w-8 h-8 text-white" />
          </div>
          <h3 className="text-xl font-semibold text-slate-900 dark:text-white mb-3">
            No running containers
          </h3>
          <p className="text-slate-600 dark:text-slate-400 max-w-md">
            Statistics will appear here when containers are running. Start your services to see
            real-time metrics.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg flex items-center justify-center">
            <ChartBarIcon className="w-4 h-4 text-white" />
          </div>
          <div>
            <h2 className="text-xl font-semibold text-slate-900 dark:text-white">
              Container Statistics
            </h2>
            <p className="text-sm text-slate-600 dark:text-slate-400">
              Real-time metrics • Updates every 5 seconds • {containers.length} container
              {containers.length !== 1 ? 's' : ''}
            </p>
          </div>
        </div>
        <div className="flex items-center space-x-2 px-3 py-1.5 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 rounded-lg border border-green-200 dark:border-green-800">
          <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
          <span className="text-xs font-medium">Live</span>
        </div>
      </div>

      {/* Container Stats */}
      <div className="space-y-6">
        {containers.map((container) => (
          <div
            key={container.name}
            className="bg-gradient-to-br from-white/70 to-slate-50/70 dark:from-slate-800/70 dark:to-slate-900/70 backdrop-blur-sm rounded-3xl border border-slate-200/50 dark:border-slate-700/50 overflow-hidden shadow-xl shadow-slate-200/20 dark:shadow-slate-900/20"
          >
            {/* Container Header */}
            <div className="relative bg-gradient-to-r from-slate-100/80 to-white/80 dark:from-slate-800/80 dark:to-slate-700/80 px-8 py-6 border-b border-slate-200/50 dark:border-slate-700/50">
              <div className="absolute inset-0 bg-gradient-to-r from-blue-500/5 to-purple-500/5"></div>
              <div className="relative flex items-center justify-between">
                <div className="flex items-center space-x-4">
                  <div className="w-14 h-14 bg-gradient-to-br from-blue-500 to-purple-600 rounded-2xl flex items-center justify-center shadow-lg shadow-blue-500/25">
                    <ServerIconSolid className="w-7 h-7 text-white" />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-slate-900 dark:text-white">
                      {container.name}
                    </h3>
                    <p className="text-sm text-slate-600 dark:text-slate-400">
                      Service: <span className="font-medium">{container.service_name}</span>
                    </p>
                  </div>
                </div>
                <div className="flex items-center space-x-3">
                  <div className="px-4 py-2 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 rounded-xl border border-green-200 dark:border-green-800 text-sm font-medium">
                    ● Running
                  </div>
                </div>
              </div>
            </div>

            {/* Metrics Grid */}
            <div className="p-8">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                {/* CPU Usage */}
                <MetricCard
                  title="CPU Usage"
                  value={formatPercent(container.cpu_percent)}
                  subValue={`${container.cpu_user_time}ms user, ${container.cpu_system_time}ms system`}
                  percent={container.cpu_percent}
                  icon={CpuChipIcon}
                  iconSolid={CpuChipIconSolid}
                  gradient={getUsageColor(container.cpu_percent)}
                >
                  <ProgressBar
                    percent={container.cpu_percent}
                    gradient={getUsageColor(container.cpu_percent)}
                  />
                </MetricCard>

                {/* Memory Usage */}
                <MetricCard
                  title="Memory Usage"
                  value={formatBytes(container.memory_usage)}
                  subValue={`${formatPercent(container.memory_percent)} of ${formatBytes(container.memory_limit)}`}
                  percent={container.memory_percent}
                  icon={CircleStackIcon}
                  iconSolid={CircleStackIconSolid}
                  gradient={getUsageColor(container.memory_percent)}
                >
                  <ProgressBar
                    percent={container.memory_percent}
                    gradient={getUsageColor(container.memory_percent)}
                  />
                </MetricCard>

                {/* Network I/O */}
                <MetricCard
                  title="Network I/O"
                  value={formatBytes(container.network_rx_bytes + container.network_tx_bytes)}
                  subValue={`${formatNumber(container.network_rx_packets + container.network_tx_packets)} packets`}
                  icon={GlobeAltIcon}
                  iconSolid={GlobeAltIconSolid}
                  gradient="from-cyan-500 to-blue-500"
                >
                  <div className="flex justify-between text-xs text-slate-600 dark:text-slate-400">
                    <div className="flex items-center space-x-1">
                      <ArrowDownIcon className="w-3 h-3" />
                      <span>{formatBytes(container.network_rx_bytes)}</span>
                    </div>
                    <div className="flex items-center space-x-1">
                      <ArrowUpIcon className="w-3 h-3" />
                      <span>{formatBytes(container.network_tx_bytes)}</span>
                    </div>
                  </div>
                </MetricCard>

                {/* Block I/O */}
                <MetricCard
                  title="Disk I/O"
                  value={formatBytes(container.block_read_bytes + container.block_write_bytes)}
                  subValue={`${formatNumber(container.block_read_ops + container.block_write_ops)} operations`}
                  icon={ServerIcon}
                  iconSolid={ServerIconSolid}
                  gradient="from-purple-500 to-pink-500"
                >
                  <div className="flex justify-between text-xs text-slate-600 dark:text-slate-400">
                    <div className="flex items-center space-x-1">
                      <ArrowDownIcon className="w-3 h-3" />
                      <span>{formatBytes(container.block_read_bytes)}</span>
                    </div>
                    <div className="flex items-center space-x-1">
                      <ArrowUpIcon className="w-3 h-3" />
                      <span>{formatBytes(container.block_write_bytes)}</span>
                    </div>
                  </div>
                </MetricCard>
              </div>

              {/* Detailed Metrics */}
              <div className="mt-8 grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Memory Details */}
                <div className="bg-gradient-to-br from-white/50 to-slate-50/50 dark:from-slate-900/50 dark:to-slate-800/50 backdrop-blur-sm rounded-2xl border border-slate-200/50 dark:border-slate-700/50 p-6">
                  <h4 className="text-sm font-semibold text-slate-900 dark:text-white mb-4 flex items-center space-x-2">
                    <CircleStackIconSolid className="w-4 h-4 text-green-500" />
                    <span>Memory Breakdown</span>
                  </h4>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="text-center">
                      <div className="text-2xl font-bold text-slate-900 dark:text-white">
                        {formatBytes(container.memory_rss)}
                      </div>
                      <div className="text-xs text-slate-500 dark:text-slate-400">RSS</div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold text-slate-900 dark:text-white">
                        {formatBytes(container.memory_cache)}
                      </div>
                      <div className="text-xs text-slate-500 dark:text-slate-400">Cache</div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold text-slate-900 dark:text-white">
                        {formatBytes(container.memory_swap)}
                      </div>
                      <div className="text-xs text-slate-500 dark:text-slate-400">Swap</div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold text-slate-900 dark:text-white">
                        {formatNumber(container.page_faults)}
                      </div>
                      <div className="text-xs text-slate-500 dark:text-slate-400">Page Faults</div>
                    </div>
                  </div>
                </div>

                {/* Network Details */}
                <div className="bg-gradient-to-br from-white/50 to-slate-50/50 dark:from-slate-900/50 dark:to-slate-800/50 backdrop-blur-sm rounded-2xl border border-slate-200/50 dark:border-slate-700/50 p-6">
                  <h4 className="text-sm font-semibold text-slate-900 dark:text-white mb-4 flex items-center space-x-2">
                    <GlobeAltIconSolid className="w-4 h-4 text-cyan-500" />
                    <span>Network Activity</span>
                  </h4>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="text-center">
                      <div className="text-2xl font-bold text-slate-900 dark:text-white">
                        {formatNumber(container.network_rx_packets)}
                      </div>
                      <div className="text-xs text-slate-500 dark:text-slate-400">RX Packets</div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold text-slate-900 dark:text-white">
                        {formatNumber(container.network_tx_packets)}
                      </div>
                      <div className="text-xs text-slate-500 dark:text-slate-400">TX Packets</div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold text-slate-900 dark:text-white">
                        {formatNumber(container.block_read_ops)}
                      </div>
                      <div className="text-xs text-slate-500 dark:text-slate-400">Read Ops</div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold text-slate-900 dark:text-white">
                        {formatNumber(container.block_write_ops)}
                      </div>
                      <div className="text-xs text-slate-500 dark:text-slate-400">Write Ops</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default StackStats;
