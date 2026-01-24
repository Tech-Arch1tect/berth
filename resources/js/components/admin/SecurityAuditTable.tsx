import { cn } from '../../utils/cn';
import { theme } from '../../theme';
import { Table } from '../common/Table';
import type { GetApiV1AdminSecurityAuditLogs200DataLogsItem } from '../../api/generated/models';
import type { UsePaginationReturn } from '../../hooks/usePagination';
import { getSeverityBadgeStyle, getCategoryBadgeStyle } from '../../utils/securityAuditHelpers';

interface Props {
  logs: GetApiV1AdminSecurityAuditLogs200DataLogsItem[];
  loading: boolean;
  pagination: UsePaginationReturn;
  onViewDetails: (id: number) => void;
}

export function SecurityAuditTable({ logs, loading, pagination, onViewDetails }: Props) {
  const { current, canGoPrevious, canGoNext, previousPage, nextPage } = pagination;

  return (
    <div
      className={cn(
        theme.surface.panel,
        'rounded-lg shadow overflow-hidden border border-slate-200 dark:border-slate-700'
      )}
    >
      <Table<GetApiV1AdminSecurityAuditLogs200DataLogsItem>
        data={logs}
        keyExtractor={(log) => log.id.toString()}
        isLoading={loading}
        emptyMessage="No logs found"
        columns={[
          {
            key: 'time',
            header: 'Time',
            render: (log) => (
              <span className={cn('text-sm', theme.text.standard)}>
                {new Date(log.created_at).toLocaleString()}
              </span>
            ),
          },
          {
            key: 'event',
            header: 'Event',
            render: (log) => (
              <span className={cn('text-sm', theme.text.standard)}>{log.event_type}</span>
            ),
          },
          {
            key: 'category',
            header: 'Category',
            render: (log) => (
              <span
                className={cn(
                  'px-2 py-1 text-xs font-medium rounded',
                  getCategoryBadgeStyle(log.event_category)
                )}
              >
                {log.event_category}
              </span>
            ),
          },
          {
            key: 'severity',
            header: 'Severity',
            render: (log) => (
              <span
                className={cn(
                  'px-2 py-1 text-xs font-medium rounded',
                  getSeverityBadgeStyle(log.severity)
                )}
              >
                {log.severity}
              </span>
            ),
          },
          {
            key: 'actor',
            header: 'Actor',
            render: (log) => (
              <span className={cn('text-sm', theme.text.standard)}>
                {log.actor_username || '-'}
              </span>
            ),
          },
          {
            key: 'target',
            header: 'Target',
            render: (log) => (
              <span className={cn('text-sm', theme.text.standard)}>{log.target_name || '-'}</span>
            ),
          },
          {
            key: 'status',
            header: 'Status',
            render: (log) =>
              log.success ? (
                <span className={cn(theme.badges.tag.base, theme.badges.tag.success)}>Success</span>
              ) : (
                <span className={cn(theme.badges.tag.base, theme.badges.tag.danger)}>Failed</span>
              ),
          },
          {
            key: 'ip',
            header: 'IP',
            render: (log) => (
              <span className={cn('text-sm', theme.text.subtle)}>{log.actor_ip}</span>
            ),
          },
          {
            key: 'actions',
            header: 'Actions',
            render: (log) => (
              <button
                onClick={() => onViewDetails(log.id)}
                className={cn('hover:underline', theme.text.info)}
              >
                Details
              </button>
            ),
          },
        ]}
      />

      {current.totalPages > 1 && (
        <div className="px-6 py-4 bg-slate-50 dark:bg-slate-900 border-t border-slate-200 dark:border-slate-700 flex items-center justify-between">
          <div className={cn('text-sm', theme.text.standard)}>
            Showing {(current.currentPage - 1) * current.pageSize + 1} to{' '}
            {Math.min(current.currentPage * current.pageSize, current.totalItems)} of{' '}
            {current.totalItems} results
          </div>
          <div className="flex gap-2">
            <button
              onClick={previousPage}
              disabled={!canGoPrevious}
              className={cn(
                'px-3 py-1 text-sm rounded disabled:opacity-50 disabled:cursor-not-allowed',
                theme.buttons.secondary
              )}
            >
              Previous
            </button>
            <span className={cn('px-3 py-1 text-sm', theme.text.standard)}>
              Page {current.currentPage} of {current.totalPages}
            </span>
            <button
              onClick={nextPage}
              disabled={!canGoNext}
              className={cn(
                'px-3 py-1 text-sm rounded disabled:opacity-50 disabled:cursor-not-allowed',
                theme.buttons.secondary
              )}
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
