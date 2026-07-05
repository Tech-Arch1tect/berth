import React from 'react';
import { useOperationsContext } from '../contexts/OperationsContext';
import { OperationBuilder } from './OperationBuilder';
import { OperationTracker } from './OperationTracker';
import { useOperations } from '../hooks/useOperations';
import { Modal } from '../../../shared/components/Modal';
import { cn } from '../../../shared/utils/cn';
import { theme } from '../../../shared/theme';

export interface AdvancedOperationsConfig {
  serverid: string;
  stackname: string;
  services?: Array<{ name: string; service_name?: string }>;
  onClose: () => void;
}

export const AdvancedOperationsModal: React.FC<{ config: AdvancedOperationsConfig }> = ({
  config,
}) => {
  const { operations, removeOperation } = useOperationsContext();
  const runningOps = operations.filter((op) => op.is_incomplete);
  const completedOps = operations.filter((op) => !op.is_incomplete);

  const advancedOps = useOperations({
    serverid: config.serverid,
    stackname: config.stackname,
    onOperationComplete: () => {},
    onError: (error) => {
      console.error('Advanced operation error:', error);
    },
  });

  return (
    <Modal
      isOpen={true}
      onClose={config.onClose}
      title="Advanced Operations"
      subtitle={`${config.stackname} on Server ${config.serverid}`}
      size="2xl"
      headerExtra={
        advancedOps.operationStatus.isRunning ? (
          <div className="flex items-center gap-2">
            <div className={cn('w-2 h-2 rounded-full animate-pulse', theme.badges.dot.info)} />
            <span className={cn('text-xs', theme.text.muted)}>Operation running</span>
          </div>
        ) : undefined
      }
    >
      <div
        className="-mx-6 -my-4 flex flex-col lg:flex-row overflow-hidden bg-white dark:bg-zinc-900"
        style={{ height: '75vh' }}
      >
        <div className="min-h-0 flex-1 lg:flex-none lg:w-1/2 border-b lg:border-b-0 lg:border-r border-zinc-200 dark:border-zinc-700 overflow-y-auto p-4 bg-white dark:bg-zinc-900">
          <h4 className={cn('text-sm font-semibold mb-3', theme.text.strong)}>
            Build Custom Operation
          </h4>
          <OperationBuilder
            services={config.services || []}
            onOperationBuild={(operation) => {
              advancedOps.startOperation(operation);
            }}
            disabled={advancedOps.operationStatus.isRunning}
          />
        </div>

        <div className="min-h-0 flex-1 lg:flex-none lg:w-1/2 flex flex-col overflow-hidden bg-white dark:bg-zinc-900">
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
                  stackname={op.stack_name}
                  operationId={op.operation_id}
                  command={op.command}
                  startTime={op.start_time ?? ''}
                  isIncomplete={op.is_incomplete}
                  summary={op.summary ?? null}
                  onDismiss={() => removeOperation(op.operation_id)}
                />
              ))
            )}
          </div>
        </div>
      </div>
    </Modal>
  );
};
