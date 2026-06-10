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

interface ActiveOperation {
  operationId: string;
  command: OperationRequest['command'];
  startTime: Date;
}

export const useOperations = ({
  serverid,
  stackname,
  onOperationComplete,
  onError,
}: UseOperationsOptions) => {
  const [active, setActive] = useState<ActiveOperation | null>(null);
  const [error, setError] = useState<string | null>(null);
  const { operations, getOperationLogs, addOperation } = useOperationsContext();

  const onOperationCompleteRef = useRef(onOperationComplete);
  const onErrorRef = useRef(onError);
  const settledRef = useRef<string | null>(null);

  useEffect(() => {
    onOperationCompleteRef.current = onOperationComplete;
    onErrorRef.current = onError;
  });

  const activeLogs = useMemo(
    () => (active ? getOperationLogs(active.operationId) : []),
    [active, getOperationLogs]
  );
  const completeFrame = activeLogs.find((log) => log.type === 'complete');
  const errorFrame = activeLogs.find((log) => log.type === 'error');
  const serverSettled = active
    ? operations.some((op) => op.operation_id === active.operationId && !op.is_incomplete)
    : false;

  const isRunning = !!active && !completeFrame && !errorFrame && !serverSettled;

  const operationStatus: OperationStatus = useMemo(
    () => ({
      isRunning,
      operationId: active?.operationId,
      command: active?.command,
      startTime: active?.startTime,
    }),
    [isRunning, active]
  );

  useEffect(() => {
    if (!active || settledRef.current === active.operationId) return;

    if (completeFrame) {
      settledRef.current = active.operationId;

      const success = completeFrame.success ?? false;
      const exitCode = completeFrame.exitCode ?? undefined;

      if (onOperationCompleteRef.current) {
        const complete = onOperationCompleteRef.current;
        getApiV1OperationLogsByOperationIdOperationId(active.operationId)
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
      settledRef.current = active.operationId;
      onErrorRef.current?.(errorFrame.data || 'Operation failed');
    }
  }, [active, completeFrame, errorFrame]);

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
      setActive({
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
