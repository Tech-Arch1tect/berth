import { useCallback, useState } from 'react';
import { useDocumentTitle } from '../../../../shared/hooks/useDocumentTitle';
import { SecurityAuditLogsView } from '../components';
import { useSecurityAuditLogs } from '../hooks/useSecurityAuditLogs';

export default function SecurityAuditLogs() {
  useDocumentTitle('Security Audit Logs');
  const [currentPage, setCurrentPage] = useState(1);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [selectedSeverity, setSelectedSeverity] = useState('all');
  const [selectedSuccess, setSelectedSuccess] = useState('all');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const { logs, stats, loading, meta, fetchLogDetails, refetch, refetchStats } =
    useSecurityAuditLogs({
      page: currentPage,
      perPage: 50,
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

  const resetToFirstPage = () => setCurrentPage(1);

  return (
    <SecurityAuditLogsView
      logs={logs}
      stats={stats}
      meta={meta}
      isLoading={loading}
      page={currentPage}
      onPageChange={setCurrentPage}
      searchTerm={searchTerm}
      onSearchChange={(value) => {
        setSearchTerm(value);
        resetToFirstPage();
      }}
      selectedSuccess={selectedSuccess}
      onSuccessChange={(success) => {
        setSelectedSuccess(success);
        resetToFirstPage();
      }}
      selectedSeverity={selectedSeverity}
      onSeverityChange={(severity) => {
        setSelectedSeverity(severity);
        resetToFirstPage();
      }}
      selectedCategory={selectedCategory}
      onCategoryChange={(category) => {
        setSelectedCategory(category);
        resetToFirstPage();
      }}
      startDate={startDate}
      onStartDateChange={(date) => {
        setStartDate(date);
        resetToFirstPage();
      }}
      endDate={endDate}
      onEndDateChange={(date) => {
        setEndDate(date);
        resetToFirstPage();
      }}
      onClearFilters={() => {
        setSearchTerm('');
        setSelectedCategory('all');
        setSelectedSeverity('all');
        setSelectedSuccess('all');
        setStartDate('');
        setEndDate('');
        resetToFirstPage();
      }}
      isRefreshing={isRefreshing}
      onRefresh={handleRefresh}
      lastUpdated={lastUpdated}
      onFetchDetail={fetchLogDetails}
    />
  );
}
