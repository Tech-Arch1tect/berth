import { theme } from '../../theme';
import { cn } from '../../utils/cn';
import { OperationLog, PaginationInfo } from '../../types/operations';
import { ReactElement } from 'react';

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
  const columnCount = showUser ? 8 : 7;

  return (
    <>
      <div className={theme.table.outer}>
        <div className={theme.table.scroll}>
          <div className={theme.table.inner}>
            <div className={theme.table.panel}>
              <table className={theme.table.element}>
                <thead className={theme.table.head}>
                  <tr>
                    <th className={theme.table.headCell}>Operation</th>
                    <th className={theme.table.headCell}>Stack</th>
                    <th className={theme.table.headCell}>Trigger</th>
                    {showUser ? (
                      <th className={theme.table.headCell}>User/Server</th>
                    ) : (
                      <th className={theme.table.headCell}>Server</th>
                    )}
                    <th className={theme.table.headCell}>Status</th>
                    <th className={theme.table.headCell}>Duration</th>
                    <th className={theme.table.headCell}>Started</th>
                    <th className={theme.table.headCell}>
                      <span className="sr-only">Actions</span>
                    </th>
                  </tr>
                </thead>
                <tbody className={theme.table.body}>
                  {loading ? (
                    <tr>
                      <td colSpan={columnCount} className={theme.table.empty}>
                        Loading...
                      </td>
                    </tr>
                  ) : logs.length === 0 ? (
                    <tr>
                      <td colSpan={columnCount} className={theme.table.empty}>
                        No operation logs found.
                      </td>
                    </tr>
                  ) : (
                    logs.map((log) => (
                      <tr key={log.id} className={theme.table.row}>
                        <td className={theme.table.cell}>
                          <div className={theme.table.cellStrong}>{log.command}</div>
                          <div className={cn('font-mono', theme.text.subtle)}>
                            {log.operation_id.slice(-8)}
                          </div>
                        </td>
                        <td className={theme.table.cell}>
                          <div className={theme.table.cellStrong}>{log.stack_name}</div>
                        </td>
                        <td className={theme.table.cell}>
                          <span className={cn(theme.badges.tag.base, theme.badges.tag.neutral)}>
                            👤 Manual
                          </span>
                        </td>
                        {showUser ? (
                          <td className={theme.table.cell}>
                            <div className={theme.table.cellStrong}>{log.user_name}</div>
                            <div className={theme.text.subtle}>{log.server_name}</div>
                          </td>
                        ) : (
                          <td className={theme.table.cell}>
                            <div className={theme.table.cellStrong}>{log.server_name}</div>
                          </td>
                        )}
                        <td className={theme.table.cell}>
                          {getStatusBadge(log)}
                          {log.exit_code !== null && (
                            <div className={cn('mt-1 text-xs', theme.text.subtle)}>
                              Exit: {log.exit_code}
                            </div>
                          )}
                        </td>
                        <td className={cn(theme.table.cell, theme.text.subtle)}>
                          {getOperationDuration(log)}
                        </td>
                        <td className={cn(theme.table.cell, theme.text.subtle)}>
                          {log.formatted_date}
                        </td>
                        <td className={cn(theme.table.cell, 'text-right text-sm font-medium')}>
                          <button
                            onClick={() => onViewDetails(log.id)}
                            className={cn(
                              'transition-colors',
                              theme.text.info,
                              'hover:text-blue-700 dark:hover:text-blue-300'
                            )}
                          >
                            View Details
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
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
