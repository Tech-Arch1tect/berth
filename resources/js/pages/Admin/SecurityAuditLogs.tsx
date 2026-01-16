import { useState, useEffect, useCallback } from 'react';
import { Head } from '@inertiajs/react';
import { PanelLayout } from '../../components/common/PanelLayout';
import {
  SecurityAuditLogsSidebar,
  SecurityAuditLogsToolbar,
  SecurityAuditLogsStatusBar,
  SecurityAuditLogsContent,
} from '../../components/security-audit-logs';
import type { SecurityAuditLog, SecurityAuditStats } from '../../hooks/useSecurityAuditLogs';

interface Props {
  title: string;
}

interface PaginationMetadata {
  total: number;
  totalPages: number;
  currentPage: number;
}

export default function SecurityAuditLogs({ title }: Props) {
  const [logs, setLogs] = useState<SecurityAuditLog[]>([]);
  const [stats, setStats] = useState<SecurityAuditStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [pagination, setPagination] = useState<PaginationMetadata | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const [currentPage, setCurrentPage] = useState(1);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [selectedSeverity, setSelectedSeverity] = useState('all');
  const [selectedSuccess, setSelectedSuccess] = useState('all');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [isRefreshing, setIsRefreshing] = useState(false);

  const pageSize = 50;

  const fetchLogs = useCallback(
    async (page = 1) => {
      setLoading(true);
      try {
        const params = new URLSearchParams({
          page: page.toString(),
          per_page: pageSize.toString(),
        });

        if (searchTerm) params.append('search', searchTerm);
        if (selectedCategory && selectedCategory !== 'all') {
          params.append('event_category', selectedCategory);
        }
        if (selectedSeverity && selectedSeverity !== 'all') {
          params.append('severity', selectedSeverity);
        }
        if (selectedSuccess && selectedSuccess !== 'all') {
          params.append('success', selectedSuccess);
        }
        if (startDate) {
          params.append('start_date', new Date(startDate).toISOString());
        }
        if (endDate) {
          params.append('end_date', new Date(endDate).toISOString());
        }

        const response = await fetch(`/admin/api/security-audit-logs?${params}`);
        const data = await response.json();

        setLogs(data.logs || []);
        setPagination({
          total: data.total || 0,
          totalPages: data.total_pages || 1,
          currentPage: data.page || 1,
        });
        setLastUpdated(new Date());
      } catch (error) {
        console.error('Failed to fetch security logs:', error);
      } finally {
        setLoading(false);
      }
    },
    [searchTerm, selectedCategory, selectedSeverity, selectedSuccess, startDate, endDate, pageSize]
  );

  const fetchStats = useCallback(async () => {
    try {
      const response = await fetch('/admin/api/security-audit-logs/stats');
      const data = await response.json();
      setStats(data);
    } catch (error) {
      console.error('Failed to fetch stats:', error);
    }
  }, []);

  const fetchLogDetail = useCallback(async (logId: number): Promise<SecurityAuditLog | null> => {
    try {
      const response = await fetch(`/admin/api/security-audit-logs/${logId}`);
      const data = await response.json();
      return data;
    } catch (error) {
      console.error('Failed to fetch log detail:', error);
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

  const handleCategoryChange = useCallback((category: string) => {
    setSelectedCategory(category);
    setCurrentPage(1);
  }, []);

  const handleSeverityChange = useCallback((severity: string) => {
    setSelectedSeverity(severity);
    setCurrentPage(1);
  }, []);

  const handleSuccessChange = useCallback((success: string) => {
    setSelectedSuccess(success);
    setCurrentPage(1);
  }, []);

  const handleStartDateChange = useCallback((date: string) => {
    setStartDate(date);
    setCurrentPage(1);
  }, []);

  const handleEndDateChange = useCallback((date: string) => {
    setEndDate(date);
    setCurrentPage(1);
  }, []);

  const handleClearFilters = useCallback(() => {
    setSearchTerm('');
    setSelectedCategory('all');
    setSelectedSeverity('all');
    setSelectedSuccess('all');
    setStartDate('');
    setEndDate('');
    setCurrentPage(1);
  }, []);

  const hasActiveFilters =
    searchTerm !== '' ||
    selectedCategory !== 'all' ||
    selectedSeverity !== 'all' ||
    selectedSuccess !== 'all' ||
    startDate !== '' ||
    endDate !== '';

  const activeFilterCount = [
    searchTerm,
    selectedCategory !== 'all' ? selectedCategory : '',
    selectedSeverity !== 'all' ? selectedSeverity : '',
    selectedSuccess !== 'all' ? selectedSuccess : '',
    startDate,
    endDate,
  ].filter(Boolean).length;

  return (
    <>
      <Head title={title} />
      <PanelLayout
        storageKey="security-audit-logs"
        sidebarTitle="Filters"
        defaultWidth={260}
        maxWidthPercent={35}
        toolbar={
          <SecurityAuditLogsToolbar
            searchTerm={searchTerm}
            onSearchChange={setSearchTerm}
            onRefresh={handleRefresh}
            isRefreshing={isRefreshing}
          />
        }
        sidebar={
          <SecurityAuditLogsSidebar
            stats={stats}
            selectedCategory={selectedCategory}
            selectedSeverity={selectedSeverity}
            selectedSuccess={selectedSuccess}
            startDate={startDate}
            endDate={endDate}
            onCategoryChange={handleCategoryChange}
            onSeverityChange={handleSeverityChange}
            onSuccessChange={handleSuccessChange}
            onStartDateChange={handleStartDateChange}
            onEndDateChange={handleEndDateChange}
            onClearFilters={handleClearFilters}
            hasActiveFilters={hasActiveFilters}
          />
        }
        content={
          <SecurityAuditLogsContent
            logs={logs}
            loading={loading}
            pagination={
              pagination
                ? {
                    total: pagination.total,
                    totalPages: pagination.totalPages,
                    currentPage: pagination.currentPage,
                    pageSize,
                  }
                : null
            }
            currentPage={currentPage}
            onPageChange={handlePageChange}
            onFetchDetail={fetchLogDetail}
          />
        }
        statusBar={
          <SecurityAuditLogsStatusBar
            pagination={
              pagination
                ? {
                    total: pagination.total,
                    totalPages: pagination.totalPages,
                    currentPage: pagination.currentPage,
                    pageSize,
                  }
                : null
            }
            hasActiveFilters={hasActiveFilters}
            activeFilterCount={activeFilterCount}
            lastUpdated={lastUpdated}
          />
        }
      />
    </>
  );
}
