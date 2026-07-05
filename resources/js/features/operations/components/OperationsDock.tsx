import React from 'react';
import { Link } from '@tanstack/react-router';
import {
  ArrowPathIcon,
  ChevronDownIcon,
  ChevronUpIcon,
  Cog6ToothIcon,
  XMarkIcon,
} from '@heroicons/react/24/outline';
import { useOperationsContext } from '../contexts/OperationsContext';
import { OperationTracker } from './OperationTracker';
import { cn } from '../../../shared/utils/cn';
import { theme } from '../../../shared/theme';

export const OPERATIONS_DOCK_STRIP_HEIGHT = 44;
export const OPERATIONS_DOCK_EXPANDED_HEIGHT = 320;

interface OperationsDockProps {
  expanded: boolean;
  onToggleExpanded: () => void;
  onDismiss: () => void;
  className?: string;
  style?: React.CSSProperties;
}

export const OperationsDock: React.FC<OperationsDockProps> = ({
  expanded,
  onToggleExpanded,
  onDismiss,
  className,
  style,
}) => {
  const { operations, removeOperation, clearCompleted } = useOperationsContext();
  const runningOps = operations.filter((op) => op.is_incomplete);
  const completedCount = operations.length - runningOps.length;
  const latest = operations[0];

  if (operations.length === 0) {
    return null;
  }

  return (
    <div
      className={cn(
        'fixed left-0 right-0 z-40 border-t shadow-2xl',
        'border-zinc-200 bg-white dark:border-zinc-700 dark:bg-zinc-900',
        className
      )}
      style={{
        ...style,
        height: expanded ? OPERATIONS_DOCK_EXPANDED_HEIGHT : OPERATIONS_DOCK_STRIP_HEIGHT,
      }}
    >
      <div className="flex h-full flex-col">
        <div
          className={cn(
            'flex flex-shrink-0 items-center gap-2 px-3',
            expanded ? 'border-b border-zinc-200 py-2 dark:border-zinc-700' : 'h-full'
          )}
        >
          {runningOps.length > 0 ? (
            <ArrowPathIcon className={cn('h-4 w-4 flex-shrink-0 animate-spin', theme.text.info)} />
          ) : (
            <Cog6ToothIcon className={cn('h-4 w-4 flex-shrink-0', theme.text.subtle)} />
          )}

          <button
            type="button"
            onClick={onToggleExpanded}
            className={cn('min-w-0 flex-1 truncate text-left text-sm', theme.text.strong)}
          >
            <span className="font-semibold">
              {runningOps.length > 0
                ? `${runningOps.length} operation${runningOps.length !== 1 ? 's' : ''} running`
                : 'Operations'}
            </span>
            {!expanded && latest && (
              <span className={cn('ml-2', theme.text.muted)}>
                {latest.stack_name} · {latest.command}
              </span>
            )}
            {expanded && (
              <span className={cn('ml-2 font-normal', theme.text.muted)}>
                {operations.length - runningOps.length} completed this session
              </span>
            )}
          </button>

          {expanded && completedCount > 0 && (
            <button
              type="button"
              onClick={clearCompleted}
              className={cn(
                'whitespace-nowrap rounded-lg px-2 py-1.5 text-xs font-medium',
                theme.text.muted,
                'hover:bg-zinc-100 dark:hover:bg-zinc-800'
              )}
            >
              Clear completed
            </button>
          )}
          {expanded && (
            <Link
              to="/operation-logs"
              className={cn(
                'hidden whitespace-nowrap text-xs font-medium sm:block',
                'text-teal-600 hover:underline dark:text-teal-400'
              )}
            >
              View all in Activity
            </Link>
          )}
          <button
            type="button"
            onClick={onToggleExpanded}
            aria-label={expanded ? 'Collapse operations' : 'Expand operations'}
            className={cn(
              'flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg',
              theme.text.muted,
              'hover:bg-zinc-100 dark:hover:bg-zinc-800'
            )}
          >
            {expanded ? (
              <ChevronDownIcon className="h-4 w-4" />
            ) : (
              <ChevronUpIcon className="h-4 w-4" />
            )}
          </button>
          <button
            type="button"
            onClick={onDismiss}
            aria-label="Hide operations dock"
            className={cn(
              'flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg',
              theme.text.muted,
              'hover:bg-zinc-100 dark:hover:bg-zinc-800'
            )}
          >
            <XMarkIcon className="h-4 w-4" />
          </button>
        </div>

        {expanded && (
          <div className="min-h-0 flex-1 overflow-y-auto">
            {operations.map((op) => (
              <OperationTracker
                key={op.operation_id}
                stackname={op.stack_name}
                operationId={op.operation_id}
                command={op.command}
                startTime={op.start_time ?? ''}
                isIncomplete={op.is_incomplete}
                summary={op.summary ?? null}
                onDismiss={() => removeOperation(op.operation_id)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
