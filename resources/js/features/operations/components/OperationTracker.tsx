import React, { useState, useEffect, useRef } from 'react';
import { XMarkIcon, ChevronDownIcon, ChevronUpIcon, ClockIcon } from '@heroicons/react/24/outline';
import { useOperationsContext } from '../contexts/OperationsContext';
import { cn } from '../../../shared/utils/cn';
import { theme } from '../../../shared/theme';

interface OperationTrackerProps {
  stackname: string;
  operationId: string;
  command: string;
  startTime: string;
  isIncomplete: boolean;
  summary: string | null;
  onDismiss: () => void;
}

export const OperationTracker: React.FC<OperationTrackerProps> = ({
  stackname,
  operationId,
  command,
  startTime,
  isIncomplete,
  summary,
  onDismiss,
}) => {
  const [expanded, setExpanded] = useState(false);
  const [prevIsComplete, setPrevIsComplete] = useState<boolean | null>(null);
  const operationRef = useRef<HTMLDivElement>(null);
  const logsEndRef = useRef<HTMLDivElement>(null);
  const logsContainerRef = useRef<HTMLDivElement>(null);
  const { getOperationLogs } = useOperationsContext();

  const logs = getOperationLogs(operationId);
  const hasCompleteLogs = logs.some((log) => log.type === 'complete');
  const isComplete = !isIncomplete || hasCompleteLogs;

  if (isComplete !== prevIsComplete) {
    setPrevIsComplete(isComplete);
    if (!isComplete && !expanded) {
      setExpanded(true);
    }
  }

  useEffect(() => {
    if (expanded && operationRef.current) {
      operationRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, [expanded]);

  useEffect(() => {
    if (expanded && logsContainerRef.current) {
      logsContainerRef.current.scrollTop = logsContainerRef.current.scrollHeight;
    }
  }, [logs, expanded]);

  const formatDuration = (startTime: string) => {
    const start = new Date(startTime);
    const now = new Date();
    const diff = Math.floor((now.getTime() - start.getTime()) / 1000);

    if (diff < 60) return `${diff}s`;
    if (diff < 3600) return `${Math.floor(diff / 60)}m ${diff % 60}s`;
    return `${Math.floor(diff / 3600)}h ${Math.floor((diff % 3600) / 60)}m`;
  };

  const isFailed = isComplete && logs.some((log) => log.type === 'complete' && !log.success);
  const isConnected = logs.length > 0 || !isComplete;

  return (
    <div
      ref={operationRef}
      className="border-b border-zinc-200 dark:border-zinc-700 last:border-b-0"
    >
      <div className="p-3">
        <div className="flex items-center justify-between">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <div
                className={cn(
                  'w-2 h-2 rounded-full flex-shrink-0',
                  isComplete
                    ? isFailed
                      ? theme.badges.dot.danger
                      : theme.badges.dot.success
                    : isConnected
                      ? cn(theme.badges.dot.info, 'animate-pulse')
                      : theme.badges.dot.warning
                )}
              />
              <span className={cn('font-medium text-sm truncate', theme.text.strong)}>
                {stackname}
              </span>
              <span className={cn('text-xs', theme.text.muted)}>•</span>
              <code
                className={cn('text-xs px-2 py-1 rounded', theme.surface.code, theme.text.strong)}
              >
                {command}
              </code>
            </div>
            <div className="flex items-center gap-2 mt-1">
              <ClockIcon className={cn('w-3 h-3', theme.text.subtle)} />
              <span className={cn('text-xs', theme.text.muted)}>{formatDuration(startTime)}</span>
              {logs.length > 0 && (
                <>
                  <span className={cn('text-xs', theme.text.subtle)}>•</span>
                  <span className={cn('text-xs', theme.text.muted)}>{logs.length} messages</span>
                </>
              )}
            </div>
            {summary && (
              <div className="mt-1">
                <span className={cn('text-xs italic truncate block', theme.text.muted)}>
                  {summary}
                </span>
              </div>
            )}
          </div>

          <div className="flex items-center gap-1">
            <button
              onClick={() => setExpanded(!expanded)}
              aria-label={expanded ? 'Collapse output' : 'Expand output'}
              className={cn(
                'flex h-11 w-11 items-center justify-center rounded-lg transition-colors',
                theme.text.info,
                'hover:bg-teal-100 dark:hover:bg-teal-900/30'
              )}
            >
              {expanded ? (
                <ChevronUpIcon className="w-4 h-4" />
              ) : (
                <ChevronDownIcon className="w-4 h-4" />
              )}
            </button>
            <button
              onClick={onDismiss}
              aria-label={isComplete ? 'Dismiss' : 'Remove (operation may still be running)'}
              className={cn(
                'flex h-11 w-11 items-center justify-center rounded-lg transition-colors',
                theme.text.danger,
                'hover:bg-rose-100 dark:hover:bg-rose-900/30'
              )}
            >
              <XMarkIcon className="w-4 h-4" />
            </button>
          </div>
        </div>

        {expanded && (
          <div
            ref={logsContainerRef}
            className="mt-3 bg-slate-950 rounded-lg p-3 max-h-64 overflow-y-auto"
          >
            <div className="font-mono text-xs space-y-1">
              {logs.length === 0 ? (
                <div className={cn('text-center py-2', theme.text.subtle)}>
                  Waiting for output...
                </div>
              ) : (
                logs.map((log, idx) => (
                  <div
                    key={idx}
                    className={
                      log.type === 'stderr' || log.type === 'error'
                        ? theme.logs.level.error
                        : log.type === 'complete'
                          ? log.success
                            ? theme.logs.level.success
                            : theme.logs.level.error
                          : 'text-slate-300'
                    }
                  >
                    {log.data ||
                      (log.type === 'complete' && (log.success ? '✓ Complete' : '✗ Failed'))}
                  </div>
                ))
              )}
              <div ref={logsEndRef} />
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
