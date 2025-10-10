import {
  ArrowDownIcon,
  DocumentDuplicateIcon,
  PauseIcon,
  PlayIcon,
  ClockIcon,
  CheckCircleIcon,
} from '@heroicons/react/24/outline';
import {
  CheckCircleIcon as CheckCircleIconSolid,
  ExclamationTriangleIcon as ExclamationTriangleIconSolid,
  InformationCircleIcon as InformationCircleIconSolid,
  XCircleIcon as XCircleIconSolid,
} from '@heroicons/react/24/solid';
import React, { useEffect, useRef, useState } from 'react';
import { theme } from '../../theme';
import { cn } from '../../utils/cn';
import { StreamMessage } from '../../types/operations';
import { EmptyState } from '../common/EmptyState';

interface OperationLogsProps {
  logs: StreamMessage[];
  isRunning: boolean;
  className?: string;
}

type Severity = 'neutral' | 'info' | 'warning' | 'danger' | 'success';
type IconComponent = React.ComponentType<React.SVGProps<SVGSVGElement>>;

const severityMap: Record<
  Severity,
  {
    dot: string;
    badge: string;
    badgeText: string;
  }
> = {
  neutral: {
    dot: cn(theme.badges.dot.base, theme.badges.dot.neutral),
    badge: cn(theme.logs.badge, theme.intent.neutral.border, theme.intent.neutral.surface),
    badgeText: theme.intent.neutral.textStrong,
  },
  info: {
    dot: cn(theme.badges.dot.base, theme.badges.dot.info),
    badge: cn(theme.logs.badge, theme.intent.info.border, theme.intent.info.surface),
    badgeText: theme.intent.info.textStrong,
  },
  warning: {
    dot: cn(theme.badges.dot.base, theme.badges.dot.warning),
    badge: cn(theme.logs.badge, theme.intent.warning.border, theme.intent.warning.surface),
    badgeText: theme.intent.warning.textStrong,
  },
  danger: {
    dot: cn(theme.badges.dot.base, theme.badges.dot.danger),
    badge: cn(theme.logs.badge, theme.intent.danger.border, theme.intent.danger.surface),
    badgeText: theme.intent.danger.textStrong,
  },
  success: {
    dot: cn(theme.badges.dot.base, theme.badges.dot.success),
    badge: cn(theme.logs.badge, theme.intent.success.border, theme.intent.success.surface),
    badgeText: theme.intent.success.textStrong,
  },
};

const levelMap: Record<
  'LOG' | 'INFO' | 'WARN' | 'ERROR' | 'DONE' | 'PROGRESS',
  { label: string; severity: Severity; icon: IconComponent }
> = {
  LOG: { label: 'LOG', severity: 'neutral', icon: CheckCircleIcon },
  INFO: { label: 'INFO', severity: 'info', icon: InformationCircleIconSolid },
  WARN: { label: 'WARN', severity: 'warning', icon: ExclamationTriangleIconSolid },
  ERROR: { label: 'ERROR', severity: 'danger', icon: XCircleIconSolid },
  DONE: { label: 'DONE', severity: 'success', icon: CheckCircleIconSolid },
  PROGRESS: { label: 'PROGRESS', severity: 'info', icon: ClockIcon },
};

export const OperationLogs: React.FC<OperationLogsProps> = ({ logs, isRunning, className }) => {
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

  const resolveLevel = (log: StreamMessage) => {
    if (isDockerComposeInfo(log.type, log.data || '')) {
      return levelMap.INFO;
    }

    switch (log.type) {
      case 'stderr':
        return levelMap.WARN;
      case 'error':
        return levelMap.ERROR;
      case 'complete':
        return levelMap.DONE;
      case 'progress':
        return levelMap.PROGRESS;
      default:
        return levelMap.LOG;
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
    <div className={cn('flex flex-col min-h-[600px]', className)}>
      <div className={theme.logs.shell}>
        <div className={theme.logs.header}>
          <div className={theme.logs.headerAccent} />
          <div className={theme.logs.headerContent}>
            <div className="flex items-center gap-4">
              <div className={cn(theme.icon.squareMd, theme.brand.accent)}>
                <DocumentDuplicateIcon className="h-5 w-5" />
              </div>
              <div>
                <h3 className={cn('text-lg font-semibold', theme.text.strong)}>Operation Logs</h3>
                <div className={theme.logs.headerMeta}>
                  <span
                    className={cn(
                      theme.badges.dot.base,
                      isRunning ? theme.badges.dot.success : theme.badges.dot.neutral,
                      'h-2 w-2 rounded-full'
                    )}
                  />
                  <span
                    className={cn(
                      'font-medium',
                      isRunning ? theme.text.success : theme.text.subtle
                    )}
                  >
                    {isRunning ? 'Running' : 'Completed'}
                  </span>
                </div>
              </div>
              <div className={cn(theme.logs.stats, 'ml-8')}>
                <div className={theme.logs.statsItem}>
                  <span className={cn(theme.badges.dot.base, theme.badges.dot.neutral)} />
                  <span className={theme.text.subtle}>{logStats.total}</span>
                </div>
                {logStats.errors > 0 && (
                  <div className={theme.logs.statsItem}>
                    <span className={cn(theme.badges.dot.base, theme.badges.dot.danger)} />
                    <span className={theme.text.danger}>{logStats.errors}</span>
                  </div>
                )}
                {logStats.warnings > 0 && (
                  <div className={theme.logs.statsItem}>
                    <span className={cn(theme.badges.dot.base, theme.badges.dot.warning)} />
                    <span className={theme.text.warning}>{logStats.warnings}</span>
                  </div>
                )}
                {logStats.info > 0 && (
                  <div className={theme.logs.statsItem}>
                    <span className={cn(theme.badges.dot.base, theme.badges.dot.info)} />
                    <span className={theme.text.info}>{logStats.info}</span>
                  </div>
                )}
              </div>
            </div>

            <div className={theme.logs.toolbar}>
              <button
                type="button"
                onClick={() => setAutoScroll(!autoScroll)}
                className={cn(
                  theme.buttons.subtle,
                  'rounded-xl px-3 py-2 text-sm font-medium',
                  autoScroll
                    ? cn(theme.intent.success.surface, theme.intent.success.textStrong)
                    : 'bg-white/50 text-slate-600 hover:bg-white dark:bg-slate-700/50 dark:text-slate-300 dark:hover:bg-slate-700'
                )}
              >
                {autoScroll ? <PlayIcon className="h-4 w-4" /> : <PauseIcon className="h-4 w-4" />}
                <span className="hidden sm:inline">{autoScroll ? 'Following' : 'Paused'}</span>
              </button>

              <button
                type="button"
                onClick={copyAllLogs}
                className={cn(
                  theme.buttons.subtle,
                  'rounded-xl px-3 py-2 text-sm font-medium bg-white/50 text-slate-600 hover:bg-white dark:bg-slate-700/50 dark:text-slate-300 dark:hover:bg-slate-700'
                )}
              >
                <DocumentDuplicateIcon className="h-4 w-4" />
                <span className="hidden sm:inline">{copied ? 'Copied!' : 'Copy'}</span>
              </button>
            </div>
          </div>
        </div>

        <div className="relative flex flex-1 flex-col overflow-hidden">
          <div
            ref={logsContainerRef}
            onScroll={handleScroll}
            className={cn(theme.logs.stream, 'font-mono text-sm')}
          >
            {logs.length === 0 ? (
              <div className="flex h-full items-center justify-center">
                <EmptyState
                  icon={DocumentDuplicateIcon}
                  title={isRunning ? 'Waiting for logs...' : 'No logs available'}
                  description={
                    isRunning
                      ? 'The operation will start producing logs soon'
                      : 'This operation did not produce any output'
                  }
                  variant="info"
                  size="lg"
                />
              </div>
            ) : (
              <div className="space-y-2 p-6">
                {logs.map((log, index) => {
                  const level = resolveLevel(log);
                  const severity = severityMap[level.severity];
                  const timestamp = formatTimestamp(log.timestamp);
                  const TypeIcon = level.icon;
                  const logContent =
                    log.data ||
                    (log.type === 'complete'
                      ? `Operation completed ${log.success ? 'successfully' : 'with errors'} (exit code: ${log.exitCode})`
                      : 'Unknown log entry');

                  return (
                    <div
                      key={`${log.timestamp}-${index}`}
                      className={cn(
                        theme.logs.line,
                        'rounded-lg bg-slate-900/40 px-3 py-3 transition-colors duration-150 hover:bg-slate-900/60'
                      )}
                    >
                      <span className={severity.dot} />
                      <span className={theme.logs.timestamp}>{timestamp.time}</span>
                      <span className={cn(severity.badge, severity.badgeText)}>
                        <TypeIcon className="h-3 w-3" />
                        {level.label}
                      </span>
                      <span className={cn(theme.logs.message, 'pt-0.5')}>{logContent}</span>
                    </div>
                  );
                })}
                <div ref={logsEndRef} />
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center justify-between border-t border-slate-200/60 px-6 py-3 text-sm dark:border-slate-700/60">
          <div className="flex items-center gap-6">
            <span className={theme.text.subtle}>
              <span className={cn('font-medium', theme.text.strong)}>{logs.length}</span> log
              entries
            </span>
            <span className={theme.text.subtle}>
              {isRunning ? 'Operation in progress…' : 'Operation completed'}
            </span>
          </div>
          {!autoScroll && (
            <button
              type="button"
              onClick={() => {
                setAutoScroll(true);
                logsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
              }}
              className={cn(theme.buttons.secondary, 'rounded-lg px-3 py-1.5 text-xs')}
            >
              <ArrowDownIcon className="h-3 w-3" />
              Jump to end
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
