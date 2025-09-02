import React, { useState, useEffect, useRef } from 'react';
import { StreamMessage, OperationStatus } from '../../types/operations';
import {
  ChevronUpIcon,
  ChevronDownIcon,
  XMarkIcon,
  DocumentDuplicateIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon,
  XCircleIcon,
  InformationCircleIcon,
} from '@heroicons/react/24/outline';

interface QuickActionFeedbackProps {
  isVisible: boolean;
  operationType?: string;
  operationStatus: OperationStatus;
  connectionError?: string;
  onComplete?: (success: boolean, exitCode?: number) => void;
  onDismiss?: () => void;
}

export const QuickActionFeedback: React.FC<QuickActionFeedbackProps> = ({
  isVisible,
  operationType,
  operationStatus,
  connectionError,
  onComplete,
  onDismiss,
}) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [isDismissed, setIsDismissed] = useState(false);
  const [copied, setCopied] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const [hasInteracted, setHasInteracted] = useState(false);
  const logsEndRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const completionHandledRef = useRef(false);
  const dismissTimerRef = useRef<number | null>(null);

  const clearDismissTimer = () => {
    if (dismissTimerRef.current) {
      clearTimeout(dismissTimerRef.current);
      dismissTimerRef.current = null;
    }
  };

  const startDismissTimer = () => {
    clearDismissTimer();

    if (isExpanded || isHovered || hasInteracted) {
      return;
    }

    dismissTimerRef.current = setTimeout(() => {
      if (!isExpanded && !isHovered && !hasInteracted) {
        setIsDismissed(true);
        onDismiss?.();
      }
    }, 8000);
  };

  useEffect(() => {
    if (isVisible) {
      setIsDismissed(false);
      setHasInteracted(false);
      completionHandledRef.current = false;
      clearDismissTimer();
    }
  }, [isVisible, operationType]);

  useEffect(() => {
    if (isExpanded && logsEndRef.current) {
      logsEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [operationStatus.logs, isExpanded]);

  useEffect(() => {
    if (operationStatus.logs.length > 0 && !completionHandledRef.current) {
      const lastLog = operationStatus.logs[operationStatus.logs.length - 1];
      if (lastLog.type === 'complete') {
        completionHandledRef.current = true;
        onComplete?.(lastLog.success || false, lastLog.exitCode);

        startDismissTimer();
      }
    }
  }, [operationStatus.logs]);

  useEffect(() => {
    if (isHovered) {
      clearDismissTimer();
    } else if (completionHandledRef.current) {
      startDismissTimer();
    }
  }, [isHovered]);

  useEffect(() => {
    if (isExpanded) {
      clearDismissTimer();
      setHasInteracted(true);
    }
  }, [isExpanded]);

  useEffect(() => {
    return () => clearDismissTimer();
  }, []);

  if (!isVisible || isDismissed) {
    return null;
  }

  const getLogTypeIcon = (type: StreamMessage['type'], data?: string) => {
    if (type === 'stderr' && data) {
      const infoPatterns = [
        /Container .+ (Running|Created|Started|Stopped)/,
        /Network .+ (Created|Removed)/,
        /Volume .+ (Created|Removed)/,
        /Creating /,
        /Starting /,
        /Stopping /,
        /Removing /,
      ];
      if (infoPatterns.some((pattern) => pattern.test(data))) {
        return { icon: InformationCircleIcon, color: 'text-blue-400' };
      }
    }

    switch (type) {
      case 'stderr':
        return { icon: ExclamationTriangleIcon, color: 'text-yellow-400' };
      case 'error':
        return { icon: XCircleIcon, color: 'text-red-400' };
      case 'complete':
        return { icon: CheckCircleIcon, color: 'text-green-400' };
      default:
        return { icon: InformationCircleIcon, color: 'text-slate-400' };
    }
  };

  const copyLogs = async () => {
    try {
      const logText = operationStatus.logs
        .map((log) => {
          const timestamp = new Date(log.timestamp).toLocaleTimeString('en-GB', { hour12: false });
          const data =
            log.data ||
            (log.type === 'complete'
              ? `Operation completed ${log.success ? 'successfully' : 'with errors'}`
              : 'Unknown log entry');
          return `${timestamp} [${log.type.toUpperCase()}] ${data}`;
        })
        .join('\n');

      await navigator.clipboard.writeText(logText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy logs:', err);
    }
  };

  const getStatusColor = () => {
    if (connectionError) return 'border-red-500 bg-red-500/10';
    if (operationStatus.isRunning) return 'border-blue-500 bg-blue-500/10';
    if (operationStatus.logs.some((log) => log.type === 'error'))
      return 'border-red-500 bg-red-500/10';
    if (operationStatus.logs.some((log) => log.type === 'complete' && !log.success))
      return 'border-red-500 bg-red-500/10';
    if (operationStatus.logs.some((log) => log.type === 'complete' && log.success))
      return 'border-green-500 bg-green-500/10';
    return 'border-slate-500 bg-slate-500/10';
  };

  const latestLog = operationStatus.logs[operationStatus.logs.length - 1];
  const logCount = operationStatus.logs.length;

  return (
    <div
      ref={containerRef}
      className={`fixed bottom-4 right-4 z-50 transition-all duration-300 ease-in-out ${
        isExpanded ? 'w-96' : 'w-80'
      }`}
      style={{
        transform: isVisible ? 'translateY(0)' : 'translateY(100%)',
        opacity: isVisible ? 1 : 0,
      }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <div
        className={`backdrop-blur-xl bg-white/90 dark:bg-slate-900/90 rounded-xl border-2 shadow-2xl shadow-slate-900/10 transition-all duration-200 ${getStatusColor()}`}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-3 border-b border-slate-200/50 dark:border-slate-700/50">
          <div className="flex items-center space-x-2">
            <div
              className={`w-2 h-2 rounded-full ${
                operationStatus.isRunning
                  ? 'bg-blue-500 animate-pulse'
                  : operationStatus.logs.some((log) => log.type === 'complete' && log.success)
                    ? 'bg-green-500'
                    : operationStatus.logs.some(
                          (log) => log.type === 'error' || (log.type === 'complete' && !log.success)
                        )
                      ? 'bg-red-500'
                      : 'bg-slate-400'
              }`}
            ></div>
            <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
              {operationType || operationStatus.command || 'Operation'}
            </span>
            {logCount > 0 && (
              <span className="text-xs px-2 py-0.5 bg-slate-200 dark:bg-slate-700 rounded-full text-slate-600 dark:text-slate-400">
                {logCount}
              </span>
            )}
          </div>

          <div className="flex items-center space-x-1">
            {operationStatus.logs.length > 0 && !operationStatus.isRunning && (
              <button
                onClick={() => {
                  copyLogs();
                  setHasInteracted(true);
                }}
                className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
                title="Copy logs"
              >
                <DocumentDuplicateIcon className="w-4 h-4" />
              </button>
            )}
            <button
              onClick={() => {
                setIsExpanded(!isExpanded);
                setHasInteracted(true);
              }}
              className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
              title={isExpanded ? 'Collapse' : 'Expand'}
            >
              {isExpanded ? (
                <ChevronDownIcon className="w-4 h-4" />
              ) : (
                <ChevronUpIcon className="w-4 h-4" />
              )}
            </button>
            <button
              onClick={() => {
                setIsDismissed(true);
                clearDismissTimer();
                onDismiss?.();
              }}
              className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
              title="Dismiss"
            >
              <XMarkIcon className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-3">
          {/* Collapsed view - Latest log or status */}
          {!isExpanded && (
            <div className="flex items-center space-x-2">
              {operationStatus.isRunning && (
                <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin flex-shrink-0"></div>
              )}
              {latestLog && !operationStatus.isRunning && (
                <div className="flex-shrink-0">
                  {(() => {
                    const { icon: Icon, color } = getLogTypeIcon(latestLog.type, latestLog.data);
                    return <Icon className={`w-4 h-4 ${color}`} />;
                  })()}
                </div>
              )}
              <div className="flex-1 min-w-0">
                <p className="text-sm text-slate-600 dark:text-slate-400 truncate">
                  {connectionError
                    ? connectionError
                    : operationStatus.isRunning
                      ? 'Running operation...'
                      : latestLog?.data ||
                        (latestLog?.type === 'complete'
                          ? `Operation ${latestLog.success ? 'completed' : 'failed'}`
                          : 'Waiting for logs...')}
                </p>
              </div>
            </div>
          )}

          {/* Expanded view - Full logs */}
          {isExpanded && (
            <div className="space-y-2">
              {connectionError && (
                <div className="text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 p-2 rounded">
                  Connection error: {connectionError}
                </div>
              )}

              {operationStatus.logs.length === 0 && !connectionError && (
                <div className="text-center text-sm text-slate-500 dark:text-slate-400 py-4">
                  {operationStatus.isRunning ? 'Waiting for logs...' : 'No logs available'}
                </div>
              )}

              {operationStatus.logs.length > 0 && (
                <div className="max-h-48 overflow-y-auto bg-slate-950 rounded-lg p-2 font-mono text-xs">
                  {operationStatus.logs.map((log, index) => {
                    const { icon: Icon, color } = getLogTypeIcon(log.type, log.data);
                    const timestamp = new Date(log.timestamp).toLocaleTimeString('en-GB', {
                      hour12: false,
                    });
                    const logContent =
                      log.data ||
                      (log.type === 'complete'
                        ? `Operation ${log.success ? 'completed successfully' : 'failed'}`
                        : 'Unknown log entry');

                    return (
                      <div key={index} className="flex items-start space-x-2 py-0.5">
                        <span className="text-slate-500 text-xs flex-shrink-0 min-w-[60px]">
                          {timestamp}
                        </span>
                        <Icon className={`w-3 h-3 flex-shrink-0 mt-0.5 ${color}`} />
                        <span className="text-slate-200 flex-1 break-words">{logContent}</span>
                      </div>
                    );
                  })}
                  <div ref={logsEndRef} />
                </div>
              )}

              {copied && (
                <div className="text-xs text-green-600 dark:text-green-400 text-center">
                  Logs copied to clipboard!
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
