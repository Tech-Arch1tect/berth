import React, { useState, useEffect } from 'react';
import { Head } from '@inertiajs/react';
import FlashMessages from '../../components/FlashMessages';
import { cn } from '../../utils/cn';
import { theme } from '../../theme';
import { useAuditLogFilters } from '../../hooks/useAuditLogFilters';
import { usePagination } from '../../hooks/usePagination';
import { useSecurityAuditLogs } from '../../hooks/useSecurityAuditLogs';
import { SecurityAuditStats } from '../../components/admin/SecurityAuditStats';
import { SecurityAuditFilters } from '../../components/admin/SecurityAuditFilters';
import { SecurityAuditTable } from '../../components/admin/SecurityAuditTable';
import { SecurityAuditLogDetailsModal } from '../../components/admin/SecurityAuditLogDetailsModal';

interface Props {
  title: string;
}

export default function SecurityAuditLogs({ title }: Props) {
  const [showDetails, setShowDetails] = useState(false);
  const filters = useAuditLogFilters();
  const pagination = usePagination(50);
  const { setTotalItems } = pagination;

  const {
    logs,
    stats,
    selectedLog,
    loading,
    paginationMetadata,
    fetchLogDetails,
    clearSelectedLog,
  } = useSecurityAuditLogs({
    filters: filters.values,
    pagination: pagination.current,
  });

  useEffect(() => {
    if (paginationMetadata) {
      setTotalItems(paginationMetadata.total);
    }
  }, [paginationMetadata, setTotalItems]);

  const handleViewDetails = async (id: number) => {
    await fetchLogDetails(id);
    setShowDetails(true);
  };

  const handleCloseDetails = () => {
    setShowDetails(false);
    clearSelectedLog();
  };

  return (
    <>
      <Head title={title} />
      <FlashMessages />

      <div className="container mx-auto px-4 py-6">
        <div className="mb-6">
          <h1 className={cn('text-3xl font-bold', theme.text.strong)}>Security Audit Logs</h1>
          <p className={cn('mt-2', theme.text.muted)}>
            Monitor and review security-relevant events
          </p>
        </div>

        <SecurityAuditStats stats={stats} />
        <SecurityAuditFilters {...filters} />
        <SecurityAuditTable
          logs={logs}
          loading={loading}
          pagination={pagination}
          onViewDetails={handleViewDetails}
        />
      </div>

      <SecurityAuditLogDetailsModal
        log={selectedLog}
        isOpen={showDetails}
        onClose={handleCloseDetails}
      />
    </>
  );
}
