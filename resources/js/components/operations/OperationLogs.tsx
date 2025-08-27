import React, { useEffect, useRef, useState } from 'react';
import { StreamMessage } from '../../types/operations';

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
      return new Date(timestamp).toLocaleTimeString();
    } catch {
      return '';
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

  const getLogLineClasses = (type: StreamMessage['type'], data: string = '') => {
    if (isDockerComposeInfo(type, data)) {
      return 'text-blue-300';
    }

    switch (type) {
      case 'stderr':
        return 'text-yellow-400';
      case 'error':
        return 'text-red-500 font-medium';
      case 'complete':
        return 'text-green-400 font-medium';
      case 'progress':
        return 'text-blue-400';
      default:
        return 'text-gray-300';
    }
  };

  const getLogIcon = (type: StreamMessage['type'], data: string = '') => {
    if (isDockerComposeInfo(type, data)) {
      return 'ℹ️';
    }

    switch (type) {
      case 'stderr':
        return '⚠️';
      case 'error':
        return '❌';
      case 'complete':
        return '✅';
      case 'progress':
        return '⏳';
      default:
        return '';
    }
  };

  return (
    <div className={`flex flex-col h-full ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between p-3 border-b border-gray-700 bg-gray-900">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-medium text-gray-200">Operation Logs</h3>
          {isRunning && (
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
              <span className="text-xs text-gray-400">Running</span>
            </div>
          )}
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setAutoScroll(true)}
            className={`
              text-xs px-2 py-1 rounded transition-colors duration-200
              ${
                autoScroll
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
              }
            `}
          >
            Auto-scroll
          </button>
          <span className="text-xs text-gray-400">{logs.length} lines</span>
        </div>
      </div>

      {/* Logs Container */}
      <div
        ref={logsContainerRef}
        onScroll={handleScroll}
        className="flex-1 overflow-auto bg-black p-3 text-sm font-mono"
      >
        {logs.length === 0 ? (
          <div className="text-gray-500 text-center py-8">
            {isRunning ? 'Waiting for logs...' : 'No logs available'}
          </div>
        ) : (
          <div className="space-y-1">
            {logs.map((log, index) => (
              <div
                key={index}
                className="flex items-start gap-2 group hover:bg-gray-900/50 px-1 py-0.5 rounded"
              >
                <span className="text-gray-500 text-xs mt-0.5 min-w-[60px] flex-shrink-0">
                  {formatTimestamp(log.timestamp)}
                </span>

                {log.type !== 'stdout' && (
                  <span className="flex-shrink-0 mt-0.5">
                    {getLogIcon(log.type, log.data || '')}
                  </span>
                )}

                <div
                  className={`flex-1 whitespace-pre-wrap break-all ${getLogLineClasses(log.type, log.data || '')}`}
                >
                  {log.data ||
                    (log.type === 'complete'
                      ? `Operation completed ${log.success ? 'successfully' : 'with errors'} (exit code: ${log.exitCode})`
                      : 'Unknown log entry')}
                </div>
              </div>
            ))}
            <div ref={logsEndRef} />
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="p-2 border-t border-gray-700 bg-gray-900">
        <div className="flex items-center justify-between text-xs text-gray-400">
          <span>{isRunning ? 'Operation in progress...' : 'Operation completed'}</span>
          {!autoScroll && (
            <button
              onClick={() => {
                setAutoScroll(true);
                logsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
              }}
              className="text-blue-400 hover:text-blue-300 transition-colors duration-200"
            >
              ↓ Scroll to bottom
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
