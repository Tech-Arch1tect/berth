import React, { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react';
import { RunningOperation } from '../types/running-operation';
import { StreamMessage } from '../types/operations';
import StorageManager from '../utils/storage';

interface OperationState {
  operation: RunningOperation;
  logs: StreamMessage[];
  ws: WebSocket | null;
}

interface OperationsContextType {
  operations: RunningOperation[];
  getOperationLogs: (operationId: string) => StreamMessage[];
  addOperation: (operation: RunningOperation) => void;
  addOperationLog: (operationId: string, message: StreamMessage) => void;
  removeOperation: (operationId: string) => void;
  updateOperation: (operationId: string, updates: Partial<RunningOperation>) => void;
  refresh: () => void;
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
            ws: null,
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

  const cleanupWebSocket = useCallback((ws: WebSocket | null) => {
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.close();
    }
  }, []);

  const createWebSocketForOperation = useCallback(
    (operation: RunningOperation) => {
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsUrl = `${protocol}//${window.location.host}/ws/ui/servers/${operation.server_id}/stacks/${encodeURIComponent(operation.stack_name)}/operations/${operation.operation_id}`;

      const ws = new WebSocket(wsUrl);

      ws.onopen = () => {
        console.log(`WebSocket connected for operation ${operation.operation_id}`);
      };

      ws.onmessage = (event) => {
        try {
          const message: StreamMessage = JSON.parse(event.data);

          setOperationStates((prev) => {
            const newMap = new Map(prev);
            const state = newMap.get(operation.operation_id);

            if (state) {
              const updatedLogs = [...state.logs, message];

              if (message.type === 'complete') {
                state.operation.is_incomplete = false;
                cleanupWebSocket(state.ws);
                state.ws = null;
              }

              newMap.set(operation.operation_id, {
                ...state,
                logs: updatedLogs,
              });
            }

            return newMap;
          });
        } catch (err) {
          console.error('Failed to parse WebSocket message:', err);
        }
      };

      ws.onerror = (error) => {
        console.error(`WebSocket error for operation ${operation.operation_id}:`, error);
      };

      ws.onclose = () => {
        console.log(`WebSocket closed for operation ${operation.operation_id}`);
      };

      return ws;
    },
    [cleanupWebSocket]
  );

  const fetchRunningOperations = useCallback(async () => {
    try {
      const response = await fetch('/api/v1/running-operations');
      if (!response.ok) {
        return;
      }
      const data = await response.json();

      if (Array.isArray(data)) {
        setOperationStates((prev) => {
          const newMap = new Map(prev);

          const serverOperationIds = new Set(data.map((op: RunningOperation) => op.operation_id));

          for (const [opId, state] of newMap.entries()) {
            if (!serverOperationIds.has(opId) && state.operation.is_incomplete) {
              state.operation.is_incomplete = false;
              cleanupWebSocket(state.ws);
              state.ws = null;
            }
          }

          data.forEach((serverOp: RunningOperation) => {
            const existing = newMap.get(serverOp.operation_id);

            if (existing) {
              existing.operation = {
                ...existing.operation,
                ...serverOp,
                is_incomplete: serverOp.is_incomplete,
              };
            } else if (serverOp.is_incomplete) {
              const ws = createWebSocketForOperation(serverOp);
              newMap.set(serverOp.operation_id, {
                operation: serverOp,
                logs: [],
                ws,
              });
            }
          });

          return newMap;
        });
      }
    } catch (err) {
      console.error('Failed to fetch running operations:', err);
    }
  }, [createWebSocketForOperation, cleanupWebSocket]);

  useEffect(() => {
    fetchRunningOperations();

    const interval = setInterval(fetchRunningOperations, 5000);

    return () => {
      clearInterval(interval);

      operationStatesRef.current.forEach((state) => {
        cleanupWebSocket(state.ws);
      });
    };
  }, [fetchRunningOperations, cleanupWebSocket]);

  const addOperation = useCallback(
    (operation: RunningOperation) => {
      setOperationStates((prev) => {
        if (prev.has(operation.operation_id)) {
          return prev;
        }

        const newMap = new Map(prev);
        const ws = operation.is_incomplete ? createWebSocketForOperation(operation) : null;

        newMap.set(operation.operation_id, {
          operation,
          logs: [],
          ws,
        });

        return newMap;
      });
    },
    [createWebSocketForOperation]
  );

  const removeOperation = useCallback(
    (operationId: string) => {
      setOperationStates((prev) => {
        const newMap = new Map(prev);
        const state = newMap.get(operationId);

        if (state) {
          cleanupWebSocket(state.ws);
          newMap.delete(operationId);
        }

        return newMap;
      });
    },
    [cleanupWebSocket]
  );

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

  const addOperationLog = useCallback((operationId: string, message: StreamMessage) => {
    setOperationStates((prev) => {
      const state = prev.get(operationId);
      if (!state) return prev;

      const newMap = new Map(prev);
      const updatedLogs = [...state.logs, message];

      if (message.type === 'complete') {
        state.operation.is_incomplete = false;
      }

      newMap.set(operationId, {
        ...state,
        logs: updatedLogs,
      });

      return newMap;
    });
  }, []);

  const getOperationLogs = useCallback((operationId: string): StreamMessage[] => {
    return operationStatesRef.current.get(operationId)?.logs || [];
  }, []);

  const operations = Array.from(operationStates.values())
    .map((state) => state.operation)
    .sort((a, b) => new Date(b.start_time).getTime() - new Date(a.start_time).getTime());

  return (
    <OperationsContext.Provider
      value={{
        operations,
        getOperationLogs,
        addOperation,
        addOperationLog,
        removeOperation,
        updateOperation,
        refresh: fetchRunningOperations,
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
