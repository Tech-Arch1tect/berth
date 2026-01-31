import { useGetApiV1OperationLogs } from '../../../api/generated/operation-logs/operation-logs';
import type { OperationLogInfo } from '../../../api/generated/models';

export interface ActivitySummary {
  recentOperations: OperationLogInfo[];
  failedOperations: OperationLogInfo[];
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

  const recentOperations = recentResponse?.data?.data?.data ?? [];
  const failedOperations = failedResponse?.data?.data?.data ?? [];
  const loading = recentLoading || failedLoading;
  const error = recentError || failedError ? 'Failed to load activity data' : null;

  return {
    recentOperations,
    failedOperations,
    loading,
    error,
  };
};
