import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { RunningOperation } from '../types/running-operation';

interface OperationsContextType {
  operations: RunningOperation[];
  addOperation: (operation: RunningOperation) => void;
  removeOperation: (operationId: string) => void;
  markOperationComplete: (operationId: string) => void;
  hideOperation: (operationId: string) => void;
  showOperation: (operationId: string) => void;
  refresh: () => void;
}

const OperationsContext = createContext<OperationsContextType | undefined>(undefined);

export const OperationsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [operations, setOperations] = useState<RunningOperation[]>([]);
  const [hiddenOperations, setHiddenOperations] = useState<Set<string>>(new Set());

  const fetchRunningOperations = useCallback(async () => {
    try {
      const response = await fetch('/api/running-operations');
      if (!response.ok) {
        return;
      }
      const data = await response.json();
      if (Array.isArray(data)) {
        setOperations(data);
      }
    } catch (err) {
      console.error('Failed to fetch running operations:', err);
    }
  }, []);

  useEffect(() => {
    fetchRunningOperations();

    const interval = setInterval(fetchRunningOperations, 2000);

    return () => clearInterval(interval);
  }, [fetchRunningOperations]);

  const addOperation = useCallback((operation: RunningOperation) => {
    setOperations((prev) => {
      if (prev.some((op) => op.operation_id === operation.operation_id)) {
        return prev;
      }

      return [operation, ...prev];
    });
  }, []);

  const removeOperation = useCallback((operationId: string) => {
    setOperations((prev) => prev.filter((op) => op.operation_id !== operationId));
  }, []);

  const markOperationComplete = useCallback((operationId: string) => {
    setOperations((prev) =>
      prev.map((op) => (op.operation_id === operationId ? { ...op, is_incomplete: false } : op))
    );
  }, []);

  const hideOperation = useCallback((operationId: string) => {
    setHiddenOperations((prev) => new Set(prev).add(operationId));
  }, []);

  const showOperation = useCallback((operationId: string) => {
    setHiddenOperations((prev) => {
      const newSet = new Set(prev);
      newSet.delete(operationId);
      return newSet;
    });
  }, []);

  const visibleOperations = operations.filter((op) => !hiddenOperations.has(op.operation_id));

  return (
    <OperationsContext.Provider
      value={{
        operations: visibleOperations,
        addOperation,
        removeOperation,
        markOperationComplete,
        hideOperation,
        showOperation,
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
