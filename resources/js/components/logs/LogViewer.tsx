import React, { useEffect, useState, useRef } from 'react';
import { LogViewerProps, LogFilterOptions } from '../../types/logs';
import { useLogs } from '../../hooks/useLogs';

const LogViewer: React.FC<LogViewerProps> = ({
  serverId,
  stackName,
  serviceName,
  containerName,
  containers = [],
}) => {
  const [selectedContainer, setSelectedContainer] = useState<string>('');
  const [tail, setTail] = useState(100);
  const [since, setSince] = useState('');
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [showTimestamps, setShowTimestamps] = useState(true);

  const {
    logs,
    loading,
    error,
    fetchLogs,
    filteredLogs,
    searchTerm,
    setSearchTerm,
    levelFilter,
    setLevelFilter,
  } = useLogs({
    serverId,
    stackName,
    serviceName: serviceName,
    containerName: selectedContainer || containerName,
  });
  const logContainerRef = useRef<HTMLDivElement>(null);
  const intervalRef = useRef<number | undefined>(undefined);

  useEffect(() => {
    fetchLogs({ tail, since, timestamps: showTimestamps });
  }, [fetchLogs, tail, since, showTimestamps]);

  useEffect(() => {
    if (autoRefresh) {
      intervalRef.current = window.setInterval(() => {
        fetchLogs({ tail, since, timestamps: showTimestamps });
      }, 5000);
    } else if (intervalRef.current) {
      window.clearInterval(intervalRef.current);
    }

    return () => {
      if (intervalRef.current) {
        window.clearInterval(intervalRef.current);
      }
    };
  }, [autoRefresh, fetchLogs, tail, since, showTimestamps]);

  const handleRefresh = () => {
    fetchLogs({ tail, since, timestamps: showTimestamps });
  };

  const scrollToBottom = () => {
    if (logContainerRef.current) {
      logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight;
    }
  };

  const getLogLevelClass = (level?: string) => {
    switch (level) {
      case 'error':
        return 'text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20';
      case 'warn':
        return 'text-yellow-600 dark:text-yellow-400 bg-yellow-50 dark:bg-yellow-900/20';
      case 'info':
        return 'text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20';
      default:
        return 'text-gray-700 dark:text-gray-300';
    }
  };

  const formatTimestamp = (timestamp: string) => {
    try {
      return new Date(timestamp).toLocaleString();
    } catch {
      return timestamp;
    }
  };

  const title = containerName
    ? `Logs for ${containerName}`
    : serviceName
      ? `Logs for ${serviceName}`
      : `Logs for ${stackName}`;

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
      <div className="border-b border-gray-200 dark:border-gray-700 px-6 py-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-medium text-gray-900 dark:text-white">{title}</h2>
          <div className="flex items-center space-x-2">
            <button
              onClick={handleRefresh}
              disabled={loading}
              className="inline-flex items-center px-3 py-2 border border-gray-300 dark:border-gray-600 shadow-sm text-sm leading-4 font-medium rounded-md text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
            >
              <svg
                className={`-ml-0.5 mr-2 h-4 w-4 ${loading ? 'animate-spin' : ''}`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                />
              </svg>
              Refresh
            </button>
          </div>
        </div>
      </div>

      {/* Controls */}
      <div className="px-6 py-4 bg-gray-50 dark:bg-gray-700 border-b border-gray-200 dark:border-gray-600">
        <div
          className={`grid grid-cols-1 md:grid-cols-2 gap-4 ${containers && containers.length > 0 ? 'lg:grid-cols-5' : 'lg:grid-cols-4'}`}
        >
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Lines
            </label>
            <select
              value={tail}
              onChange={(e) => setTail(Number(e.target.value))}
              className="block w-full rounded-md border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
            >
              <option value={50}>50 lines</option>
              <option value={100}>100 lines</option>
              <option value={500}>500 lines</option>
              <option value={1000}>1000 lines</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Since
            </label>
            <select
              value={since}
              onChange={(e) => setSince(e.target.value)}
              className="block w-full rounded-md border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
            >
              <option value="">All time</option>
              <option value="5m">Last 5 minutes</option>
              <option value="1h">Last hour</option>
              <option value="24h">Last 24 hours</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Level
            </label>
            <select
              value={levelFilter}
              onChange={(e) => setLevelFilter(e.target.value)}
              className="block w-full rounded-md border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
            >
              <option value="all">All levels</option>
              <option value="error">Error</option>
              <option value="warn">Warning</option>
              <option value="info">Info</option>
            </select>
          </div>

          {containers && containers.length > 0 && (
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Container
              </label>
              <select
                value={selectedContainer}
                onChange={(e) => setSelectedContainer(e.target.value)}
                className="block w-full rounded-md border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
              >
                <option value="">All containers</option>
                {containers.map((container) => (
                  <option key={container.name} value={container.name}>
                    {container.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Search
            </label>
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Filter logs..."
              className="block w-full rounded-md border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
            />
          </div>
        </div>

        <div className="flex items-center space-x-4 mt-4">
          <label className="flex items-center">
            <input
              type="checkbox"
              checked={showTimestamps}
              onChange={(e) => setShowTimestamps(e.target.checked)}
              className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            />
            <span className="ml-2 text-sm text-gray-700 dark:text-gray-300">Show timestamps</span>
          </label>

          <label className="flex items-center">
            <input
              type="checkbox"
              checked={autoRefresh}
              onChange={(e) => setAutoRefresh(e.target.checked)}
              className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            />
            <span className="ml-2 text-sm text-gray-700 dark:text-gray-300">Auto refresh (5s)</span>
          </label>

          <button
            onClick={scrollToBottom}
            className="text-sm text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300"
          >
            Scroll to bottom
          </button>
        </div>
      </div>

      {/* Log Content */}
      <div className="relative">
        {loading && (
          <div className="absolute inset-0 bg-white dark:bg-gray-800 bg-opacity-75 dark:bg-opacity-75 flex items-center justify-center z-10">
            <div className="flex items-center text-gray-900 dark:text-white">
              <svg
                className="animate-spin -ml-1 mr-3 h-5 w-5 text-blue-500"
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
              >
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                ></circle>
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                ></path>
              </svg>
              Loading logs...
            </div>
          </div>
        )}

        {error && (
          <div className="p-4 bg-red-50 dark:bg-red-900/20 border-l-4 border-red-400 dark:border-red-500">
            <div className="flex">
              <div className="ml-3">
                <p className="text-sm text-red-700 dark:text-red-400">{error}</p>
              </div>
            </div>
          </div>
        )}

        <div
          ref={logContainerRef}
          className="h-96 overflow-y-auto bg-gray-900 text-gray-100 font-mono text-sm p-4"
          style={{ maxHeight: '600px' }}
        >
          {filteredLogs.length === 0 && !loading ? (
            <div className="text-gray-500 dark:text-gray-400 text-center py-8">
              No logs to display
            </div>
          ) : (
            filteredLogs.map((log, index) => (
              <div key={index} className={`py-1 px-2 rounded ${getLogLevelClass(log.level)}`}>
                <div className="flex items-start space-x-2">
                  {showTimestamps && (
                    <span className="text-gray-500 dark:text-gray-400 text-xs whitespace-nowrap">
                      {formatTimestamp(log.timestamp)}
                    </span>
                  )}
                  {log.source && (
                    <span className="text-blue-400 dark:text-blue-300 text-xs whitespace-nowrap">
                      [{log.source}]
                    </span>
                  )}
                  {log.level && (
                    <span
                      className={`text-xs uppercase font-bold whitespace-nowrap ${
                        log.level === 'error'
                          ? 'text-red-400 dark:text-red-300'
                          : log.level === 'warn'
                            ? 'text-yellow-400 dark:text-yellow-300'
                            : log.level === 'info'
                              ? 'text-blue-400 dark:text-blue-300'
                              : ''
                      }`}
                    >
                      {log.level}
                    </span>
                  )}
                  <span className="flex-1 whitespace-pre-wrap break-all">{log.message}</span>
                </div>
              </div>
            ))
          )}
        </div>

        <div className="px-4 py-2 bg-gray-100 dark:bg-gray-700 border-t border-gray-200 dark:border-gray-600 text-xs text-gray-600 dark:text-gray-400">
          Showing {filteredLogs.length} of {logs.length} log entries
        </div>
      </div>
    </div>
  );
};

export default LogViewer;
