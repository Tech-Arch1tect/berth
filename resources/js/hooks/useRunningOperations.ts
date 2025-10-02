import { useState, useEffect, useCallback } from 'react';
import { RunningOperation } from '../types/running-operation';

export const useRunningOperations = () => {
  const [operations, setOperations] = useState<RunningOperation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchRunningOperations = useCallback(async () => {
    try {
      const response = await fetch('/api/running-operations');
      if (!response.ok) {
        throw new Error('Failed to fetch running operations');
      }
      const data = await response.json();
      console.log('Running operations:', data);

      setOperations(Array.isArray(data) ? data : []);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
      console.error('Failed to fetch running operations:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchRunningOperations();

    const interval = setInterval(fetchRunningOperations, 10000);

    return () => clearInterval(interval);
  }, [fetchRunningOperations]);

  const removeOperation = useCallback((operationId: string) => {
    setOperations((prev) => prev.filter((op) => op.operation_id !== operationId));
  }, []);

  return {
    operations,
    loading,
    error,
    refresh: fetchRunningOperations,
    removeOperation,
  };
};
