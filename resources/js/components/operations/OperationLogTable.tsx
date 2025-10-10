import { theme } from '../../theme';
import { cn } from '../../utils/cn';
import { OperationLog, PaginationInfo } from '../../types/operations';
import { ReactElement, useMemo } from 'react';
import { Table, Column } from '../common/Table';

interface OperationLogTableProps {
  logs: OperationLog[];
  loading: boolean;
  pagination: PaginationInfo | null;
  currentPage: number;
  showUser?: boolean;
  onViewDetails: (logId: number) => void;
  onPageChange: (page: number) => void;
  getStatusBadge: (log: OperationLog) => ReactElement;
  getOperationDuration: (log: OperationLog) => string;
}

export default function OperationLogTable({
  logs,
  loading,
  pagination,
  currentPage,
  showUser = true,
  onViewDetails,
  onPageChange,
  getStatusBadge,
  getOperationDuration,
}: OperationLogTableProps) {
  const columns: Column<OperationLog>[] = useMemo(
    () => [
      {
        key: 'operation',
        header: 'Operation',
        render: (log) => (
          <>
            <div className={theme.table.cellStrong}>{log.command}</div>
            <div className={cn('font-mono', theme.text.subtle)}>{log.operation_id.slice(-8)}</div>
          </>
        ),
      },
      {
        key: 'stack',
        header: 'Stack',
        render: (log) => <div className={theme.table.cellStrong}>{log.stack_name}</div>,
      },
      {
        key: 'trigger',
        header: 'Trigger',
        render: () => (
          <span className={cn(theme.badges.tag.base, theme.badges.tag.neutral)}>👤 Manual</span>
        ),
      },
      {
        key: 'user_server',
        header: showUser ? 'User/Server' : 'Server',
        render: (log) =>
          showUser ? (
            <>
              <div className={theme.table.cellStrong}>{log.user_name}</div>
              <div className={theme.text.subtle}>{log.server_name}</div>
            </>
          ) : (
            <div className={theme.table.cellStrong}>{log.server_name}</div>
          ),
      },
      {
        key: 'status',
        header: 'Status',
        render: (log) => (
          <>
            {getStatusBadge(log)}
            {log.exit_code !== null && (
              <div className={cn('mt-1 text-xs', theme.text.subtle)}>Exit: {log.exit_code}</div>
            )}
          </>
        ),
      },
      {
        key: 'duration',
        header: 'Duration',
        render: (log) => <span className={theme.text.subtle}>{getOperationDuration(log)}</span>,
      },
      {
        key: 'started',
        header: 'Started',
        render: (log) => <span className={theme.text.subtle}>{log.formatted_date}</span>,
      },
      {
        key: 'actions',
        header: '',
        render: (log) => (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onViewDetails(log.id);
            }}
            className={cn('transition-colors', theme.link.primary)}
          >
            View Details
          </button>
        ),
        className: 'text-right',
      },
    ],
    [showUser, getStatusBadge, getOperationDuration, onViewDetails]
  );

  return (
    <>
      <div className={theme.table.outer}>
        <div className={theme.table.scroll}>
          <div className={theme.table.inner}>
            <div className={theme.table.panel}>
              <Table
                data={logs}
                columns={columns}
                keyExtractor={(log) => log.id.toString()}
                isLoading={loading}
                emptyMessage="No operation logs found."
              />
            </div>
          </div>
        </div>
      </div>

      {pagination && pagination.total_pages > 1 && (
        <div className={theme.pagination.container}>
          <div className={theme.pagination.summary}>
            Showing {(pagination.current_page - 1) * pagination.page_size + 1} to{' '}
            {Math.min(pagination.current_page * pagination.page_size, pagination.total)} of{' '}
            {pagination.total} results
          </div>
          <div className={theme.pagination.group}>
            <button
              onClick={() => onPageChange(currentPage - 1)}
              disabled={!pagination.has_prev}
              className={theme.pagination.button}
            >
              Previous
            </button>
            <span className={theme.pagination.page}>
              Page {pagination.current_page} of {pagination.total_pages}
            </span>
            <button
              onClick={() => onPageChange(currentPage + 1)}
              disabled={!pagination.has_next}
              className={theme.pagination.button}
            >
              Next
            </button>
          </div>
        </div>
      )}
    </>
  );
}
