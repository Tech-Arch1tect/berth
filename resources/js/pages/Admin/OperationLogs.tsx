import { useState, useCallback } from 'react';
import { Head } from '@inertiajs/react';
import { useQueryClient } from '@tanstack/react-query';
import { PanelLayout } from '../../components/common/PanelLayout';
import {
  OperationLogsSidebar,
  OperationLogsToolbar,
  OperationLogsStatusBar,
  OperationLogsContent,
} from '../../components/operation-logs';
import {
  useGetApiV1AdminOperationLogs,
  useGetApiV1AdminOperationLogsStats,
  getApiV1AdminOperationLogsId,
  getGetApiV1AdminOperationLogsQueryKey,
  getGetApiV1AdminOperationLogsStatsQueryKey,
} from '../../api/generated/admin/admin';
import type { GetApiV1AdminOperationLogsStatus } from '../../api/generated/models';

interface Props {
  title: string;
}

export default function OperationLogs({ title }: Props) {
  const queryClient = useQueryClient();
  const [currentPage, setCurrentPage] = useState(1);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedStatus, setSelectedStatus] = useState('');
  const [selectedCommand, setSelectedCommand] = useState('');
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const logsParams = {
    page: currentPage,
    page_size: 25,
    ...(searchTerm && { search: searchTerm }),
    ...(selectedStatus && { status: selectedStatus as GetApiV1AdminOperationLogsStatus }),
    ...(selectedCommand && { command: selectedCommand }),
  };

  const { data: logsResponse, isLoading: logsLoading } = useGetApiV1AdminOperationLogs(logsParams);
  const { data: statsResponse, isLoading: statsLoading } = useGetApiV1AdminOperationLogsStats();

  const logs = logsResponse?.data?.data?.data ?? [];
  const pagination = logsResponse?.data?.data?.pagination ?? null;
  const stats = statsResponse?.data?.data ?? null;

  const fetchLogDetail = useCallback(async (logId: number) => {
    try {
      const response = await getApiV1AdminOperationLogsId(logId);
      return response.data?.data ?? null;
    } catch (error) {
      console.error('Failed to fetch operation log details:', error);
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

  const handlePageChange = useCallback((page: number) => {
    setCurrentPage(page);
  }, []);

  const handleStatusChange = useCallback((status: string) => {
    setSelectedStatus(status);
    setCurrentPage(1);
  }, []);

  const handleCommandChange = useCallback((command: string) => {
    setSelectedCommand(command);
    setCurrentPage(1);
  }, []);

  const handleClearFilters = useCallback(() => {
    setSearchTerm('');
    setSelectedStatus('');
    setSelectedCommand('');
    setCurrentPage(1);
  }, []);

  const hasActiveFilters = searchTerm !== '' || selectedStatus !== '' || selectedCommand !== '';
  const activeFilterCount = [searchTerm, selectedStatus, selectedCommand].filter(Boolean).length;

  return (
    <>
      <Head title={title} />
      <PanelLayout
        storageKey="operation-logs"
        sidebarTitle="Filters"
        defaultWidth={260}
        maxWidthPercent={35}
        toolbar={
          <OperationLogsToolbar
            searchTerm={searchTerm}
            onSearchChange={setSearchTerm}
            onRefresh={handleRefresh}
            isRefreshing={isRefreshing}
          />
        }
        sidebar={
          <OperationLogsSidebar
            stats={stats}
            selectedStatus={selectedStatus}
            selectedCommand={selectedCommand}
            onStatusChange={handleStatusChange}
            onCommandChange={handleCommandChange}
            onClearFilters={handleClearFilters}
            hasActiveFilters={hasActiveFilters}
          />
        }
        content={
          <OperationLogsContent
            logs={logs}
            loading={logsLoading || statsLoading}
            pagination={pagination}
            currentPage={currentPage}
            showUser={true}
            onPageChange={handlePageChange}
            onFetchDetail={fetchLogDetail}
          />
        }
        statusBar={
          <OperationLogsStatusBar
            pagination={pagination}
            hasActiveFilters={hasActiveFilters}
            activeFilterCount={activeFilterCount}
            lastUpdated={lastUpdated}
          />
        }
      />
    </>
  );
}
