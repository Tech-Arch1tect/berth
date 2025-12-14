import React from 'react';
import { LogViewerProps } from '../../types/logs';
import { useLogViewerState } from '../../hooks/useLogViewerState';
import {
  MagnifyingGlassIcon,
  ArrowPathIcon,
  ArrowDownIcon,
  DocumentDuplicateIcon,
  PlayIcon,
  PauseIcon,
  XCircleIcon,
} from '@heroicons/react/24/outline';
import { cn } from '../../utils/cn';
import { theme } from '../../theme';
import { LoadingSpinner } from '../common/LoadingSpinner';
import { useServerStack } from '../../contexts/ServerStackContext';

const LogViewer: React.FC<LogViewerProps> = ({
  serviceName,
  containerName,
  containers = [],
  compact = false,
}) => {
  const { serverId, stackName } = useServerStack();

  const {
    selectedContainer,
    setSelectedContainer,
    tail,
    setTail,
    since,
    setSince,
    autoRefresh,
    setAutoRefresh,
    showTimestamps,
    setShowTimestamps,
    copied,
    followMode,
    setFollowMode,
    silentLoading,
    logContainerRef,
    logs,
    filteredLogs,
    loading,
    error,
    searchTerm,
    setSearchTerm,
    levelFilter,
    setLevelFilter,
    logStats,
    title,
    subtitle,
    handleRefresh,
    scrollToBottom,
    handleScroll,
    copyAllLogs,
  } = useLogViewerState({
    serverid: serverId,
    stackname: stackName,
    serviceName,
    containerName,
  });

  const getLogLevelColor = (level?: string) => {
    switch (level) {
      case 'error':
        return 'text-red-600 dark:text-red-400';
      case 'warn':
        return 'text-amber-600 dark:text-amber-400';
      case 'info':
        return 'text-blue-600 dark:text-blue-400';
      default:
        return 'text-zinc-500 dark:text-zinc-400';
    }
  };

  const formatTimestamp = (timestamp: string) => {
    try {
      const date = new Date(timestamp);
      const time = date.toLocaleTimeString('en-GB', { hour12: false });
      const ms = String(date.getMilliseconds()).padStart(3, '0');
      return `${time}.${ms}`;
    } catch {
      return timestamp;
    }
  };

  return (
    <div className={cn('flex flex-col h-full', !compact && 'min-h-[600px]')}>
      <div
        className={cn(
          'flex items-center justify-between px-4 py-2 border-b',
          theme.surface.muted,
          'border-zinc-200 dark:border-zinc-800'
        )}
      >
        <div className="flex items-center gap-4 flex-1 min-w-0">
          <div className="flex items-center gap-2 min-w-0">
            <h3 className={cn('text-sm font-semibold truncate', theme.text.strong)}>{title}</h3>
            <span className={cn('text-xs truncate', theme.text.muted)}>{subtitle}</span>
          </div>

          <div className="hidden lg:flex items-center gap-3 text-xs">
            <span className={cn('font-mono', theme.text.muted)}>{logStats.total}</span>
            {logStats.error > 0 && (
              <span className="text-red-500 font-mono">{logStats.error}E</span>
            )}
            {logStats.warn > 0 && (
              <span className="text-yellow-500 font-mono">{logStats.warn}W</span>
            )}
            {logStats.info > 0 && <span className="text-blue-500 font-mono">{logStats.info}I</span>}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div className="relative hidden md:block">
            <MagnifyingGlassIcon
              className={cn(
                'absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5',
                theme.text.muted
              )}
            />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search logs..."
              className={cn(
                'w-64 lg:w-80 pl-8 pr-2 py-1 text-xs rounded border',
                theme.forms.input
              )}
            />
          </div>

          <select
            value={tail}
            onChange={(e) => setTail(Number(e.target.value))}
            className={cn('px-2 py-1 text-xs rounded border', theme.forms.select)}
          >
            <option value={50}>50</option>
            <option value={100}>100</option>
            <option value={500}>500</option>
            <option value={1000}>1k</option>
          </select>

          <select
            value={since}
            onChange={(e) => setSince(e.target.value)}
            className={cn('px-2 py-1 text-xs rounded border', theme.forms.select)}
          >
            <option value="">All</option>
            <option value="5m">5m</option>
            <option value="1h">1h</option>
            <option value="24h">24h</option>
          </select>

          <select
            value={levelFilter}
            onChange={(e) => setLevelFilter(e.target.value)}
            className={cn('px-2 py-1 text-xs rounded border', theme.forms.select)}
          >
            <option value="all">All</option>
            <option value="error">ERR</option>
            <option value="warn">WARN</option>
            <option value="info">INFO</option>
          </select>

          {containers && containers.length > 1 && (
            <select
              value={selectedContainer}
              onChange={(e) => setSelectedContainer(e.target.value)}
              className={cn('px-2 py-1 text-xs rounded border', theme.forms.select)}
            >
              <option value="">All</option>
              {containers.map((container) => (
                <option key={container.name} value={container.name}>
                  {container.name}
                </option>
              ))}
            </select>
          )}

          <button
            onClick={() => setShowTimestamps(!showTimestamps)}
            className={cn(
              'p-1.5 text-xs rounded-lg transition-colors',
              showTimestamps ? theme.buttons.primary : theme.buttons.secondary
            )}
            title="Toggle timestamps"
          >
            <span className="text-[10px] font-semibold">TS</span>
          </button>

          <button
            onClick={() => setAutoRefresh(!autoRefresh)}
            className={cn(
              'p-1.5 rounded-lg transition-colors',
              autoRefresh ? theme.buttons.primary : theme.buttons.secondary
            )}
            title={autoRefresh ? 'Auto-refresh enabled' : 'Auto-refresh disabled'}
          >
            <ArrowPathIcon className={cn('w-4 h-4', silentLoading && 'animate-spin')} />
          </button>

          <button
            onClick={() => setFollowMode(!followMode)}
            className={cn(
              'p-1.5 rounded-lg transition-colors',
              followMode ? theme.buttons.primary : theme.buttons.secondary
            )}
            title={followMode ? 'Following (auto-scroll)' : 'Paused'}
          >
            {followMode ? <PlayIcon className="w-4 h-4" /> : <PauseIcon className="w-4 h-4" />}
          </button>

          <button
            onClick={copyAllLogs}
            className={cn('p-1.5 rounded-lg transition-colors', theme.buttons.secondary)}
            title="Copy all logs"
          >
            <DocumentDuplicateIcon className="w-4 h-4" />
          </button>

          <button
            onClick={handleRefresh}
            disabled={loading}
            className={cn(
              'px-3 py-1.5 text-xs rounded-lg transition-colors disabled:opacity-50',
              theme.buttons.primary
            )}
          >
            Refresh
          </button>

          <button
            onClick={scrollToBottom}
            className={cn('p-1.5 rounded-lg transition-colors', theme.buttons.secondary)}
            title="Jump to bottom"
          >
            <ArrowDownIcon className="w-4 h-4" />
          </button>
        </div>
      </div>

      {error && (
        <div
          className={cn(
            'mx-4 mt-2 p-2 rounded text-xs flex items-center gap-2',
            theme.alerts.variants.error
          )}
        >
          <XCircleIcon className="w-4 h-4 text-red-500 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <div className="flex-1 relative overflow-hidden">
        {loading && (
          <div className="absolute inset-0 bg-white/80 dark:bg-zinc-900/50 backdrop-blur-sm flex items-center justify-center z-10">
            <LoadingSpinner size="md" text="Loading logs..." />
          </div>
        )}

        <div
          ref={logContainerRef}
          onScroll={handleScroll}
          className={cn(
            'absolute inset-0 overflow-y-auto font-mono text-xs leading-tight',
            'bg-zinc-50 dark:bg-zinc-950'
          )}
        >
          {filteredLogs.length === 0 && !loading ? (
            <div className="flex items-center justify-center h-full">
              <div className={cn('text-center', theme.text.muted)}>
                <p className="mb-1">No logs to display</p>
                <p className="text-xs">Try adjusting your filters or refresh</p>
                <p className="text-xs mt-2">
                  Total logs: {logs.length}, Filtered: {filteredLogs.length}
                </p>
              </div>
            </div>
          ) : (
            <div className="p-2">
              {filteredLogs.map((log, index) => {
                const timestamp = formatTimestamp(log.timestamp);
                const levelColor = getLogLevelColor(log.level);

                return (
                  <div
                    key={index}
                    className={cn(
                      'flex items-start gap-2 py-0.5 px-1 transition-colors group',
                      'hover:bg-zinc-200 dark:hover:bg-zinc-900/50'
                    )}
                  >
                    {showTimestamps && (
                      <span
                        className={cn(
                          'shrink-0 select-none w-20 text-right',
                          'text-zinc-500 dark:text-zinc-600'
                        )}
                      >
                        {timestamp}
                      </span>
                    )}

                    {log.level && (
                      <span
                        className={cn('shrink-0 w-5 text-right uppercase select-none', levelColor)}
                      >
                        {log.level[0]}
                      </span>
                    )}

                    {log.source && (
                      <span
                        className={cn(
                          'shrink-0 text-xs select-none',
                          'text-zinc-500 dark:text-zinc-500'
                        )}
                      >
                        [{log.source}]
                      </span>
                    )}

                    <span
                      className={cn('break-all flex-1 min-w-0', 'text-zinc-900 dark:text-zinc-300')}
                    >
                      {log.message}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      <div
        className={cn(
          'px-4 py-1.5 border-t text-xs flex items-center justify-between',
          theme.surface.muted,
          'border-zinc-200 dark:border-zinc-800'
        )}
      >
        <span className={theme.text.muted}>
          Showing <span className={theme.text.strong}>{filteredLogs.length}</span> of{' '}
          <span className={theme.text.strong}>{logs.length}</span>
        </span>
        {copied && <span className="text-green-500 text-xs">Copied to clipboard!</span>}
      </div>
    </div>
  );
};

export default LogViewer;
