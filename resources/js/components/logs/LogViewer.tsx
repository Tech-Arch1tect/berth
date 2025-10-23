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

const LogViewer: React.FC<LogViewerProps> = ({ serviceName, containerName, containers = [] }) => {
  const { serverId, stackName } = useServerStack();

  const viewer = useLogViewerState({
    serverid: serverId,
    stackname: stackName,
    serviceName,
    containerName,
    containers,
  });

  const getLogLevelColor = (level?: string) => {
    switch (level) {
      case 'error':
        return 'text-red-400';
      case 'warn':
        return 'text-yellow-400';
      case 'info':
        return 'text-blue-400';
      default:
        return 'text-slate-500';
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
    <div className="flex flex-col h-full min-h-[600px]">
      <div
        className={cn(
          'flex items-center justify-between px-4 py-2 border-b',
          theme.surface.muted,
          'border-zinc-200 dark:border-zinc-800'
        )}
      >
        <div className="flex items-center gap-4 flex-1 min-w-0">
          <div className="flex items-center gap-2 min-w-0">
            <h3 className={cn('text-sm font-semibold truncate', theme.text.strong)}>
              {viewer.title}
            </h3>
            <span className={cn('text-xs truncate', theme.text.muted)}>{viewer.subtitle}</span>
          </div>

          <div className="hidden lg:flex items-center gap-3 text-xs">
            <span className={cn('font-mono', theme.text.muted)}>{viewer.logStats.total}</span>
            {viewer.logStats.error > 0 && (
              <span className="text-red-500 font-mono">{viewer.logStats.error}E</span>
            )}
            {viewer.logStats.warn > 0 && (
              <span className="text-yellow-500 font-mono">{viewer.logStats.warn}W</span>
            )}
            {viewer.logStats.info > 0 && (
              <span className="text-blue-500 font-mono">{viewer.logStats.info}I</span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div className="relative hidden md:block">
            <MagnifyingGlassIcon className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
            <input
              type="text"
              value={viewer.searchTerm}
              onChange={(e) => viewer.setSearchTerm(e.target.value)}
              placeholder="Search logs..."
              className={cn(
                'w-64 lg:w-80 pl-8 pr-2 py-1 text-xs rounded border',
                theme.forms.input
              )}
            />
          </div>

          <select
            value={viewer.tail}
            onChange={(e) => viewer.setTail(Number(e.target.value))}
            className={cn('px-2 py-1 text-xs rounded border', theme.forms.select)}
          >
            <option value={50}>50</option>
            <option value={100}>100</option>
            <option value={500}>500</option>
            <option value={1000}>1k</option>
          </select>

          <select
            value={viewer.since}
            onChange={(e) => viewer.setSince(e.target.value)}
            className={cn('px-2 py-1 text-xs rounded border', theme.forms.select)}
          >
            <option value="">All</option>
            <option value="5m">5m</option>
            <option value="1h">1h</option>
            <option value="24h">24h</option>
          </select>

          <select
            value={viewer.levelFilter}
            onChange={(e) => viewer.setLevelFilter(e.target.value)}
            className={cn('px-2 py-1 text-xs rounded border', theme.forms.select)}
          >
            <option value="all">All</option>
            <option value="error">ERR</option>
            <option value="warn">WARN</option>
            <option value="info">INFO</option>
          </select>

          {containers && containers.length > 1 && (
            <select
              value={viewer.selectedContainer}
              onChange={(e) => viewer.setSelectedContainer(e.target.value)}
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
            onClick={() => viewer.setShowTimestamps(!viewer.showTimestamps)}
            className={cn(
              'p-1.5 text-xs rounded-lg transition-colors',
              viewer.showTimestamps ? theme.buttons.primary : theme.buttons.secondary
            )}
            title="Toggle timestamps"
          >
            <span className="text-[10px] font-semibold">TS</span>
          </button>

          <button
            onClick={() => viewer.setAutoRefresh(!viewer.autoRefresh)}
            className={cn(
              'p-1.5 rounded-lg transition-colors',
              viewer.autoRefresh ? theme.buttons.primary : theme.buttons.secondary
            )}
            title={viewer.autoRefresh ? 'Auto-refresh enabled' : 'Auto-refresh disabled'}
          >
            <ArrowPathIcon className={cn('w-4 h-4', viewer.silentLoading && 'animate-spin')} />
          </button>

          <button
            onClick={() => viewer.setFollowMode(!viewer.followMode)}
            className={cn(
              'p-1.5 rounded-lg transition-colors',
              viewer.followMode ? theme.buttons.primary : theme.buttons.secondary
            )}
            title={viewer.followMode ? 'Following (auto-scroll)' : 'Paused'}
          >
            {viewer.followMode ? (
              <PlayIcon className="w-4 h-4" />
            ) : (
              <PauseIcon className="w-4 h-4" />
            )}
          </button>

          <button
            onClick={viewer.copyAllLogs}
            className={cn('p-1.5 rounded-lg transition-colors', theme.buttons.secondary)}
            title="Copy all logs"
          >
            <DocumentDuplicateIcon className="w-4 h-4" />
          </button>

          <button
            onClick={viewer.handleRefresh}
            disabled={viewer.loading}
            className={cn(
              'px-3 py-1.5 text-xs rounded-lg transition-colors disabled:opacity-50',
              theme.buttons.primary
            )}
          >
            Refresh
          </button>

          <button
            onClick={viewer.scrollToBottom}
            className={cn('p-1.5 rounded-lg transition-colors', theme.buttons.secondary)}
            title="Jump to bottom"
          >
            <ArrowDownIcon className="w-4 h-4" />
          </button>
        </div>
      </div>

      {viewer.error && (
        <div
          className={cn(
            'mx-4 mt-2 p-2 rounded text-xs flex items-center gap-2',
            theme.alerts.variants.error
          )}
        >
          <XCircleIcon className="w-4 h-4 text-red-500 flex-shrink-0" />
          <span>{viewer.error}</span>
        </div>
      )}

      <div className="flex-1 relative overflow-hidden">
        {viewer.loading && (
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-10">
            <LoadingSpinner size="md" text="Loading logs..." />
          </div>
        )}

        <div
          ref={viewer.logContainerRef}
          onScroll={viewer.handleScroll}
          className="absolute inset-0 overflow-y-auto bg-slate-950 font-mono text-xs leading-tight"
        >
          {viewer.filteredLogs.length === 0 && !viewer.loading ? (
            <div className="flex items-center justify-center h-full">
              <div className="text-center text-slate-500">
                <p className="mb-1">No logs to display</p>
                <p className="text-xs">Try adjusting your filters or refresh</p>
                <p className="text-xs mt-2">
                  Total logs: {viewer.logs.length}, Filtered: {viewer.filteredLogs.length}
                </p>
              </div>
            </div>
          ) : (
            <div className="p-2">
              {viewer.filteredLogs.map((log, index) => {
                const timestamp = formatTimestamp(log.timestamp);
                const levelColor = getLogLevelColor(log.level);

                return (
                  <div
                    key={index}
                    className="flex items-start gap-2 py-0.5 px-1 hover:bg-slate-900/50 transition-colors group"
                  >
                    {viewer.showTimestamps && (
                      <span className="text-slate-600 shrink-0 select-none w-20 text-right">
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
                      <span className="text-slate-500 shrink-0 text-xs select-none">
                        [{log.source}]
                      </span>
                    )}

                    <span className="text-slate-300 break-all flex-1 min-w-0">{log.message}</span>
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
          Showing <span className={theme.text.strong}>{viewer.filteredLogs.length}</span> of{' '}
          <span className={theme.text.strong}>{viewer.logs.length}</span>
        </span>
        {viewer.copied && <span className="text-green-500 text-xs">Copied to clipboard!</span>}
      </div>
    </div>
  );
};

export default LogViewer;
