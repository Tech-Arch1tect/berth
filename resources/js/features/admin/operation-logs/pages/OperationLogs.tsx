import { useCallback, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useDocumentTitle } from '../../../../shared/hooks/useDocumentTitle';
import { OperationLogsView } from '../../../operation-logs/components';
import {
  useGetApiV1AdminOperationLogs,
  useGetApiV1AdminOperationLogsStats,
  getApiV1AdminOperationLogsId,
  getGetApiV1AdminOperationLogsQueryKey,
  getGetApiV1AdminOperationLogsStatsQueryKey,
} from '../../../../api/generated/admin/admin';
import type {
  GetApiV1AdminOperationLogsParams,
  GetApiV1AdminOperationLogsStatus,
} from '../../../../api/generated/models';

export default function OperationLogs() {
  useDocumentTitle('Operation Logs');
  const queryClient = useQueryClient();
  const [currentPage, setCurrentPage] = useState(1);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedStatus, setSelectedStatus] = useState('');
  const [selectedCommand, setSelectedCommand] = useState('');
  const [daysBack, setDaysBack] = useState<number | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const logsParams: GetApiV1AdminOperationLogsParams = {
    page: currentPage,
    page_size: 25,
    ...(searchTerm && { search: searchTerm }),
    ...(selectedStatus && { status: selectedStatus as GetApiV1AdminOperationLogsStatus }),
    ...(selectedCommand && { command: selectedCommand }),
    ...(daysBack !== null && { days_back: daysBack }),
  };

  const { data: logsResponse, isLoading: logsLoading } = useGetApiV1AdminOperationLogs(logsParams);
  const { data: statsResponse, isLoading: statsLoading } = useGetApiV1AdminOperationLogsStats();

  const fetchLogDetail = useCallback(async (logId: number) => {
    try {
      const response = await getApiV1AdminOperationLogsId(logId);
      return response.data ?? null;
    } catch {
      return null;
    }
  }, []);

  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    await Promise.all([
      queryClient.invalidateQueries({
        queryKey: getGetApiV1AdminOperationLogsQueryKey(logsParams),
      }),
      queryClient.invalidateQueries({ queryKey: getGetApiV1AdminOperationLogsStatsQueryKey() }),
    ]);
    setLastUpdated(new Date());
    setIsRefreshing(false);
  }, [queryClient, logsParams]);

  const resetToFirstPage = () => setCurrentPage(1);

  return (
    <OperationLogsView
      title="Operation Logs"
      subtitle="View Docker stack operation history across all users"
      showUser={true}
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
