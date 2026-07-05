import React, { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react';
import { StreamMessage } from '../types';
import { streamOperation, type OperationStream } from '../api/operationStream';
import StorageManager from '../../../shared/utils/storage';
import { getApiV1RunningOperations } from '../../../api/generated/operation-logs/operation-logs';
import type { OperationLogInfo } from '../../../api/generated/models';

type RunningOperation = OperationLogInfo;

export interface NewOperationInput {
  operation_id: string;
  server_id: number;
  stack_name: string;
  command: string;
  is_incomplete: boolean;
}

interface OperationState {
  operation: RunningOperation;
  logs: StreamMessage[];
  stream: OperationStream | null;
}

export type OperationsDockState = 'expanded' | 'collapsed' | 'hidden';

interface OperationsContextType {
  operations: RunningOperation[];
  getOperationLogs: (operationId: string) => StreamMessage[];
  addOperation: (operation: NewOperationInput) => void;
  removeOperation: (operationId: string) => void;
  clearCompleted: () => void;
  updateOperation: (operationId: string, updates: Partial<RunningOperation>) => void;
  refresh: () => void;
  dockState: OperationsDockState;
  setDockState: (state: OperationsDockState) => void;
}

const OperationsContext = createContext<OperationsContextType | undefined>(undefined);

const MAX_COMPLETED_OPERATIONS = 50;

const loadPersistedOperations = (): Map<string, OperationState> => {
  try {
    const parsed = StorageManager.operations.get();
    if (!parsed) return new Map();

    const map = new Map<string, OperationState>();

    if (Array.isArray(parsed)) {
      parsed.forEach(
        (item: { operationId: string; operation: RunningOperation; logs: StreamMessage[] }) => {
          map.set(item.operationId, {
            operation: item.operation,
            logs: item.logs,
            stream: null,
          });
        }
      );
    }

    return map;
  } catch (err) {
    console.error('Failed to load persisted operations:', err);
    return new Map();
  }
};

const persistOperations = (states: Map<string, OperationState>) => {
  try {
    const completedOps = Array.from(states.entries())
      .filter(([_, state]) => !state.operation.is_incomplete)
      .slice(0, MAX_COMPLETED_OPERATIONS)
      .map(([operationId, state]) => ({
        operationId,
        operation: state.operation,
        logs: state.logs,
      }));

    StorageManager.operations.set(completedOps);
  } catch (err) {
    console.error('Failed to persist operations:', err);
  }
};

export const OperationsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [operationStates, setOperationStates] = useState<Map<string, OperationState>>(() =>
    loadPersistedOperations()
  );
  const operationStatesRef = useRef<Map<string, OperationState>>(new Map());

  useEffect(() => {
    operationStatesRef.current = operationStates;
  }, [operationStates]);

  useEffect(() => {
    persistOperations(operationStates);
  }, [operationStates]);

  const openOperationStream = useCallback((operation: RunningOperation): OperationStream => {
    return streamOperation(operation.server_id, operation.stack_name, operation.operation_id, {
      onMessage: (message) => {
        setOperationStates((prev) => {
          const state = prev.get(operation.operation_id);
          if (!state) return prev;

          const newMap = new Map(prev);

          if (message.type === 'complete') {
            state.operation.is_incomplete = false;
            state.stream?.close();
            state.stream = null;
          }

          newMap.set(operation.operation_id, {
            ...state,
            logs: [...state.logs, message],
          });

          return newMap;
        });
      },
      onError: (error) => {
        console.error(`Operation stream error for ${operation.operation_id}:`, error);
      },
    });
  }, []);

  const fetchRunningOperations = useCallback(async () => {
    try {
      const response = await getApiV1RunningOperations();
      const operations = response.data?.operations ?? [];

      setOperationStates((prev) => {
        const newMap = new Map(prev);

        const serverOperationIds = new Set(
          operations.map((op: OperationLogInfo) => op.operation_id)
        );

        for (const [opId, state] of newMap.entries()) {
          if (!serverOperationIds.has(opId) && state.operation.is_incomplete) {
            state.operation.is_incomplete = false;
            state.stream?.close();
            state.stream = null;
          }
        }

        operations.forEach((serverOp: OperationLogInfo) => {
          const existing = newMap.get(serverOp.operation_id);

          if (existing) {
            existing.operation = {
              ...existing.operation,
              ...serverOp,
              is_incomplete: serverOp.is_incomplete,
            };
          } else if (serverOp.is_incomplete) {
            const state: OperationState = {
              operation: serverOp,
              logs: [],
              stream: null,
            };
            state.stream = openOperationStream(serverOp);
            newMap.set(serverOp.operation_id, state);
          }
        });

        return newMap;
      });
    } catch (err) {
      console.error('Failed to fetch running operations:', err);
    }
  }, [openOperationStream]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchRunningOperations();

    const interval = setInterval(fetchRunningOperations, 5000);

    return () => {
      clearInterval(interval);

      operationStatesRef.current.forEach((state) => {
        state.stream?.close();
      });
    };
  }, [fetchRunningOperations]);

  const addOperation = useCallback(
    (input: NewOperationInput) => {
      setOperationStates((prev) => {
        if (prev.has(input.operation_id)) {
          return prev;
        }

        const now = new Date().toISOString();
        const operation: RunningOperation = {
          id: 0,
          user_id: 0,
          server_id: input.server_id,
          stack_name: input.stack_name,
          operation_id: input.operation_id,
          command: input.command,
          start_time: now,
          end_time: '',
          last_message_at: now,
          user_name: '',
          server_name: '',
          is_incomplete: input.is_incomplete,
          duration_ms: 0,
          partial_duration_ms: 0,
          message_count: 0,
          summary: '',
          exit_code: 0,
          success: false,
          options: '',
          services: '',
          trigger_source: 'manual',
          status: 'running',
          formatted_date: '',
          created_at: now,
          updated_at: now,
          deleted_at: { Time: '', Valid: false },
          server: {} as RunningOperation['server'],
          user: {} as RunningOperation['user'],
        };

        const state: OperationState = {
          operation,
          logs: [],
          stream: null,
        };
        if (operation.is_incomplete) {
          state.stream = openOperationStream(operation);
        }

        const newMap = new Map(prev);
        newMap.set(operation.operation_id, state);
        return newMap;
      });
    },
    [openOperationStream]
  );

  const removeOperation = useCallback((operationId: string) => {
    setOperationStates((prev) => {
      const newMap = new Map(prev);
      const state = newMap.get(operationId);

      if (state) {
        state.stream?.close();
        newMap.delete(operationId);
      }

      return newMap;
    });
  }, []);

  const clearCompleted = useCallback(() => {
    setOperationStates((prev) => {
      const newMap = new Map(prev);
      for (const [operationId, state] of newMap.entries()) {
        if (!state.operation.is_incomplete) {
          state.stream?.close();
          newMap.delete(operationId);
        }
      }
      return newMap;
    });
  }, []);

  const [dockState, setDockState] = useState<OperationsDockState>('collapsed');

  const updateOperation = useCallback((operationId: string, updates: Partial<RunningOperation>) => {
    setOperationStates((prev) => {
      const state = prev.get(operationId);
      if (!state) return prev;

      const newMap = new Map(prev);
      newMap.set(operationId, {
        ...state,
        operation: {
          ...state.operation,
          ...updates,
        },
      });

      return newMap;
    });
  }, []);

  const getOperationLogs = useCallback(
    (operationId: string): StreamMessage[] => {
      return operationStates.get(operationId)?.logs || [];
    },
    [operationStates]
  );

  const operations = Array.from(operationStates.values())
    .map((state) => state.operation)
    .sort((a, b) => new Date(b.start_time ?? 0).getTime() - new Date(a.start_time ?? 0).getTime());

  return (
    <OperationsContext.Provider
      value={{
        operations,
        getOperationLogs,
        addOperation,
        removeOperation,
        clearCompleted,
        updateOperation,
        refresh: fetchRunningOperations,
        dockState,
        setDockState,
      }}
    >
      {children}
    </OperationsContext.Provider>
  );
};

export const useOperationsContext = () => {
  const context = useContext(OperationsContext);
  if (!context) {
    throw new Error('useOperationsContext must be used within OperationsProvider');
  }
  return context;
};
