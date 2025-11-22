import React, { useState, useEffect } from 'react';
import { Head } from '@inertiajs/react';
import FlashMessages from '../../components/FlashMessages';
import OperationLogStats from '../../components/operations/OperationLogStats';
import OperationLogFilters from '../../components/operations/OperationLogFilters';
import OperationLogTable from '../../components/operations/OperationLogTable';
import OperationLogModal from '../../components/operations/OperationLogModal';
import { cn } from '../../utils/cn';
import { theme } from '../../theme';

interface OperationLog {
  id: number;
  user_id: number;
  server_id: number;
  stack_name: string;
  operation_id: string;
  command: string;
  options: string;
  services: string;
  start_time: string;
  end_time: string | null;
  success: boolean | null;
  exit_code: number | null;
  duration_ms: number | null;
  created_at: string;
  updated_at: string;
  user_name: string;
  server_name: string;
  trigger_source: string;
  is_incomplete: boolean;
  formatted_date: string;
  message_count: number;
  partial_duration_ms: number | null;
}

interface OperationLogMessage {
  id: number;
  operation_log_id: number;
  message_type: string;
  message_data: string;
  timestamp: string;
  sequence_number: number;
  created_at: string;
  updated_at: string;
}

interface OperationLogStats {
  total_operations: number;
  incomplete_operations: number;
  failed_operations: number;
  successful_operations: number;
  recent_operations: number;
}

interface PaginationInfo {
  current_page: number;
  page_size: number;
  total: number;
  total_pages: number;
  has_next: boolean;
  has_prev: boolean;
}

interface Props {
  title: string;
}

interface OperationLogDetail {
  log: OperationLog;
  messages: OperationLogMessage[];
}

export default function OperationLogs({ title }: Props) {
  const [logs, setLogs] = useState<OperationLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [pagination, setPagination] = useState<PaginationInfo | null>(null);
  const [stats, setStats] = useState<OperationLogStats | null>(null);
  const [selectedLog, setSelectedLog] = useState<OperationLogDetail | null>(null);
  const [showDetails, setShowDetails] = useState(false);

  const [currentPage, setCurrentPage] = useState(1);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedStatus, setSelectedStatus] = useState('');
  const [selectedCommand, setSelectedCommand] = useState('');

  const fetchLogs = async (page = 1) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        page_size: '20',
        ...(searchTerm && { search: searchTerm }),
        ...(selectedStatus && { status: selectedStatus }),
        ...(selectedCommand && { command: selectedCommand }),
      });

      const response = await fetch(`/admin/api/operation-logs?${params}`);
      const data = await response.json();

      setLogs(data.data || []);
      setPagination(data.pagination);
    } catch (error) {
      console.error('Failed to fetch operation logs:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchStats = async () => {
    try {
      const response = await fetch('/admin/api/operation-logs/stats');
      const data = await response.json();
      setStats(data);
    } catch (error) {
      console.error('Failed to fetch operation logs stats:', error);
    }
  };

  const fetchLogDetails = async (logId: number) => {
    try {
      const response = await fetch(`/admin/api/operation-logs/${logId}`);
      const data = await response.json();
      setSelectedLog(data);
      setShowDetails(true);
    } catch (error) {
      console.error('Failed to fetch operation log details:', error);
    }
  };

  useEffect(() => {
    fetchLogs(currentPage);
  }, [currentPage, searchTerm, selectedStatus, selectedCommand]);

  useEffect(() => {
    fetchStats();
  }, []);

  const formatDuration = (duration: number | null, isPartial: boolean = false) => {
    if (duration === null || duration === undefined || duration === 0) return 'N/A';

    if (duration < -1000000000) return 'N/A';

    if (duration < 0) return 'N/A';

    let formattedTime = '';
    if (duration < 1000) formattedTime = `${duration}ms`;
    else if (duration < 60000) formattedTime = `${(duration / 1000).toFixed(1)}s`;
    else formattedTime = `${(duration / 60000).toFixed(1)}m`;

    return isPartial ? `~${formattedTime}` : formattedTime;
  };

  const getOperationDuration = (log: OperationLog) => {
    if (log.duration_ms !== null) {
      return formatDuration(log.duration_ms, false);
    } else if (log.partial_duration_ms !== null) {
      return formatDuration(log.partial_duration_ms, true);
    } else {
      return 'N/A';
    }
  };

  const getStatusBadge = (log: OperationLog) => {
    if (log.is_incomplete) {
      return (
        <span
          className={cn(
            'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium',
            'bg-yellow-100 dark:bg-yellow-900 text-yellow-800 dark:text-yellow-200'
          )}
        >
          ⚠️ Incomplete
        </span>
      );
    }
    if (log.success === true) {
      return (
        <span
          className={cn(
            'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium',
            'bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200'
          )}
        >
          ✅ Success
        </span>
      );
    }
    if (log.success === false) {
      return (
        <span
          className={cn(
            'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium',
            'bg-red-100 dark:bg-red-900 text-red-800 dark:text-red-200'
          )}
        >
          ❌ Failed
        </span>
      );
    }
    return (
      <span
        className={cn(
          'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium',
          'bg-slate-100 dark:bg-slate-700 text-slate-800 dark:text-slate-200'
        )}
      >
        Unknown
      </span>
    );
  };

  const uniqueCommands = Array.from(new Set(logs.map((log) => log.command))).sort();

  return (
    <>
      <Head title={title} />

      <div className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        <div className="md:flex md:items-center md:justify-between">
          <div className="flex-1 min-w-0">
            <h2
              className={cn(
                'text-2xl font-bold leading-7 sm:text-3xl sm:truncate',
                theme.text.strong
              )}
            >
              {title}
            </h2>
          </div>
        </div>

        <FlashMessages />

        {stats && <OperationLogStats stats={stats} />}

        <OperationLogFilters
          searchTerm={searchTerm}
          selectedStatus={selectedStatus}
          selectedCommand={selectedCommand}
          uniqueCommands={uniqueCommands}
          onSearchTermChange={setSearchTerm}
          onSelectedStatusChange={setSelectedStatus}
          onSelectedCommandChange={setSelectedCommand}
          onClearFilters={() => {
            setSearchTerm('');
            setSelectedStatus('');
            setSelectedCommand('');
            setCurrentPage(1);
          }}
        />

        <OperationLogTable
          logs={logs}
          loading={loading}
          pagination={pagination}
          currentPage={currentPage}
          showUser={true}
          onViewDetails={fetchLogDetails}
          onPageChange={setCurrentPage}
          getStatusBadge={getStatusBadge}
          getOperationDuration={getOperationDuration}
        />

        <OperationLogModal
          selectedLog={selectedLog}
          showDetails={showDetails}
          showUser={true}
          onClose={() => setShowDetails(false)}
          getStatusBadge={getStatusBadge}
          getOperationDuration={getOperationDuration}
        />
      </div>
    </>
  );
}
