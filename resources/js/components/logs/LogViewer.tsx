import React from 'react';
import { LogViewerProps } from '../../types/logs';
import { useLogViewerState } from '../../hooks/useLogViewerState';
import {
  MagnifyingGlassIcon,
  ArrowPathIcon,
  ArrowDownIcon,
  FunnelIcon,
  DocumentDuplicateIcon,
  PauseIcon,
  PlayIcon,
  ChevronDownIcon,
  XCircleIcon,
  CheckCircleIcon,
} from '@heroicons/react/24/outline';
import {
  ExclamationTriangleIcon as ExclamationTriangleIconSolid,
  InformationCircleIcon as InformationCircleIconSolid,
  XCircleIcon as XCircleIconSolid,
} from '@heroicons/react/24/solid';
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

  const getLogLevelStyle = (level?: string) => {
    switch (level) {
      case 'error':
        return {
          icon: XCircleIconSolid,
          bgClass: 'bg-red-500/10 border-red-500/20',
          textClass: theme.logs.level.error,
          dotClass: 'bg-red-500',
        };
      case 'warn':
        return {
          icon: ExclamationTriangleIconSolid,
          bgClass: 'bg-yellow-500/10 border-yellow-500/20',
          textClass: theme.logs.level.warn,
          dotClass: 'bg-yellow-500',
        };
      case 'info':
        return {
          icon: InformationCircleIconSolid,
          bgClass: 'bg-blue-500/10 border-blue-500/20',
          textClass: theme.logs.level.info,
          dotClass: 'bg-blue-500',
        };
      default:
        return {
          icon: CheckCircleIcon,
          bgClass: 'bg-slate-500/10 border-slate-500/20',
          textClass: theme.logs.level.debug,
          dotClass: 'bg-slate-500',
        };
    }
  };

  const formatTimestamp = (timestamp: string) => {
    try {
      const date = new Date(timestamp);
      return {
        time: date.toLocaleTimeString('en-GB', { hour12: false }),
        date: date.toLocaleDateString('en-GB'),
        full: date.toLocaleString('en-GB'),
      };
    } catch {
      return { time: timestamp, date: '', full: timestamp };
    }
  };

  return (
    <div
      className={cn(
        'min-h-[600px] backdrop-blur-sm rounded-2xl shadow-xl overflow-hidden flex flex-col',
        theme.containers.card,
        'border-slate-200/50 dark:border-slate-700/50'
      )}
    >
      {/* Header */}
      <div
        className={cn(
          'relative border-b border-slate-200/50 dark:border-slate-700/50',
          theme.surface.muted
        )}
      >
        <div className="absolute inset-0 bg-gradient-to-r from-blue-500/5 to-purple-500/5"></div>
        <div className="relative px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-3">
                <div
                  className={cn(
                    'w-10 h-10 rounded-xl flex items-center justify-center',
                    theme.brand.stack
                  )}
                >
                  <DocumentDuplicateIcon className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h2 className={cn('text-lg font-semibold', theme.text.strong)}>{viewer.title}</h2>
                  <p className={cn('text-sm', theme.text.muted)}>{viewer.subtitle}</p>
                </div>
              </div>

              {/* Stats */}
              <div className="hidden md:flex items-center space-x-4 ml-8">
                <div className="flex items-center space-x-1.5 text-xs">
                  <div className="w-2 h-2 bg-slate-400 rounded-full"></div>
                  <span className={cn('font-medium', theme.text.muted)}>
                    {viewer.logStats.total}
                  </span>
                </div>
                {viewer.logStats.error > 0 && (
                  <div className="flex items-center space-x-1.5 text-xs">
                    <div className="w-2 h-2 bg-red-500 rounded-full"></div>
                    <span className={cn('font-medium', theme.text.danger)}>
                      {viewer.logStats.error}
                    </span>
                  </div>
                )}
                {viewer.logStats.warn > 0 && (
                  <div className="flex items-center space-x-1.5 text-xs">
                    <div className="w-2 h-2 bg-yellow-500 rounded-full"></div>
                    <span className={cn('font-medium', theme.text.warning)}>
                      {viewer.logStats.warn}
                    </span>
                  </div>
                )}
                {viewer.logStats.info > 0 && (
                  <div className="flex items-center space-x-1.5 text-xs">
                    <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                    <span className={cn('font-medium', theme.text.info)}>
                      {viewer.logStats.info}
                    </span>
                  </div>
                )}
              </div>
            </div>

            <div className="flex items-center space-x-2">
              <button
                onClick={() => viewer.setIsFilterPanelOpen(!viewer.isFilterPanelOpen)}
                className={cn(
                  'px-3 py-2 rounded-xl text-sm font-medium transition-all duration-200 flex items-center space-x-2',
                  viewer.isFilterPanelOpen
                    ? cn(theme.badges.tag.info)
                    : cn(
                        'bg-white/50 dark:bg-slate-700/50 hover:bg-white dark:hover:bg-slate-700',
                        theme.text.muted
                      )
                )}
              >
                <FunnelIcon className="w-4 h-4" />
                <span className="hidden sm:inline">Filters</span>
                <ChevronDownIcon
                  className={`w-3 h-3 transition-transform duration-200 ${viewer.isFilterPanelOpen ? 'rotate-180' : ''}`}
                />
              </button>

              <button
                onClick={viewer.copyAllLogs}
                className={cn(
                  'px-3 py-2 bg-white/50 dark:bg-slate-700/50 hover:bg-white dark:hover:bg-slate-700 rounded-xl text-sm font-medium transition-all duration-200 flex items-center space-x-2',
                  theme.text.muted
                )}
              >
                <DocumentDuplicateIcon className="w-4 h-4" />
                <span className="hidden sm:inline">{viewer.copied ? 'Copied!' : 'Copy'}</span>
              </button>

              <button
                onClick={viewer.handleRefresh}
                disabled={viewer.loading}
                className={cn(
                  'px-3 py-2 rounded-xl text-sm font-medium transition-all duration-200 flex items-center space-x-2 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-blue-500/25',
                  theme.brand.accent
                )}
              >
                <ArrowPathIcon className={`w-4 h-4 ${viewer.loading ? 'animate-spin' : ''}`} />
                <span className="hidden sm:inline">Refresh</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Filter Panel */}
      {viewer.isFilterPanelOpen && (
        <div
          className={cn(
            'border-b border-slate-200/50 dark:border-slate-700/50',
            theme.surface.muted
          )}
        >
          <div className="px-6 py-4">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
              {/* Search */}
              <div className="lg:col-span-2">
                <label className={cn('block text-sm font-medium mb-2', theme.forms.label)}>
                  Search Logs
                </label>
                <div className="relative">
                  <MagnifyingGlassIcon
                    className={cn(
                      'absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4',
                      theme.text.subtle
                    )}
                  />
                  <input
                    type="text"
                    value={viewer.searchTerm}
                    onChange={(e) => viewer.setSearchTerm(e.target.value)}
                    placeholder="Filter logs by content..."
                    className={cn(
                      'w-full pl-10 pr-4 py-2.5 rounded-xl transition-all duration-200',
                      theme.forms.input
                    )}
                  />
                </div>
              </div>

              {/* Lines */}
              <div>
                <label className={cn('block text-sm font-medium mb-2', theme.forms.label)}>
                  Lines to Show
                </label>
                <select
                  value={viewer.tail}
                  onChange={(e) => viewer.setTail(Number(e.target.value))}
                  className={cn(
                    'w-full px-3 py-2.5 rounded-xl transition-all duration-200',
                    theme.forms.select
                  )}
                >
                  <option value={50}>50 lines</option>
                  <option value={100}>100 lines</option>
                  <option value={500}>500 lines</option>
                  <option value={1000}>1000 lines</option>
                </select>
              </div>

              {/* Time Range */}
              <div>
                <label className={cn('block text-sm font-medium mb-2', theme.forms.label)}>
                  Time Range
                </label>
                <select
                  value={viewer.since}
                  onChange={(e) => viewer.setSince(e.target.value)}
                  className={cn(
                    'w-full px-3 py-2.5 rounded-xl transition-all duration-200',
                    theme.forms.select
                  )}
                >
                  <option value="">All time</option>
                  <option value="5m">Last 5 minutes</option>
                  <option value="1h">Last hour</option>
                  <option value="24h">Last 24 hours</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Level Filter */}
              <div>
                <label className={cn('block text-sm font-medium mb-2', theme.forms.label)}>
                  Log Level
                </label>
                <select
                  value={viewer.levelFilter}
                  onChange={(e) => viewer.setLevelFilter(e.target.value)}
                  className={cn(
                    'w-full px-3 py-2.5 rounded-xl transition-all duration-200',
                    theme.forms.select
                  )}
                >
                  <option value="all">All levels</option>
                  <option value="error">Error</option>
                  <option value="warn">Warning</option>
                  <option value="info">Info</option>
                </select>
              </div>

              {/* Container Filter */}
              {containers && containers.length > 0 && (
                <div>
                  <label className={cn('block text-sm font-medium mb-2', theme.forms.label)}>
                    Container
                  </label>
                  <select
                    value={viewer.selectedContainer}
                    onChange={(e) => viewer.setSelectedContainer(e.target.value)}
                    className={cn(
                      'w-full px-3 py-2.5 rounded-xl transition-all duration-200',
                      theme.forms.select
                    )}
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

              {/* Options */}
              <div className="flex flex-col space-y-3">
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={viewer.showTimestamps}
                    onChange={(e) => viewer.setShowTimestamps(e.target.checked)}
                    className={theme.forms.checkbox}
                  />
                  <span className={cn('ml-3 text-sm font-medium', theme.forms.label)}>
                    Show timestamps
                  </span>
                </label>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Log Content */}
      <div className="relative flex-1 flex flex-col overflow-hidden">
        {viewer.loading && (
          <div
            className={cn(
              'absolute inset-0 backdrop-blur-sm flex items-center justify-center z-10',
              theme.modal.overlay
            )}
          >
            <div
              className={cn(
                'flex items-center space-x-3 px-6 py-4 rounded-xl shadow-lg',
                theme.containers.card
              )}
            >
              <LoadingSpinner size="md" text="Loading logs..." />
            </div>
          </div>
        )}

        {viewer.error && (
          <div className={cn('mx-6 my-4 p-4 rounded-xl', theme.alerts.variants.error)}>
            <div className="flex items-center space-x-3">
              <XCircleIcon className="w-5 h-5 text-red-500 flex-shrink-0" />
              <p className={cn('text-sm font-medium', theme.text.danger)}>{viewer.error}</p>
            </div>
          </div>
        )}

        {/* Log Display */}
        <div className="flex-1 relative min-h-[400px]">
          <div
            ref={viewer.logContainerRef}
            onScroll={viewer.handleScroll}
            className="absolute inset-0 overflow-y-auto bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 font-mono text-sm"
          >
            {viewer.filteredLogs.length === 0 && !viewer.loading ? (
              <div className="flex items-center justify-center h-full">
                <div className="text-center">
                  <DocumentDuplicateIcon
                    className={cn('w-12 h-12 mx-auto mb-4', theme.text.subtle)}
                  />
                  <p className="text-slate-400 text-lg font-medium mb-2">No logs to display</p>
                  <p className={cn('text-sm', theme.text.subtle)}>
                    Try adjusting your filters or refresh to load logs
                  </p>
                </div>
              </div>
            ) : (
              <div className="p-4 space-y-1">
                {viewer.filteredLogs.map((log, index) => {
                  const levelStyle = getLogLevelStyle(log.level);
                  const timestamp = formatTimestamp(log.timestamp);
                  const LevelIcon = levelStyle.icon;

                  return (
                    <div
                      key={index}
                      className={`group relative flex items-start space-x-3 p-3 rounded-lg border transition-all duration-200 hover:bg-slate-800/50 ${levelStyle.bgClass}`}
                    >
                      {/* Level Indicator */}
                      <div className="flex-shrink-0 mt-0.5">
                        <div className={`w-2 h-2 rounded-full ${levelStyle.dotClass}`}></div>
                      </div>

                      {/* Timestamp */}
                      {viewer.showTimestamps && (
                        <div className="flex-shrink-0 text-xs text-slate-500 pt-0.5 min-w-[60px] group-hover:text-slate-400 transition-colors duration-200">
                          <div className="font-medium">{timestamp.time}</div>
                        </div>
                      )}

                      {/* Source */}
                      {log.source && (
                        <div className="flex-shrink-0 text-xs">
                          <span
                            className={cn(
                              'px-2 py-1 rounded-md font-medium',
                              theme.badges.tag.info
                            )}
                          >
                            {log.source}
                          </span>
                        </div>
                      )}

                      {/* Level Badge */}
                      {log.level && (
                        <div className="flex-shrink-0">
                          <div
                            className={`flex items-center space-x-1.5 px-2 py-1 rounded-md text-xs font-medium ${levelStyle.bgClass} ${levelStyle.textClass} border`}
                          >
                            <LevelIcon className="w-3 h-3" />
                            <span className="uppercase tracking-wide">{log.level}</span>
                          </div>
                        </div>
                      )}

                      {/* Message */}
                      <div className="flex-1 text-slate-200 leading-relaxed whitespace-pre-wrap break-words pt-0.5">
                        {log.message}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div
          className={cn(
            'flex-shrink-0 px-6 py-3 border-t border-slate-200/50 dark:border-slate-700/50',
            theme.surface.muted
          )}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-6 text-sm">
              <span className={theme.text.muted}>
                Showing{' '}
                <span className={cn('font-medium', theme.text.strong)}>
                  {viewer.filteredLogs.length}
                </span>{' '}
                of{' '}
                <span className={cn('font-medium', theme.text.strong)}>{viewer.logs.length}</span>{' '}
                entries
              </span>

              {viewer.autoRefresh && (
                <div className={cn('flex items-center space-x-2', theme.text.success)}>
                  <div
                    className={`w-2 h-2 bg-green-500 rounded-full ${viewer.silentLoading ? 'animate-spin' : 'animate-pulse'}`}
                  ></div>
                  <span className="text-xs font-medium">
                    {viewer.silentLoading ? 'Checking for new logs...' : 'Auto-refreshing'}
                  </span>
                </div>
              )}
            </div>

            <div className="flex items-center space-x-3">
              <button
                onClick={() => viewer.setAutoRefresh(!viewer.autoRefresh)}
                className={cn(
                  'flex items-center space-x-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-200',
                  viewer.autoRefresh
                    ? cn(theme.badges.tag.info)
                    : cn(
                        'bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600',
                        theme.text.muted
                      )
                )}
              >
                <ArrowPathIcon className="w-3 h-3" />
                <span>{viewer.autoRefresh ? 'Auto-refresh' : 'Manual'}</span>
              </button>

              <button
                onClick={() => viewer.setFollowMode(!viewer.followMode)}
                className={cn(
                  'flex items-center space-x-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-200',
                  viewer.followMode
                    ? cn(theme.badges.tag.success)
                    : cn(
                        'bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600',
                        theme.text.muted
                      )
                )}
              >
                {viewer.followMode ? (
                  <PlayIcon className="w-3 h-3" />
                ) : (
                  <PauseIcon className="w-3 h-3" />
                )}
                <span>{viewer.followMode ? 'Following' : 'Paused'}</span>
              </button>

              <button
                onClick={viewer.scrollToBottom}
                className={cn(
                  'flex items-center space-x-2 px-3 py-1.5 bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 rounded-lg text-xs font-medium transition-all duration-200',
                  theme.text.muted
                )}
              >
                <ArrowDownIcon className="w-3 h-3" />
                <span>Jump to end</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LogViewer;
