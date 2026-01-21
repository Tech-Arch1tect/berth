import { useGetApiV1OperationLogs } from '../../../api/generated/operation-logs/operation-logs';
import type { GetApiV1OperationLogs200DataItem } from '../../../api/generated/models';

export type RecentActivity = GetApiV1OperationLogs200DataItem;

export interface ActivitySummary {
  recentOperations: RecentActivity[];
  failedOperations: RecentActivity[];
  loading: boolean;
  error: string | null;
}

export const useDashboardActivity = (): ActivitySummary => {
  const {
    data: recentResponse,
    isLoading: recentLoading,
    error: recentError,
  } = useGetApiV1OperationLogs({
    page: 1,
    page_size: 10,
    days_back: 7,
  });

  const {
    data: failedResponse,
    isLoading: failedLoading,
    error: failedError,
  } = useGetApiV1OperationLogs({
    page: 1,
    page_size: 5,
    status: 'failed',
    days_back: 7,
  });

  const recentOperations = recentResponse?.data?.data ?? [];
  const failedOperations = failedResponse?.data?.data ?? [];
  const loading = recentLoading || failedLoading;
  const error = recentError || failedError ? 'Failed to load activity data' : null;

  return {
    recentOperations,
    failedOperations,
    loading,
    error,
  };
};
