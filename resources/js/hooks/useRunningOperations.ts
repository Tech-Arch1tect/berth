import { useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import {
  useGetApiV1RunningOperations,
  getGetApiV1RunningOperationsQueryKey,
} from '../api/generated/operation-logs/operation-logs';
import type {
  GetApiV1RunningOperations200,
  GetApiV1RunningOperations200OperationsItem,
} from '../api/generated/models';

export type RunningOperation = GetApiV1RunningOperations200OperationsItem;

export const useRunningOperations = () => {
  const queryClient = useQueryClient();

  const {
    data: response,
    isLoading: loading,
    error: queryError,
    refetch,
  } = useGetApiV1RunningOperations({
    query: {
      refetchInterval: 10000,
    },
  });

  const operations = response?.data?.operations ?? [];
  const error = queryError ? 'Failed to fetch running operations' : null;

  const removeOperation = useCallback(
    (operationId: string) => {
      const queryKey = getGetApiV1RunningOperationsQueryKey();

      queryClient.setQueryData<{ data: GetApiV1RunningOperations200 }>(queryKey, (oldData) => {
        if (!oldData?.data?.operations) return oldData;

        return {
          ...oldData,
          data: {
            ...oldData.data,
            operations: oldData.data.operations.filter((op) => op.operation_id !== operationId),
          },
        };
      });
    },
    [queryClient]
  );

  return {
    operations,
    loading,
    error,
    refresh: refetch,
    removeOperation,
  };
};
