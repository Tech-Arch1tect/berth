import { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import { OperationRequest, OperationStatus } from '../types';
import { useOperationsContext } from '../contexts/OperationsContext';
import { postApiV1ServersServeridStacksStacknameOperations } from '../../../api/generated/operations/operations';
import { getApiV1OperationLogsByOperationIdOperationId } from '../../../api/generated/operation-logs/operation-logs';

interface UseOperationsOptions {
  serverid: string;
  stackname: string;
  onOperationComplete?: (success: boolean, exitCode?: number, summary?: string) => void;
  onError?: (error: string) => void;
}

export const useOperations = ({
  serverid,
  stackname,
  onOperationComplete,
  onError,
}: UseOperationsOptions) => {
  const [operationStatus, setOperationStatus] = useState<OperationStatus>({ isRunning: false });
  const [error, setError] = useState<string | null>(null);
  const { operations, getOperationLogs, addOperation } = useOperationsContext();

  const onOperationCompleteRef = useRef(onOperationComplete);
  const onErrorRef = useRef(onError);
  const settledRef = useRef<string | null>(null);

  onOperationCompleteRef.current = onOperationComplete;
  onErrorRef.current = onError;

  const activeOperationId = operationStatus.operationId;
  const activeLogs = useMemo(
    () => (activeOperationId ? getOperationLogs(activeOperationId) : []),
    [activeOperationId, getOperationLogs]
  );
  const activeOperation = activeOperationId
    ? operations.find((op) => op.operation_id === activeOperationId)
    : undefined;

  useEffect(() => {
    if (!activeOperationId || !operationStatus.isRunning) return;
    if (settledRef.current === activeOperationId) return;

    const completeFrame = activeLogs.find((log) => log.type === 'complete');
    const errorFrame = activeLogs.find((log) => log.type === 'error');

    if (completeFrame) {
      settledRef.current = activeOperationId;
      setOperationStatus((prev) => ({ ...prev, isRunning: false }));

      const success = completeFrame.success ?? false;
      const exitCode = completeFrame.exitCode ?? undefined;

      if (onOperationCompleteRef.current) {
        const complete = onOperationCompleteRef.current;
        getApiV1OperationLogsByOperationIdOperationId(activeOperationId)
          .then((response) => {
            complete(success, exitCode, response.data?.log?.summary || undefined);
          })
          .catch(() => {
            complete(success, exitCode);
          });
      }
      return;
    }

    if (errorFrame) {
      settledRef.current = activeOperationId;
      setOperationStatus((prev) => ({ ...prev, isRunning: false }));
      onErrorRef.current?.(errorFrame.data || 'Operation failed');
      return;
    }

    if (activeOperation && !activeOperation.is_incomplete) {
      settledRef.current = activeOperationId;
      setOperationStatus((prev) => ({ ...prev, isRunning: false }));
    }
  }, [activeOperationId, activeLogs, activeOperation, operationStatus.isRunning]);

  const startOperation = useCallback(
    async (operation: OperationRequest) => {
      setError(null);

      const response = await postApiV1ServersServeridStacksStacknameOperations(
        parseInt(serverid),
        stackname,
        operation
      );

      const operationId = response.data?.operationId;
      if (!operationId) {
        const message = 'The server did not return an operation ID';
        setError(message);
        onErrorRef.current?.(message);
        throw new Error(message);
      }

      addOperation({
        server_id: parseInt(serverid),
        stack_name: stackname,
        operation_id: operationId,
        command: operation.command,
        is_incomplete: true,
      });

      settledRef.current = null;
      setOperationStatus({
        isRunning: true,
        operationId,
        command: operation.command,
        startTime: new Date(),
      });
    },
    [serverid, stackname, addOperation]
  );

  return {
    operationStatus,
    error,
    startOperation,
  };
};
