import React from 'react';
import { ContainerStats } from '../../hooks/useStackStats';

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

const StackStats: React.FC<StackStatsProps> = ({ containers, isLoading, error }) => {
  if (isLoading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map((i) => (
          <div
            key={i}
            className="border border-gray-200 dark:border-gray-700 rounded-lg animate-pulse"
          >
            <div className="px-6 py-4 bg-gray-50 dark:bg-gray-700">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className="w-6 h-6 bg-gray-200 dark:bg-gray-600 rounded"></div>
                  <div>
                    <div className="w-32 h-4 bg-gray-200 dark:bg-gray-600 rounded mb-1"></div>
                    <div className="w-20 h-3 bg-gray-200 dark:bg-gray-600 rounded"></div>
                  </div>
                </div>
                <div className="w-16 h-6 bg-gray-200 dark:bg-gray-600 rounded"></div>
              </div>
            </div>
            <div className="px-6 py-4 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <div className="w-full h-4 bg-gray-200 dark:bg-gray-600 rounded"></div>
                  <div className="w-full h-2 bg-gray-200 dark:bg-gray-600 rounded"></div>
                </div>
                <div className="space-y-2">
                  <div className="w-full h-4 bg-gray-200 dark:bg-gray-600 rounded"></div>
                  <div className="w-full h-2 bg-gray-200 dark:bg-gray-600 rounded"></div>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-12">
        <div className="inline-flex items-center justify-center w-16 h-16 bg-red-100 dark:bg-red-900/20 rounded-full mb-4">
          <svg
            className="w-8 h-8 text-red-400"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
        </div>
        <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
          Failed to load statistics
        </h3>
        <p className="text-gray-600 dark:text-gray-400">{error.message}</p>
      </div>
    );
  }

  if (!containers || containers.length === 0) {
    return (
      <div className="text-center py-12">
        <div className="inline-flex items-center justify-center w-16 h-16 bg-gray-100 dark:bg-gray-800 rounded-full mb-4">
          <svg
            className="w-8 h-8 text-gray-400"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
            />
          </svg>
        </div>
        <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
          No running containers
        </h3>
        <p className="text-gray-600 dark:text-gray-400">
          Statistics will appear here when containers are running
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center space-x-2 text-sm text-gray-600 dark:text-gray-400 mb-4">
        <svg
          className="w-4 h-4 text-blue-500 dark:text-blue-400"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M13 10V3L4 14h7v7l9-11h-7z"
          />
        </svg>
        <span>Real-time resource usage • Updates every 5 seconds</span>
      </div>

      {containers.map((container) => (
        <div
          key={container.name}
          className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden"
        >
          {/* Header */}
          <div className="px-6 py-4 bg-gray-50 dark:bg-gray-700 border-b border-gray-200 dark:border-gray-600">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div className="flex-shrink-0">
                  <svg
                    className="w-6 h-6 text-blue-500 dark:text-blue-400"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"
                    />
                  </svg>
                </div>
                <div>
                  <h3 className="text-lg font-medium text-gray-900 dark:text-white">
                    {container.name}
                  </h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    Service: {container.service_name}
                  </p>
                </div>
              </div>
              <div className="flex space-x-2">
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400">
                  Running
                </span>
              </div>
            </div>
          </div>

          {/* Content */}
          <div className="px-6 py-4">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* CPU Stats */}
              <div className="space-y-4">
                <h4 className="text-sm font-semibold text-gray-900 dark:text-white border-b border-gray-200 dark:border-gray-700 pb-2">
                  CPU Statistics
                </h4>
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-700 dark:text-gray-300">CPU Usage</span>
                    <span className="text-sm font-mono text-gray-900 dark:text-white">
                      {formatPercent(container.cpu_percent)}
                    </span>
                  </div>
                  <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                    <div
                      className="bg-blue-600 dark:bg-blue-500 h-2 rounded-full transition-all duration-500"
                      style={{ width: `${Math.min(container.cpu_percent, 100)}%` }}
                    ></div>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="text-xs">
                    <div className="text-gray-500 dark:text-gray-400">User Time</div>
                    <div className="font-mono text-gray-900 dark:text-white">
                      {container.cpu_user_time}ms
                    </div>
                  </div>
                  <div className="text-xs">
                    <div className="text-gray-500 dark:text-gray-400">System Time</div>
                    <div className="font-mono text-gray-900 dark:text-white">
                      {container.cpu_system_time}ms
                    </div>
                  </div>
                </div>
              </div>

              {/* Memory Stats */}
              <div className="space-y-4">
                <h4 className="text-sm font-semibold text-gray-900 dark:text-white border-b border-gray-200 dark:border-gray-700 pb-2">
                  Memory Statistics
                </h4>
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-700 dark:text-gray-300">Memory Usage</span>
                    <span className="text-sm font-mono text-gray-900 dark:text-white">
                      {formatBytes(container.memory_usage)}
                    </span>
                  </div>
                  <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                    <div
                      className="bg-green-600 dark:bg-green-500 h-2 rounded-full transition-all duration-500"
                      style={{ width: `${Math.min(container.memory_percent, 100)}%` }}
                    ></div>
                  </div>
                  <div className="text-xs text-gray-500 dark:text-gray-400">
                    {formatPercent(container.memory_percent)} used (
                    {formatBytes(container.memory_limit)} limit)
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="text-xs">
                    <div className="text-gray-500 dark:text-gray-400">RSS</div>
                    <div className="font-mono text-gray-900 dark:text-white">
                      {formatBytes(container.memory_rss)}
                    </div>
                  </div>
                  <div className="text-xs">
                    <div className="text-gray-500 dark:text-gray-400">Cache</div>
                    <div className="font-mono text-gray-900 dark:text-white">
                      {formatBytes(container.memory_cache)}
                    </div>
                  </div>
                  <div className="text-xs">
                    <div className="text-gray-500 dark:text-gray-400">Swap</div>
                    <div className="font-mono text-gray-900 dark:text-white">
                      {formatBytes(container.memory_swap)}
                    </div>
                  </div>
                  <div className="text-xs">
                    <div className="text-gray-500 dark:text-gray-400">Page Faults</div>
                    <div className="font-mono text-gray-900 dark:text-white">
                      {container.page_faults.toLocaleString()}
                    </div>
                  </div>
                </div>
              </div>

              {/* Network Stats */}
              <div className="space-y-4">
                <h4 className="text-sm font-semibold text-gray-900 dark:text-white border-b border-gray-200 dark:border-gray-700 pb-2">
                  Network Statistics
                </h4>
                <div className="grid grid-cols-2 gap-3">
                  <div className="text-xs">
                    <div className="text-gray-500 dark:text-gray-400">RX Bytes</div>
                    <div className="font-mono text-gray-900 dark:text-white">
                      {formatBytes(container.network_rx_bytes)}
                    </div>
                  </div>
                  <div className="text-xs">
                    <div className="text-gray-500 dark:text-gray-400">TX Bytes</div>
                    <div className="font-mono text-gray-900 dark:text-white">
                      {formatBytes(container.network_tx_bytes)}
                    </div>
                  </div>
                  <div className="text-xs">
                    <div className="text-gray-500 dark:text-gray-400">RX Packets</div>
                    <div className="font-mono text-gray-900 dark:text-white">
                      {container.network_rx_packets.toLocaleString()}
                    </div>
                  </div>
                  <div className="text-xs">
                    <div className="text-gray-500 dark:text-gray-400">TX Packets</div>
                    <div className="font-mono text-gray-900 dark:text-white">
                      {container.network_tx_packets.toLocaleString()}
                    </div>
                  </div>
                </div>
              </div>

              {/* Block I/O Stats */}
              <div className="space-y-4">
                <h4 className="text-sm font-semibold text-gray-900 dark:text-white border-b border-gray-200 dark:border-gray-700 pb-2">
                  Block I/O Statistics
                </h4>
                <div className="grid grid-cols-2 gap-3">
                  <div className="text-xs">
                    <div className="text-gray-500 dark:text-gray-400">Read Bytes</div>
                    <div className="font-mono text-gray-900 dark:text-white">
                      {formatBytes(container.block_read_bytes)}
                    </div>
                  </div>
                  <div className="text-xs">
                    <div className="text-gray-500 dark:text-gray-400">Write Bytes</div>
                    <div className="font-mono text-gray-900 dark:text-white">
                      {formatBytes(container.block_write_bytes)}
                    </div>
                  </div>
                  <div className="text-xs">
                    <div className="text-gray-500 dark:text-gray-400">Read Ops</div>
                    <div className="font-mono text-gray-900 dark:text-white">
                      {container.block_read_ops.toLocaleString()}
                    </div>
                  </div>
                  <div className="text-xs">
                    <div className="text-gray-500 dark:text-gray-400">Write Ops</div>
                    <div className="font-mono text-gray-900 dark:text-white">
                      {container.block_write_ops.toLocaleString()}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
};

export default StackStats;
