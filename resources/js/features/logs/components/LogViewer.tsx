import React from 'react';
import { LogViewerProps } from '../types';
import { useLogViewerState } from '../hooks/useLogViewerState';
import {
  MagnifyingGlassIcon,
  ArrowPathIcon,
  ArrowDownIcon,
  DocumentDuplicateIcon,
  ClockIcon,
  XCircleIcon,
} from '@heroicons/react/24/outline';
import { cn } from '../../../shared/utils/cn';
import { theme } from '../../../shared/theme';
import { LoadingSpinner } from '../../../shared/components/LoadingSpinner';
import { useServerStack } from '../../../shared/contexts/ServerStackContext';

const LogViewer: React.FC<LogViewerProps> = ({
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
    handleRefresh,
    scrollToBottom,
    handleScroll,
    copyAllLogs,
  } = useLogViewerState({
    serverid: serverId,
    stackname: stackName,
    containerName,
  });

  const live = autoRefresh;
  const toggleLive = () => {
    setAutoRefresh(!live);
    setFollowMode(!live);
  };

  const toolbarSelect = cn(
    'min-h-[40px] w-full sm:w-auto rounded-lg border-2 border-zinc-200 bg-white px-2 text-xs',
    'text-zinc-900 shadow-sm transition-all focus:border-teal-500 focus:ring-4 focus:ring-teal-500/10',
    'dark:border-zinc-700 dark:bg-zinc-800 dark:text-white dark:focus:border-teal-500'
  );

  const levelChip = (level: 'all' | 'error' | 'warn' | 'info', count: number, label: string) => {
    if (level !== 'all' && count === 0) return null;
    const active = levelFilter === level;
    const color =
      level === 'error'
        ? 'text-red-600 dark:text-red-400'
        : level === 'warn'
          ? 'text-amber-600 dark:text-amber-400'
          : level === 'info'
            ? 'text-blue-600 dark:text-blue-400'
            : theme.text.muted;
    return (
      <button
        key={level}
        type="button"
        aria-pressed={active}
        onClick={() => setLevelFilter(active && level !== 'all' ? 'all' : level)}
        className={cn(
          'min-h-[36px] rounded-full border px-2.5 font-mono text-xs transition-colors',
          color,
          active
            ? 'border-teal-500 bg-teal-50 dark:bg-teal-900/30'
            : 'border-zinc-200 hover:border-zinc-400 dark:border-zinc-700 dark:hover:border-zinc-500'
        )}
        title={level === 'all' ? 'Show all levels' : `Show only ${level} lines`}
      >
        {count} {label}
      </button>
    );
  };

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
          'border-b px-3 py-2 space-y-2',
          theme.surface.muted,
          'border-zinc-200 dark:border-zinc-800'
        )}
      >
        <div className="flex flex-wrap items-center gap-2">
          <h3 className={cn('text-sm font-semibold truncate mr-1', theme.text.strong)}>{title}</h3>

          <div className="flex items-center gap-1.5">
            {levelChip('all', logStats.total, 'all')}
            {levelChip('error', logStats.error, 'err')}
            {levelChip('warn', logStats.warn, 'warn')}
            {levelChip('info', logStats.info, 'info')}
          </div>

          <div className="ml-auto flex items-center gap-1.5">
            <button
              onClick={toggleLive}
              aria-pressed={live}
              className={cn(
                'min-h-[40px] flex items-center gap-1.5 rounded-lg px-3 text-xs font-medium transition-colors',
                live ? theme.buttons.primary : theme.buttons.secondary
              )}
              title="Keep fetching new logs and scroll to follow them"
            >
              <span
                className={cn(
                  'h-2 w-2 rounded-full',
                  live ? 'bg-white animate-pulse' : 'bg-zinc-400 dark:bg-zinc-500'
                )}
              />
              Live
            </button>

            <button
              onClick={handleRefresh}
              disabled={loading}
              className={cn(
                'min-h-[40px] flex items-center gap-1.5 rounded-lg px-3 text-xs font-medium transition-colors disabled:opacity-50',
                theme.buttons.secondary
              )}
              title="Fetch the latest logs once"
            >
              <ArrowPathIcon
                className={cn('w-4 h-4', (loading || silentLoading) && 'animate-spin')}
              />
              Refresh
            </button>

            <button
              onClick={copyAllLogs}
              className={cn(
                'min-h-[40px] min-w-[40px] flex items-center justify-center rounded-lg transition-colors',
                theme.buttons.secondary
              )}
              title="Copy all logs"
            >
              <DocumentDuplicateIcon className="w-4 h-4" />
            </button>

            <button
              onClick={scrollToBottom}
              className={cn(
                'min-h-[40px] min-w-[40px] flex items-center justify-center rounded-lg transition-colors',
                theme.buttons.secondary
              )}
              title="Jump to bottom"
            >
              <ArrowDownIcon className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          <div className="relative basis-full lg:basis-auto lg:flex-1 lg:max-w-md">
            <MagnifyingGlassIcon
              className={cn('absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4', theme.text.muted)}
            />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search logs..."
              className={cn(
                'w-full min-h-[40px] pl-8 pr-2 text-xs rounded border',
                theme.forms.input
              )}
            />
          </div>

          <select
            value={tail}
            onChange={(e) => setTail(Number(e.target.value))}
            className={toolbarSelect}
          >
            <option value={50}>Last 50 lines</option>
            <option value={100}>Last 100 lines</option>
            <option value={500}>Last 500 lines</option>
            <option value={1000}>Last 1000 lines</option>
          </select>

          <select
            value={since}
            onChange={(e) => setSince(e.target.value)}
            className={toolbarSelect}
          >
            <option value="">All time</option>
            <option value="5m">Last 5 minutes</option>
            <option value="1h">Last hour</option>
            <option value="24h">Last 24 hours</option>
          </select>

          {containers && containers.length > 1 && (
            <select
              value={selectedContainer}
              onChange={(e) => setSelectedContainer(e.target.value)}
              className={cn(toolbarSelect, 'sm:max-w-[16rem]')}
            >
              <option value="">All containers</option>
              {containers.map((container) => (
                <option key={container.name} value={container.name}>
                  {container.name}
                </option>
              ))}
            </select>
          )}

          <button
            onClick={() => setShowTimestamps(!showTimestamps)}
            aria-pressed={showTimestamps}
            className={cn(
              'min-h-[40px] flex items-center gap-1.5 rounded-lg px-3 text-xs font-medium transition-colors',
              showTimestamps ? theme.buttons.primary : theme.buttons.secondary
            )}
            title="Show or hide timestamps"
          >
            <ClockIcon className="w-4 h-4" />
            Timestamps
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
