import React, { useEffect, useRef, useState } from 'react';
import { StreamMessage } from '../../types/operations';
import {
  PlayIcon,
  PauseIcon,
  ArrowDownIcon,
  DocumentDuplicateIcon,
  ClockIcon,
  CheckCircleIcon,
} from '@heroicons/react/24/outline';
import {
  CheckCircleIcon as CheckCircleIconSolid,
  ExclamationTriangleIcon as ExclamationTriangleIconSolid,
  XCircleIcon as XCircleIconSolid,
  InformationCircleIcon as InformationCircleIconSolid,
} from '@heroicons/react/24/solid';

interface OperationLogsProps {
  logs: StreamMessage[];
  isRunning: boolean;
  className?: string;
}

export const OperationLogs: React.FC<OperationLogsProps> = ({
  logs,
  isRunning,
  className = '',
}) => {
  const logsEndRef = useRef<HTMLDivElement>(null);
  const logsContainerRef = useRef<HTMLDivElement>(null);
  const [autoScroll, setAutoScroll] = useState(true);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (autoScroll && logsEndRef.current) {
      logsEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [logs, autoScroll]);

  const handleScroll = () => {
    if (!logsContainerRef.current) return;

    const { scrollTop, scrollHeight, clientHeight } = logsContainerRef.current;
    const isNearBottom = scrollTop + clientHeight >= scrollHeight - 10;
    setAutoScroll(isNearBottom);
  };

  const formatTimestamp = (timestamp: string) => {
    try {
      const date = new Date(timestamp);
      return {
        time: date.toLocaleTimeString('en-GB', { hour12: false }),
        full: date.toLocaleString('en-GB'),
      };
    } catch {
      return { time: '', full: timestamp };
    }
  };

  const copyAllLogs = async () => {
    try {
      const logText = logs
        .map((log) => {
          const timestamp = formatTimestamp(log.timestamp);
          const type = log.type.toUpperCase();
          const data =
            log.data ||
            (log.type === 'complete'
              ? `Operation completed ${log.success ? 'successfully' : 'with errors'} (exit code: ${log.exitCode})`
              : 'Unknown log entry');
          return `${timestamp.full} [${type}] ${data}`;
        })
        .join('\n');

      await navigator.clipboard.writeText(logText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy logs:', err);
    }
  };

  const isDockerComposeInfo = (type: StreamMessage['type'], data: string) => {
    if (type !== 'stderr') return false;

    const infoPatterns = [
      /Container .+ (Running|Created|Started|Stopped)/,
      /Network .+ (Created|Removed)/,
      /Volume .+ (Created|Removed)/,
      /Image .+ (Pulled|Built)/,
      /Creating /,
      /Starting /,
      /Stopping /,
      /Removing /,
    ];

    return infoPatterns.some((pattern) => pattern.test(data || ''));
  };

  const getLogTypeStyle = (type: StreamMessage['type'], data: string = '') => {
    if (isDockerComposeInfo(type, data)) {
      return {
        icon: InformationCircleIconSolid,
        bgClass: 'bg-blue-500/10 border-blue-500/20',
        textClass: 'text-blue-400',
        dotClass: 'bg-blue-500',
        name: 'INFO',
      };
    }

    switch (type) {
      case 'stderr':
        return {
          icon: ExclamationTriangleIconSolid,
          bgClass: 'bg-yellow-500/10 border-yellow-500/20',
          textClass: 'text-yellow-400',
          dotClass: 'bg-yellow-500',
          name: 'WARN',
        };
      case 'error':
        return {
          icon: XCircleIconSolid,
          bgClass: 'bg-red-500/10 border-red-500/20',
          textClass: 'text-red-400',
          dotClass: 'bg-red-500',
          name: 'ERROR',
        };
      case 'complete':
        return {
          icon: CheckCircleIconSolid,
          bgClass: 'bg-green-500/10 border-green-500/20',
          textClass: 'text-green-400',
          dotClass: 'bg-green-500',
          name: 'DONE',
        };
      case 'progress':
        return {
          icon: ClockIcon,
          bgClass: 'bg-blue-500/10 border-blue-500/20',
          textClass: 'text-blue-400',
          dotClass: 'bg-blue-500',
          name: 'PROGRESS',
        };
      default:
        return {
          icon: CheckCircleIcon,
          bgClass: 'bg-slate-500/10 border-slate-500/20',
          textClass: 'text-slate-400',
          dotClass: 'bg-slate-500',
          name: 'LOG',
        };
    }
  };

  const logStats = {
    total: logs.length,
    errors: logs.filter((log) => log.type === 'error').length,
    warnings: logs.filter(
      (log) => log.type === 'stderr' && !isDockerComposeInfo(log.type, log.data || '')
    ).length,
    info: logs.filter(
      (log) => log.type === 'progress' || isDockerComposeInfo(log.type, log.data || '')
    ).length,
  };

  return (
    <div className={`flex flex-col min-h-[600px] ${className}`}>
      <div className="min-h-[600px] bg-gradient-to-br from-slate-50/80 to-white/80 dark:from-slate-900/80 dark:to-slate-800/80 backdrop-blur-sm rounded-2xl border border-slate-200/50 dark:border-slate-700/50 shadow-xl shadow-slate-200/20 dark:shadow-slate-900/20 overflow-hidden flex flex-col">
        {/* Header */}
        <div className="relative bg-gradient-to-r from-slate-100/80 to-slate-50/80 dark:from-slate-800/80 dark:to-slate-700/80 border-b border-slate-200/50 dark:border-slate-700/50">
          <div className="absolute inset-0 bg-gradient-to-r from-blue-500/5 to-purple-500/5"></div>
          <div className="relative px-6 py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-4">
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-xl flex items-center justify-center">
                    <DocumentDuplicateIcon className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-slate-900 dark:text-white">
                      Operation Logs
                    </h3>
                    <div className="flex items-center space-x-2">
                      {isRunning ? (
                        <div className="flex items-center space-x-2">
                          <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                          <span className="text-sm text-green-600 dark:text-green-400 font-medium">
                            Running
                          </span>
                        </div>
                      ) : (
                        <div className="flex items-center space-x-2">
                          <div className="w-2 h-2 bg-slate-400 rounded-full"></div>
                          <span className="text-sm text-slate-500 dark:text-slate-400 font-medium">
                            Completed
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Stats */}
                <div className="hidden md:flex items-center space-x-4 ml-8">
                  <div className="flex items-center space-x-1.5 text-xs">
                    <div className="w-2 h-2 bg-slate-400 rounded-full"></div>
                    <span className="text-slate-600 dark:text-slate-400 font-medium">
                      {logStats.total}
                    </span>
                  </div>
                  {logStats.errors > 0 && (
                    <div className="flex items-center space-x-1.5 text-xs">
                      <div className="w-2 h-2 bg-red-500 rounded-full"></div>
                      <span className="text-red-600 dark:text-red-400 font-medium">
                        {logStats.errors}
                      </span>
                    </div>
                  )}
                  {logStats.warnings > 0 && (
                    <div className="flex items-center space-x-1.5 text-xs">
                      <div className="w-2 h-2 bg-yellow-500 rounded-full"></div>
                      <span className="text-yellow-600 dark:text-yellow-400 font-medium">
                        {logStats.warnings}
                      </span>
                    </div>
                  )}
                  {logStats.info > 0 && (
                    <div className="flex items-center space-x-1.5 text-xs">
                      <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                      <span className="text-blue-600 dark:text-blue-400 font-medium">
                        {logStats.info}
                      </span>
                    </div>
                  )}
                </div>
              </div>

              <div className="flex items-center space-x-2">
                <button
                  onClick={() => setAutoScroll(!autoScroll)}
                  className={`px-3 py-2 rounded-xl text-sm font-medium transition-all duration-200 flex items-center space-x-2 ${
                    autoScroll
                      ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300'
                      : 'bg-white/50 dark:bg-slate-700/50 text-slate-600 dark:text-slate-400 hover:bg-white dark:hover:bg-slate-700'
                  }`}
                >
                  {autoScroll ? (
                    <PlayIcon className="w-4 h-4" />
                  ) : (
                    <PauseIcon className="w-4 h-4" />
                  )}
                  <span className="hidden sm:inline">{autoScroll ? 'Following' : 'Paused'}</span>
                </button>

                <button
                  onClick={copyAllLogs}
                  className="px-3 py-2 bg-white/50 dark:bg-slate-700/50 hover:bg-white dark:hover:bg-slate-700 text-slate-600 dark:text-slate-400 rounded-xl text-sm font-medium transition-all duration-200 flex items-center space-x-2"
                >
                  <DocumentDuplicateIcon className="w-4 h-4" />
                  <span className="hidden sm:inline">{copied ? 'Copied!' : 'Copy'}</span>
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Logs Container */}
        <div className="relative flex-1 flex flex-col overflow-hidden min-h-[400px]">
          <div className="flex-1 relative">
            <div
              ref={logsContainerRef}
              onScroll={handleScroll}
              className="absolute inset-0 overflow-y-auto bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 font-mono text-sm"
            >
              {logs.length === 0 ? (
                <div className="flex items-center justify-center h-full">
                  <div className="text-center">
                    <DocumentDuplicateIcon className="w-12 h-12 text-slate-500 mx-auto mb-4" />
                    <p className="text-slate-400 text-lg font-medium mb-2">
                      {isRunning ? 'Waiting for logs...' : 'No logs available'}
                    </p>
                    <p className="text-slate-500 text-sm">
                      {isRunning
                        ? 'The operation will start producing logs soon'
                        : 'This operation did not produce any output'}
                    </p>
                  </div>
                </div>
              ) : (
                <div className="p-4 space-y-1">
                  {logs.map((log, index) => {
                    const typeStyle = getLogTypeStyle(log.type, log.data || '');
                    const timestamp = formatTimestamp(log.timestamp);
                    const TypeIcon = typeStyle.icon;

                    const logContent =
                      log.data ||
                      (log.type === 'complete'
                        ? `Operation completed ${log.success ? 'successfully' : 'with errors'} (exit code: ${log.exitCode})`
                        : 'Unknown log entry');

                    return (
                      <div
                        key={index}
                        className={`group relative flex items-start space-x-3 p-3 rounded-lg border transition-all duration-200 hover:bg-slate-800/50 ${typeStyle.bgClass}`}
                      >
                        {/* Type Indicator */}
                        <div className="flex-shrink-0 mt-0.5">
                          <div className={`w-2 h-2 rounded-full ${typeStyle.dotClass}`}></div>
                        </div>

                        {/* Timestamp */}
                        <div className="flex-shrink-0 text-xs text-slate-500 pt-0.5 min-w-[60px] group-hover:text-slate-400 transition-colors duration-200">
                          <div className="font-medium">{timestamp.time}</div>
                        </div>

                        {/* Type Badge */}
                        <div className="flex-shrink-0">
                          <div
                            className={`flex items-center space-x-1.5 px-2 py-1 rounded-md text-xs font-medium ${typeStyle.bgClass} ${typeStyle.textClass} border`}
                          >
                            <TypeIcon className="w-3 h-3" />
                            <span className="uppercase tracking-wide">{typeStyle.name}</span>
                          </div>
                        </div>

                        {/* Message */}
                        <div className="flex-1 text-slate-200 leading-relaxed whitespace-pre-wrap break-words pt-0.5">
                          {logContent}
                        </div>
                      </div>
                    );
                  })}
                  <div ref={logsEndRef} />
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex-shrink-0 px-6 py-3 bg-gradient-to-r from-slate-100/80 to-slate-50/80 dark:from-slate-800/80 dark:to-slate-700/80 border-t border-slate-200/50 dark:border-slate-700/50">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-6 text-sm">
              <span className="text-slate-600 dark:text-slate-400">
                <span className="font-medium text-slate-900 dark:text-white">{logs.length}</span>{' '}
                log entries
              </span>

              <span className="text-slate-600 dark:text-slate-400">
                {isRunning ? 'Operation in progress...' : 'Operation completed'}
              </span>
            </div>

            <div className="flex items-center space-x-3">
              {!autoScroll && (
                <button
                  onClick={() => {
                    setAutoScroll(true);
                    logsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
                  }}
                  className="flex items-center space-x-2 px-3 py-1.5 bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 text-slate-600 dark:text-slate-400 rounded-lg text-xs font-medium transition-all duration-200"
                >
                  <ArrowDownIcon className="w-3 h-3" />
                  <span>Jump to end</span>
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
