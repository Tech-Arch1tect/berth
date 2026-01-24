import { useCallback, useState } from 'react';
import {
  useGetApiV1AdminSecurityAuditLogs,
  useGetApiV1AdminSecurityAuditLogsStats,
  getApiV1AdminSecurityAuditLogsId,
} from '../api/generated/admin/admin';
import type {
  GetApiV1AdminSecurityAuditLogs200DataLogsItem,
  GetApiV1AdminSecurityAuditLogsStats200Data,
} from '../api/generated/models';

interface UseSecurityAuditLogsParams {
  page: number;
  perPage: number;
  search?: string;
  eventCategory?: string;
  severity?: string;
  success?: string;
  startDate?: string;
  endDate?: string;
}

interface PaginationMetadata {
  total: number;
  totalPages: number;
  currentPage: number;
}

interface UseSecurityAuditLogsReturn {
  logs: GetApiV1AdminSecurityAuditLogs200DataLogsItem[];
  stats: GetApiV1AdminSecurityAuditLogsStats200Data | null;
  selectedLog: GetApiV1AdminSecurityAuditLogs200DataLogsItem | null;
  loading: boolean;
  statsLoading: boolean;
  paginationMetadata: PaginationMetadata | null;
  fetchLogDetails: (id: number) => Promise<GetApiV1AdminSecurityAuditLogs200DataLogsItem | null>;
  clearSelectedLog: () => void;
  refetch: () => void;
  refetchStats: () => void;
}

export function useSecurityAuditLogs({
  page,
  perPage,
  search,
  eventCategory,
  severity,
  success,
  startDate,
  endDate,
}: UseSecurityAuditLogsParams): UseSecurityAuditLogsReturn {
  const [selectedLog, setSelectedLog] =
    useState<GetApiV1AdminSecurityAuditLogs200DataLogsItem | null>(null);

  const {
    data: logsResponse,
    isLoading: loading,
    refetch,
  } = useGetApiV1AdminSecurityAuditLogs(
    {
      page,
      per_page: perPage,
      search: search || undefined,
      event_category: eventCategory && eventCategory !== 'all' ? eventCategory : undefined,
      severity: severity && severity !== 'all' ? severity : undefined,
      success: success && success !== 'all' ? success : undefined,
      start_date: startDate ? new Date(startDate).toISOString() : undefined,
      end_date: endDate ? new Date(endDate).toISOString() : undefined,
    },
    {
      query: {
        staleTime: 30 * 1000,
      },
    }
  );

  const {
    data: statsResponse,
    isLoading: statsLoading,
    refetch: refetchStats,
  } = useGetApiV1AdminSecurityAuditLogsStats({
    query: {
      staleTime: 60 * 1000,
    },
  });

  const logs = logsResponse?.data?.data?.logs ?? [];
  const stats = statsResponse?.data?.data ?? null;

  const paginationMetadata: PaginationMetadata | null = logsResponse?.data?.data
    ? {
        total: logsResponse.data.data.total,
        totalPages: logsResponse.data.data.total_pages,
        currentPage: logsResponse.data.data.page,
      }
    : null;

  const fetchLogDetails = useCallback(
    async (id: number): Promise<GetApiV1AdminSecurityAuditLogs200DataLogsItem | null> => {
      try {
        const response = await getApiV1AdminSecurityAuditLogsId(id);
        const logData = response.data?.data;
        if (logData) {
          setSelectedLog(logData as GetApiV1AdminSecurityAuditLogs200DataLogsItem);
          return logData as GetApiV1AdminSecurityAuditLogs200DataLogsItem;
        }
        return null;
      } catch (error) {
        console.error('Failed to fetch log details:', error);
        return null;
      }
    },
    []
  );

  const clearSelectedLog = useCallback(() => {
    setSelectedLog(null);
  }, []);

  return {
    logs,
    stats,
    selectedLog,
    loading,
    statsLoading,
    paginationMetadata,
    fetchLogDetails,
    clearSelectedLog,
    refetch,
    refetchStats,
  };
}
