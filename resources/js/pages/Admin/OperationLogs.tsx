import React, { useState, useEffect, useCallback } from 'react';
import { Head } from '@inertiajs/react';
import { PanelLayout } from '../../components/common/PanelLayout';
import {
  OperationLogsSidebar,
  OperationLogsToolbar,
  OperationLogsStatusBar,
  OperationLogsContent,
} from '../../components/operation-logs';
import {
  OperationLog,
  OperationLogDetail,
  OperationLogStatsSummary,
  PaginationInfo,
} from '../../types/operations';

interface Props {
  title: string;
}

export default function OperationLogs({ title }: Props) {
  const [logs, setLogs] = useState<OperationLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [pagination, setPagination] = useState<PaginationInfo | null>(null);
  const [stats, setStats] = useState<OperationLogStatsSummary | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const [currentPage, setCurrentPage] = useState(1);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedStatus, setSelectedStatus] = useState('');
  const [selectedCommand, setSelectedCommand] = useState('');
  const [isRefreshing, setIsRefreshing] = useState(false);

  const fetchLogs = useCallback(
    async (page = 1) => {
      setLoading(true);
      try {
        const params = new URLSearchParams({
          page: page.toString(),
          page_size: '25',
          ...(searchTerm && { search: searchTerm }),
          ...(selectedStatus && { status: selectedStatus }),
          ...(selectedCommand && { command: selectedCommand }),
        });

        const response = await fetch(`/admin/api/operation-logs?${params}`);
        const data = await response.json();

        setLogs(data.data || []);
        setPagination(data.pagination);
        setLastUpdated(new Date());
      } catch (error) {
        console.error('Failed to fetch operation logs:', error);
      } finally {
        setLoading(false);
      }
    },
    [searchTerm, selectedStatus, selectedCommand]
  );

  const fetchStats = useCallback(async () => {
    try {
      const response = await fetch('/admin/api/operation-logs/stats');
      const data = await response.json();
      setStats(data);
    } catch (error) {
      console.error('Failed to fetch operation logs stats:', error);
    }
  }, []);

  const fetchLogDetail = useCallback(async (logId: number): Promise<OperationLogDetail | null> => {
    try {
      const response = await fetch(`/admin/api/operation-logs/${logId}`);
      const data = await response.json();
      return data;
    } catch (error) {
      console.error('Failed to fetch operation log details:', error);
      return null;
    }
  }, []);

  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    await Promise.all([fetchLogs(currentPage), fetchStats()]);
    setIsRefreshing(false);
  }, [fetchLogs, fetchStats, currentPage]);

  useEffect(() => {
    fetchLogs(currentPage);
  }, [currentPage, fetchLogs]);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

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
            loading={loading}
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
