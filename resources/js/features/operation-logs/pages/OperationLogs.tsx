import { useCallback, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useDocumentTitle } from '../../../shared/hooks/useDocumentTitle';
import { OperationLogsView } from '../components';
import {
  useGetApiV1OperationLogs,
  useGetApiV1OperationLogsStats,
  getApiV1OperationLogsId,
  getGetApiV1OperationLogsQueryKey,
  getGetApiV1OperationLogsStatsQueryKey,
} from '../../../api/generated/operation-logs/operation-logs';
import type {
  GetApiV1OperationLogsParams,
  GetApiV1OperationLogsStatus,
} from '../../../api/generated/models';

export default function OperationLogs() {
  useDocumentTitle('My Operation Logs');
  const queryClient = useQueryClient();
  const [currentPage, setCurrentPage] = useState(1);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedStatus, setSelectedStatus] = useState('');
  const [selectedCommand, setSelectedCommand] = useState('');
  const [daysBack, setDaysBack] = useState<number | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const logsParams: GetApiV1OperationLogsParams = {
    page: currentPage,
    page_size: 25,
    ...(searchTerm && { search: searchTerm }),
    ...(selectedStatus && { status: selectedStatus as GetApiV1OperationLogsStatus }),
    ...(selectedCommand && { command: selectedCommand }),
    ...(daysBack !== null && { days_back: daysBack }),
  };

  const { data: logsResponse, isLoading: logsLoading } = useGetApiV1OperationLogs(logsParams);
  const { data: statsResponse, isLoading: statsLoading } = useGetApiV1OperationLogsStats();

  const fetchLogDetail = useCallback(async (logId: number) => {
    try {
      const response = await getApiV1OperationLogsId(logId);
      return response.data ?? null;
    } catch {
      return null;
    }
  }, []);

  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: getGetApiV1OperationLogsQueryKey(logsParams) }),
      queryClient.invalidateQueries({ queryKey: getGetApiV1OperationLogsStatsQueryKey() }),
    ]);
    setLastUpdated(new Date());
    setIsRefreshing(false);
  }, [queryClient, logsParams]);

  const resetToFirstPage = () => setCurrentPage(1);

  return (
    <OperationLogsView
      title="Operation Logs"
      subtitle="View your Docker stack operation history"
      showUser={false}
      logs={logsResponse?.data ?? []}
      stats={statsResponse?.data ?? null}
      meta={logsResponse?.meta ?? null}
      isLoading={logsLoading || statsLoading}
      page={currentPage}
      onPageChange={setCurrentPage}
      searchTerm={searchTerm}
      onSearchChange={(value) => {
        setSearchTerm(value);
        resetToFirstPage();
      }}
      selectedStatus={selectedStatus}
      onStatusChange={(status) => {
        setSelectedStatus(status);
        resetToFirstPage();
      }}
      selectedCommand={selectedCommand}
      onCommandChange={(command) => {
        setSelectedCommand(command);
        resetToFirstPage();
      }}
      daysBack={daysBack}
      onDaysBackChange={(value) => {
        setDaysBack(value);
        resetToFirstPage();
      }}
      onClearFilters={() => {
        setSearchTerm('');
        setSelectedStatus('');
        setSelectedCommand('');
        setDaysBack(null);
        resetToFirstPage();
      }}
      isRefreshing={isRefreshing}
      onRefresh={handleRefresh}
      lastUpdated={lastUpdated}
      onFetchDetail={fetchLogDetail}
    />
  );
}
