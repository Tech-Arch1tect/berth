import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  XMarkIcon,
  ChevronDownIcon,
  ChevronUpIcon,
  ArrowPathIcon,
  ClockIcon,
  Cog6ToothIcon,
} from '@heroicons/react/24/outline';
import { useOperationsContext } from '../../contexts/OperationsContext';
import { StreamMessage } from '../../types/operations';
import { OperationBuilder } from './OperationBuilder';
import { useOperations } from '../../hooks/useOperations';

interface OperationTrackerProps {
  serverid: number;
  stackname: string;
  operationId: string;
  command: string;
  startTime: string;
  onDismiss: () => void;
}

const OperationTracker: React.FC<OperationTrackerProps> = ({
  serverid,
  stackname,
  operationId,
  command,
  startTime,
  onDismiss,
}) => {
  const [expanded, setExpanded] = useState(false);
  const logsEndRef = useRef<HTMLDivElement>(null);
  const { getOperationLogs } = useOperationsContext();

  const logs = getOperationLogs(operationId);

  useEffect(() => {
    if (expanded && logsEndRef.current) {
      logsEndRef.current.scrollIntoView({ behavior: 'smooth' });
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

  const isComplete = logs.some((log) => log.type === 'complete');
  const isFailed = isComplete && logs.some((log) => log.type === 'complete' && !log.success);
  const isConnected = logs.length > 0 || !isComplete;

  return (
    <div className="border-b border-gray-200 dark:border-gray-700 last:border-b-0">
      <div className="p-3">
        <div className="flex items-center justify-between">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <div
                className={`w-2 h-2 rounded-full flex-shrink-0 ${
                  isComplete
                    ? isFailed
                      ? 'bg-red-500'
                      : 'bg-green-500'
                    : isConnected
                      ? 'bg-blue-500 animate-pulse'
                      : 'bg-yellow-500'
                }`}
              />
              <span className="font-medium text-sm text-gray-900 dark:text-white truncate">
                {stackname}
              </span>
              <span className="text-xs text-gray-500 dark:text-gray-400">•</span>
              <code className="text-xs bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-gray-100 px-2 py-1 rounded">
                {command}
              </code>
            </div>
            <div className="flex items-center gap-2 mt-1">
              <ClockIcon className="w-3 h-3 text-gray-400" />
              <span className="text-xs text-gray-500 dark:text-gray-400">
                {formatDuration(startTime)}
              </span>
              {logs.length > 0 && (
                <>
                  <span className="text-xs text-gray-400">•</span>
                  <span className="text-xs text-gray-500 dark:text-gray-400">
                    {logs.length} messages
                  </span>
                </>
              )}
            </div>
          </div>

          <div className="flex items-center gap-1">
            <button
              onClick={() => setExpanded(!expanded)}
              className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-500 dark:text-gray-400"
              title={expanded ? 'Collapse' : 'Expand'}
            >
              {expanded ? (
                <ChevronUpIcon className="w-4 h-4" />
              ) : (
                <ChevronDownIcon className="w-4 h-4" />
              )}
            </button>
            {isComplete && (
              <button
                onClick={onDismiss}
                className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-500 dark:text-gray-400"
                title="Dismiss"
              >
                <XMarkIcon className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        {expanded && (
          <div className="mt-3 bg-gray-900 rounded-lg p-3 max-h-64 overflow-y-auto">
            <div className="font-mono text-xs space-y-1">
              {logs.length === 0 ? (
                <div className="text-gray-500 text-center py-2">Waiting for output...</div>
              ) : (
                logs.map((log, idx) => (
                  <div
                    key={idx}
                    className={`${
                      log.type === 'stderr' || log.type === 'error'
                        ? 'text-red-400'
                        : log.type === 'complete'
                          ? log.success
                            ? 'text-green-400'
                            : 'text-red-400'
                          : 'text-gray-300'
                    }`}
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

interface GlobalOperationsTrackerProps {
  advancedMode?: {
    serverid: string;
    stackname: string;
    services?: Array<{ name: string; service_name?: string }>;
    onClose: () => void;
  };
}

export const GlobalOperationsTracker: React.FC<GlobalOperationsTrackerProps> = ({
  advancedMode,
}) => {
  const { operations, removeOperation } = useOperationsContext();
  const [isMinimized, setIsMinimized] = useState(true);
  const [showBuilder, setShowBuilder] = useState(false);
  const [width, setWidth] = useState(384);
  const [height, setHeight] = useState(400);
  const [isResizing, setIsResizing] = useState(false);
  const resizeRef = useRef<{
    startX: number;
    startY: number;
    startWidth: number;
    startHeight: number;
  } | null>(null);

  const advancedOps = advancedMode
    ? useOperations({
        serverid: advancedMode.serverid,
        stackname: advancedMode.stackname,
        onOperationComplete: () => {},
        onError: (error) => {
          console.error('Advanced operation error:', error);
        },
      })
    : null;

  useEffect(() => {
    if (advancedMode) {
      setShowBuilder(true);
      setIsMinimized(false);
    }
  }, [advancedMode]);

  const runningOps = operations.filter((op) => op.is_incomplete);
  const completedOps = operations.filter((op) => !op.is_incomplete);

  const handleResizeStart = useCallback(
    (e: React.MouseEvent, direction: 'left' | 'top' | 'topleft') => {
      e.preventDefault();
      setIsResizing(true);
      resizeRef.current = {
        startX: e.clientX,
        startY: e.clientY,
        startWidth: width,
        startHeight: height,
      };

      const handleMouseMove = (e: MouseEvent) => {
        if (!resizeRef.current) return;

        const deltaX = resizeRef.current.startX - e.clientX;
        const deltaY = resizeRef.current.startY - e.clientY;

        if (direction === 'left' || direction === 'topleft') {
          const newWidth = Math.max(300, Math.min(800, resizeRef.current.startWidth + deltaX));
          setWidth(newWidth);
        }

        if (direction === 'top' || direction === 'topleft') {
          const newHeight = Math.max(200, Math.min(800, resizeRef.current.startHeight + deltaY));
          setHeight(newHeight);
        }
      };

      const handleMouseUp = () => {
        setIsResizing(false);
        resizeRef.current = null;
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
      };

      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
    },
    [width, height]
  );

  const handleClose = () => {
    if (advancedMode) {
      advancedMode.onClose();
    }
  };

  if (isMinimized && !advancedMode) {
    return (
      <div className="fixed bottom-4 right-4 z-50">
        <button
          onClick={() => setIsMinimized(false)}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg shadow-lg transition-colors ${
            runningOps.length > 0
              ? 'bg-blue-600 hover:bg-blue-700 text-white'
              : completedOps.length > 0
                ? 'bg-green-600 hover:bg-green-700 text-white'
                : 'bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300'
          }`}
        >
          {runningOps.length > 0 ? (
            <>
              <ArrowPathIcon className="w-4 h-4 animate-spin" />
              <span className="font-medium">
                {runningOps.length} running
                {completedOps.length > 0 && `, ${completedOps.length} completed`}
              </span>
            </>
          ) : completedOps.length > 0 ? (
            <>
              <Cog6ToothIcon className="w-4 h-4" />
              <span className="font-medium">{completedOps.length} completed</span>
            </>
          ) : (
            <>
              <Cog6ToothIcon className="w-4 h-4" />
              <span className="font-medium">Operations</span>
            </>
          )}
        </button>
      </div>
    );
  }

  if (advancedMode) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-6xl h-[80vh] flex flex-col">
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 rounded-t-lg">
            <div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                Advanced Operations
              </h3>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                {advancedMode.stackname} on Server {advancedMode.serverid}
              </p>
            </div>
            <div className="flex items-center gap-2">
              {advancedOps && (
                <div className="flex items-center gap-2">
                  <div
                    className={`w-2 h-2 rounded-full ${
                      advancedOps.isConnected
                        ? 'bg-green-500'
                        : advancedOps.isConnecting
                          ? 'bg-yellow-500 animate-pulse'
                          : 'bg-red-500'
                    }`}
                  />
                  <span className="text-xs text-gray-500 dark:text-gray-400">
                    {advancedOps.isConnected
                      ? 'Connected'
                      : advancedOps.isConnecting
                        ? 'Connecting...'
                        : 'Disconnected'}
                  </span>
                </div>
              )}
              <button
                onClick={handleClose}
                className="p-1 rounded hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-500 dark:text-gray-400"
              >
                <XMarkIcon className="w-6 h-6" />
              </button>
            </div>
          </div>

          {/* Two column layout: Builder on left, Running ops on right */}
          <div className="flex-1 flex overflow-hidden">
            {/* Operation Builder */}
            <div className="w-1/2 border-r border-gray-200 dark:border-gray-700 overflow-y-auto p-4">
              <h4 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">
                Build Custom Operation
              </h4>
              {advancedOps && (
                <OperationBuilder
                  services={advancedMode.services || []}
                  onOperationBuild={(operation) => {
                    advancedOps.startOperation(operation);
                  }}
                  disabled={advancedOps.operationStatus.isRunning}
                />
              )}
            </div>

            {/* Running Operations */}
            <div className="w-1/2 flex flex-col overflow-hidden">
              <div className="p-4 border-b border-gray-200 dark:border-gray-700">
                <h4 className="text-sm font-semibold text-gray-900 dark:text-white">
                  Operations ({runningOps.length} running, {completedOps.length} completed)
                </h4>
              </div>
              <div className="flex-1 overflow-y-auto">
                {operations.length === 0 ? (
                  <div className="flex items-center justify-center h-full text-gray-500 dark:text-gray-400">
                    No operations running
                  </div>
                ) : (
                  operations.map((op) => (
                    <OperationTracker
                      key={op.operation_id}
                      serverid={op.server_id}
                      stackname={op.stack_name}
                      operationId={op.operation_id}
                      command={op.command}
                      startTime={op.start_time}
                      onDismiss={() => removeOperation(op.operation_id)}
                    />
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className="fixed z-50"
      style={{
        bottom: '1rem',
        right: '1rem',
        width: `${width}px`,
        height: `${height}px`,
      }}
    >
      <div
        className="bg-white dark:bg-gray-800 rounded-lg shadow-2xl border border-gray-200 dark:border-gray-700 flex flex-col relative w-full h-full"
        style={{
          cursor: isResizing ? 'nwse-resize' : 'default',
          userSelect: isResizing ? 'none' : 'auto',
        }}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 rounded-t-lg">
          <div className="flex items-center gap-2">
            {runningOps.length > 0 ? (
              <ArrowPathIcon className="w-5 h-5 text-blue-600 dark:text-blue-400 animate-spin" />
            ) : (
              <Cog6ToothIcon className="w-5 h-5 text-gray-400 dark:text-gray-500" />
            )}
            <h3 className="font-semibold text-gray-900 dark:text-white">
              Operations
              {runningOps.length > 0 && ` (${runningOps.length} running)`}
              {completedOps.length > 0 &&
                runningOps.length === 0 &&
                ` (${completedOps.length} completed)`}
              {runningOps.length > 0 &&
                completedOps.length > 0 &&
                `, ${completedOps.length} completed`}
            </h3>
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setIsMinimized(true)}
              className="p-1 rounded hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-500 dark:text-gray-400"
              title="Minimize"
            >
              <ChevronDownIcon className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Operations List */}
        <div className="flex-1 overflow-y-auto">
          {operations.length === 0 ? (
            <div className="p-8 text-center text-gray-500 dark:text-gray-400">
              <Cog6ToothIcon className="w-12 h-12 mx-auto mb-3 opacity-50" />
              <p className="text-sm">No operations running</p>
            </div>
          ) : (
            operations.map((op) => (
              <OperationTracker
                key={op.operation_id}
                serverid={op.server_id}
                stackname={op.stack_name}
                operationId={op.operation_id}
                command={op.command}
                startTime={op.start_time}
                onDismiss={() => removeOperation(op.operation_id)}
              />
            ))
          )}
        </div>

        {/* Resize handles */}
        <div
          className="absolute left-0 top-0 bottom-0 w-2 cursor-ew-resize hover:bg-blue-500/20 transition-colors z-10"
          onMouseDown={(e) => handleResizeStart(e, 'left')}
          title="Resize width"
          style={{ pointerEvents: 'auto' }}
        />
        <div
          className="absolute left-0 right-0 top-0 h-2 cursor-ns-resize hover:bg-blue-500/20 transition-colors z-10"
          onMouseDown={(e) => handleResizeStart(e, 'top')}
          title="Resize height"
          style={{ pointerEvents: 'auto' }}
        />
        <div
          className="absolute left-0 top-0 w-4 h-4 cursor-nwse-resize hover:bg-blue-500/40 transition-colors rounded-tl-lg z-10"
          onMouseDown={(e) => handleResizeStart(e, 'topleft')}
          title="Resize"
          style={{ pointerEvents: 'auto' }}
        />
      </div>
    </div>
  );
};
