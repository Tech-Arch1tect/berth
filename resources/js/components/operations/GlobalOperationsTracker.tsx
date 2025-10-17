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
import { Modal } from '../common/Modal';
import { cn } from '../../utils/cn';
import { theme } from '../../theme';
import { EmptyState } from '../common/EmptyState';

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
  const operationRef = useRef<HTMLDivElement>(null);
  const logsEndRef = useRef<HTMLDivElement>(null);
  const logsContainerRef = useRef<HTMLDivElement>(null);
  const { getOperationLogs } = useOperationsContext();

  const logs = getOperationLogs(operationId);
  const isComplete = logs.some((log) => log.type === 'complete');

  useEffect(() => {
    if (!isComplete && !expanded) {
      setExpanded(true);
    }
  }, [isComplete, expanded]);

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
          </div>

          <div className="flex items-center gap-1">
            <button
              onClick={() => setExpanded(!expanded)}
              className={cn(
                'p-2 rounded-lg transition-colors',
                theme.text.info,
                'hover:bg-teal-100 dark:hover:bg-teal-900/30'
              )}
              title={expanded ? 'Collapse' : 'Expand'}
            >
              {expanded ? (
                <ChevronUpIcon className="w-4 h-4" />
              ) : (
                <ChevronDownIcon className="w-4 h-4" />
              )}
            </button>
            <button
              onClick={onDismiss}
              className={cn(
                'p-2 rounded-lg transition-colors',
                theme.text.danger,
                'hover:bg-rose-100 dark:hover:bg-rose-900/30'
              )}
              title={isComplete ? 'Dismiss' : 'Remove (operation may still be running)'}
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
          className={cn(
            'flex items-center gap-2 px-4 py-2 rounded-lg shadow-lg transition-colors',
            runningOps.length > 0
              ? theme.buttons.info
              : completedOps.length > 0
                ? theme.buttons.success
                : cn(
                    'bg-slate-200 hover:bg-slate-300 dark:bg-slate-700 dark:hover:bg-slate-600',
                    theme.text.standard
                  )
          )}
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
      <Modal
        isOpen={true}
        onClose={handleClose}
        title="Advanced Operations"
        subtitle={`${advancedMode.stackname} on Server ${advancedMode.serverid}`}
        size="2xl"
        headerExtra={
          advancedOps ? (
            <div className="flex items-center gap-2">
              <div
                className={cn(
                  'w-2 h-2 rounded-full',
                  advancedOps.isConnected
                    ? theme.badges.dot.success
                    : advancedOps.isConnecting
                      ? cn(theme.badges.dot.warning, 'animate-pulse')
                      : theme.badges.dot.danger
                )}
              />
              <span className={cn('text-xs', theme.text.muted)}>
                {advancedOps.isConnected
                  ? 'Connected'
                  : advancedOps.isConnecting
                    ? 'Connecting...'
                    : 'Disconnected'}
              </span>
            </div>
          ) : null
        }
      >
        <div
          className="-mx-6 -my-4 flex overflow-hidden bg-white dark:bg-zinc-900"
          style={{ height: '75vh' }}
        >
          {/* Operation Builder */}
          <div className="w-1/2 border-r border-zinc-200 dark:border-zinc-700 overflow-y-auto p-4 bg-white dark:bg-zinc-900">
            <h4 className={cn('text-sm font-semibold mb-3', theme.text.strong)}>
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
          <div className="w-1/2 flex flex-col overflow-hidden bg-white dark:bg-zinc-900">
            <div className="p-4 border-b border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900">
              <h4 className={cn('text-sm font-semibold', theme.text.strong)}>
                Operations ({runningOps.length} running, {completedOps.length} completed)
              </h4>
            </div>
            <div className="flex-1 overflow-y-auto bg-white dark:bg-zinc-900">
              {operations.length === 0 ? (
                <div className={cn('flex items-center justify-center h-full', theme.text.muted)}>
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
      </Modal>
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
        className={cn(
          'rounded-lg shadow-2xl flex flex-col relative w-full h-full',
          theme.containers.card
        )}
        style={{
          cursor: isResizing ? 'nwse-resize' : 'default',
          userSelect: isResizing ? 'none' : 'auto',
        }}
      >
        {/* Header */}
        <div
          className={cn(
            'flex items-center justify-between p-4 border-b rounded-t-lg',
            theme.surface.muted,
            'border-slate-200 dark:border-slate-700'
          )}
        >
          <div className="flex items-center gap-2">
            {runningOps.length > 0 ? (
              <ArrowPathIcon className={cn('w-5 h-5 animate-spin', theme.text.info)} />
            ) : (
              <Cog6ToothIcon className={cn('w-5 h-5', theme.text.subtle)} />
            )}
            <h3 className={cn('font-semibold', theme.text.strong)}>
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
              className={theme.buttons.ghost}
              title="Minimize"
            >
              <ChevronDownIcon className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Operations List */}
        <div className="flex-1 overflow-y-auto">
          {operations.length === 0 ? (
            <div className="p-8">
              <EmptyState
                icon={Cog6ToothIcon}
                title="No operations running"
                description="Docker operations will appear here when you start them."
                variant="info"
                size="sm"
              />
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
          className="absolute left-0 top-0 bottom-0 w-2 cursor-ew-resize hover:bg-blue-500/20 dark:hover:bg-blue-400/20 transition-colors z-10"
          onMouseDown={(e) => handleResizeStart(e, 'left')}
          title="Resize width"
          style={{ pointerEvents: 'auto' }}
        />
        <div
          className="absolute left-0 right-0 top-0 h-2 cursor-ns-resize hover:bg-blue-500/20 dark:hover:bg-blue-400/20 transition-colors z-10"
          onMouseDown={(e) => handleResizeStart(e, 'top')}
          title="Resize height"
          style={{ pointerEvents: 'auto' }}
        />
        <div
          className="absolute left-0 top-0 w-4 h-4 cursor-nwse-resize hover:bg-blue-500/40 dark:hover:bg-blue-400/40 transition-colors rounded-tl-lg z-10"
          onMouseDown={(e) => handleResizeStart(e, 'topleft')}
          title="Resize"
          style={{ pointerEvents: 'auto' }}
        />
      </div>
    </div>
  );
};
