import React from 'react';
import { ArrowPathIcon, Cog6ToothIcon } from '@heroicons/react/24/outline';
import { useOperationsContext } from '../contexts/OperationsContext';
import { OperationTracker } from './OperationTracker';
import { cn } from '../../../shared/utils/cn';
import { theme } from '../../../shared/theme';

export const RunningOperationsPanel: React.FC = () => {
  const { operations, removeOperation, clearCompleted, dockState, setDockState } =
    useOperationsContext();
  const runningOps = operations.filter((op) => op.is_incomplete);
  const completedOps = operations.filter((op) => !op.is_incomplete);

  if (operations.length === 0) {
    return null;
  }

  return (
    <div className="border-b border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
      <div
        className={cn(
          'flex flex-wrap items-center gap-2 border-b px-4 py-2',
          'border-zinc-200 dark:border-zinc-800',
          theme.surface.muted
        )}
      >
        {runningOps.length > 0 ? (
          <ArrowPathIcon className={cn('h-4 w-4 animate-spin', theme.text.info)} />
        ) : (
          <Cog6ToothIcon className={cn('h-4 w-4', theme.text.subtle)} />
        )}
        <h3 className={cn('min-w-0 flex-1 text-sm font-semibold', theme.text.strong)}>
          Live operations
          <span className={cn('ml-2 font-normal', theme.text.muted)}>
            {runningOps.length} running · {completedOps.length} completed this session
          </span>
        </h3>
        {dockState === 'hidden' && (
          <button
            type="button"
            onClick={() => setDockState('expanded')}
            className={cn(
              'whitespace-nowrap rounded-lg px-2 py-1.5 text-xs font-medium',
              'text-teal-600 hover:bg-teal-50 dark:text-teal-400 dark:hover:bg-teal-900/20'
            )}
          >
            Show dock
          </button>
        )}
        {completedOps.length > 0 && (
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
      </div>
      <div className="max-h-72 overflow-y-auto">
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
    </div>
  );
};
