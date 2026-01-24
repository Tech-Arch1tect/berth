import { useState, useCallback } from 'react';
import { Head } from '@inertiajs/react';
import { PanelLayout } from '../../components/common/PanelLayout';
import {
  SecurityAuditLogsSidebar,
  SecurityAuditLogsToolbar,
  SecurityAuditLogsStatusBar,
  SecurityAuditLogsContent,
} from '../../components/security-audit-logs';
import { useSecurityAuditLogs } from '../../hooks/useSecurityAuditLogs';

interface Props {
  title: string;
}

export default function SecurityAuditLogs({ title }: Props) {
  const [currentPage, setCurrentPage] = useState(1);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [selectedSeverity, setSelectedSeverity] = useState('all');
  const [selectedSuccess, setSelectedSuccess] = useState('all');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const pageSize = 50;

  const { logs, stats, loading, paginationMetadata, fetchLogDetails, refetch, refetchStats } =
    useSecurityAuditLogs({
      page: currentPage,
      perPage: pageSize,
      search: searchTerm,
      eventCategory: selectedCategory,
      severity: selectedSeverity,
      success: selectedSuccess,
      startDate,
      endDate,
    });

  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    await Promise.all([refetch(), refetchStats()]);
    setLastUpdated(new Date());
    setIsRefreshing(false);
  }, [refetch, refetchStats]);

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
              paginationMetadata
                ? {
                    total: paginationMetadata.total,
                    totalPages: paginationMetadata.totalPages,
                    currentPage: paginationMetadata.currentPage,
                    pageSize,
                  }
                : null
            }
            currentPage={currentPage}
            onPageChange={handlePageChange}
            onFetchDetail={fetchLogDetails}
          />
        }
        statusBar={
          <SecurityAuditLogsStatusBar
            pagination={
              paginationMetadata
                ? {
                    total: paginationMetadata.total,
                    totalPages: paginationMetadata.totalPages,
                    currentPage: paginationMetadata.currentPage,
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
