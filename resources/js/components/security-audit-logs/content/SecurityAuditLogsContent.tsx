import { useState, useCallback, useEffect, useRef } from 'react';
import { CheckCircleIcon, XCircleIcon } from '@heroicons/react/24/outline';
import { cn } from '../../../utils/cn';
import { theme } from '../../../theme';
import type { SecurityAuditLogResponse } from '../../../api/generated/models';
import { SecurityAuditDetailPanel } from '../panels/SecurityAuditDetailPanel';
import { getSeverityBadgeStyle, getCategoryBadgeStyle } from '../../../utils/securityAuditHelpers';

const DETAIL_PANEL_MIN_WIDTH = 320;
const DETAIL_PANEL_MAX_WIDTH_PERCENT = 50;
const DETAIL_PANEL_DEFAULT_WIDTH = 400;
const DETAIL_PANEL_STORAGE_KEY = 'berth-security-audit-logs-detail-width';

interface PaginationInfo {
  total: number;
  totalPages: number;
  currentPage: number;
  pageSize: number;
}

interface SecurityAuditLogsContentProps {
  logs: SecurityAuditLogResponse[];
  loading: boolean;
  pagination: PaginationInfo | null;
  currentPage: number;
  onPageChange: (page: number) => void;
  onFetchDetail: (logId: number) => Promise<SecurityAuditLogResponse | null>;
}

const StatusBadge: React.FC<{ success: boolean }> = ({ success }) => {
  if (success) {
    return (
      <span
        className={cn(
          'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium',
          'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300'
        )}
      >
        <CheckCircleIcon className="h-3 w-3" />
        Success
      </span>
    );
  }
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium',
        'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300'
      )}
    >
      <XCircleIcon className="h-3 w-3" />
      Failed
    </span>
  );
};

const AuditLogRow: React.FC<{
  log: SecurityAuditLogResponse;
  isSelected: boolean;
  onClick: () => void;
}> = ({ log, isSelected, onClick }) => (
  <tr
    onClick={onClick}
    className={cn(
      'cursor-pointer transition-colors',
      isSelected ? 'bg-teal-50 dark:bg-teal-900/20' : 'hover:bg-zinc-50 dark:hover:bg-zinc-800/50'
    )}
  >
    <td className="px-4 py-3">
      <span className={cn('text-sm', theme.text.standard)}>
        {new Date(log.created_at).toLocaleString()}
      </span>
    </td>
    <td className="px-4 py-3">
      <div className={cn('font-medium', theme.text.strong)}>{log.event_type}</div>
    </td>
    <td className="px-4 py-3">
      <span
        className={cn(
          'px-2 py-1 text-xs font-medium rounded',
          getCategoryBadgeStyle(log.event_category)
        )}
      >
        {log.event_category}
      </span>
    </td>
    <td className="px-4 py-3">
      <span
        className={cn('px-2 py-1 text-xs font-medium rounded', getSeverityBadgeStyle(log.severity))}
      >
        {log.severity}
      </span>
    </td>
    <td className="px-4 py-3">
      <span className={theme.text.standard}>{log.actor_username || '-'}</span>
    </td>
    <td className="px-4 py-3">
      <span className={theme.text.standard}>{log.target_name || '-'}</span>
    </td>
    <td className="px-4 py-3">
      <StatusBadge success={log.success} />
    </td>
    <td className="px-4 py-3">
      <span className={cn('text-sm font-mono', theme.text.muted)}>{log.actor_ip}</span>
    </td>
  </tr>
);

export const SecurityAuditLogsContent: React.FC<SecurityAuditLogsContentProps> = ({
  logs,
  loading,
  pagination,
  currentPage,
  onPageChange,
  onFetchDetail,
}) => {
  const [selectedLogId, setSelectedLogId] = useState<number | null>(null);
  const [detail, setDetail] = useState<SecurityAuditLogResponse | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailPanelWidth, setDetailPanelWidth] = useState(() => {
    const stored = localStorage.getItem(DETAIL_PANEL_STORAGE_KEY);
    return stored ? parseInt(stored, 10) : DETAIL_PANEL_DEFAULT_WIDTH;
  });
  const [containerWidth, setContainerWidth] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [startX, setStartX] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const updateContainerWidth = () => {
      if (containerRef.current) {
        setContainerWidth(containerRef.current.offsetWidth);
      }
    };
    updateContainerWidth();
    window.addEventListener('resize', updateContainerWidth);
    return () => window.removeEventListener('resize', updateContainerWidth);
  }, []);

  useEffect(() => {
    localStorage.setItem(DETAIL_PANEL_STORAGE_KEY, String(detailPanelWidth));
  }, [detailPanelWidth]);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsDragging(true);
    setStartX(e.clientX);
  }, []);

  const handleMouseMove = useCallback(
    (e: MouseEvent) => {
      if (!isDragging) return;
      const delta = startX - e.clientX;
      setDetailPanelWidth((prev) => {
        const maxWidth = containerWidth * (DETAIL_PANEL_MAX_WIDTH_PERCENT / 100);
        const newWidth = prev + delta;
        return Math.min(Math.max(newWidth, DETAIL_PANEL_MIN_WIDTH), maxWidth);
      });
      setStartX(e.clientX);
    },
    [isDragging, startX, containerWidth]
  );

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  useEffect(() => {
    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      document.body.style.userSelect = 'none';
      document.body.style.cursor = 'col-resize';
    }
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      document.body.style.userSelect = '';
      document.body.style.cursor = '';
    };
  }, [isDragging, handleMouseMove, handleMouseUp]);

  const handleSelectLog = useCallback(
    async (logId: number) => {
      if (selectedLogId === logId) {
        setSelectedLogId(null);
        setDetail(null);
        return;
      }

      setSelectedLogId(logId);
      setDetailLoading(true);
      try {
        const fetchedDetail = await onFetchDetail(logId);
        setDetail(fetchedDetail);
      } catch (error) {
        console.error('Failed to fetch detail:', error);
        setDetail(null);
      } finally {
        setDetailLoading(false);
      }
    },
    [selectedLogId, onFetchDetail]
  );

  const handleCloseDetail = useCallback(() => {
    setSelectedLogId(null);
    setDetail(null);
  }, []);

  const showDetailPanel = selectedLogId !== null;

  return (
    <div ref={containerRef} className="flex-1 flex overflow-hidden">
      {/* Table Panel */}
      <div className="flex-1 flex flex-col overflow-hidden min-w-0">
        <div className="flex-1 overflow-auto">
          {loading ? (
            <div className="flex items-center justify-center h-full">
              <div className="animate-pulse flex flex-col items-center gap-2">
                <div className="h-8 w-8 rounded-full bg-zinc-200 dark:bg-zinc-700" />
                <div className="h-4 w-32 rounded bg-zinc-200 dark:bg-zinc-700" />
              </div>
            </div>
          ) : logs.length === 0 ? (
            <div className="flex items-center justify-center h-full">
              <p className={theme.text.muted}>No security audit logs found.</p>
            </div>
          ) : (
            <table className="w-full">
              <thead className="sticky top-0 bg-zinc-50 dark:bg-zinc-800 border-b border-zinc-200 dark:border-zinc-700">
                <tr>
                  <th
                    className={cn(
                      'px-4 py-2 text-left text-xs font-semibold uppercase tracking-wider',
                      theme.text.muted
                    )}
                  >
                    Time
                  </th>
                  <th
                    className={cn(
                      'px-4 py-2 text-left text-xs font-semibold uppercase tracking-wider',
                      theme.text.muted
                    )}
                  >
                    Event
                  </th>
                  <th
                    className={cn(
                      'px-4 py-2 text-left text-xs font-semibold uppercase tracking-wider',
                      theme.text.muted
                    )}
                  >
                    Category
                  </th>
                  <th
                    className={cn(
                      'px-4 py-2 text-left text-xs font-semibold uppercase tracking-wider',
                      theme.text.muted
                    )}
                  >
                    Severity
                  </th>
                  <th
                    className={cn(
                      'px-4 py-2 text-left text-xs font-semibold uppercase tracking-wider',
                      theme.text.muted
                    )}
                  >
                    Actor
                  </th>
                  <th
                    className={cn(
                      'px-4 py-2 text-left text-xs font-semibold uppercase tracking-wider',
                      theme.text.muted
                    )}
                  >
                    Target
                  </th>
                  <th
                    className={cn(
                      'px-4 py-2 text-left text-xs font-semibold uppercase tracking-wider',
                      theme.text.muted
                    )}
                  >
                    Status
                  </th>
                  <th
                    className={cn(
                      'px-4 py-2 text-left text-xs font-semibold uppercase tracking-wider',
                      theme.text.muted
                    )}
                  >
                    IP
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-200 dark:divide-zinc-700">
                {logs.map((log) => (
                  <AuditLogRow
                    key={log.id}
                    log={log}
                    isSelected={selectedLogId === log.id}
                    onClick={() => handleSelectLog(log.id)}
                  />
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Pagination */}
        {pagination && pagination.totalPages > 1 && (
          <div
            className={cn(
              'flex-shrink-0 flex items-center justify-between px-4 py-2',
              'border-t border-zinc-200 dark:border-zinc-700',
              'bg-zinc-50 dark:bg-zinc-800/50'
            )}
          >
            <button
              onClick={() => onPageChange(currentPage - 1)}
              disabled={currentPage <= 1}
              className={cn(
                'px-3 py-1.5 rounded text-sm font-medium transition-colors',
                'border border-zinc-300 dark:border-zinc-600',
                'hover:bg-zinc-100 dark:hover:bg-zinc-700',
                'disabled:opacity-50 disabled:cursor-not-allowed',
                theme.text.standard
              )}
            >
              Previous
            </button>
            <span className={cn('text-sm', theme.text.muted)}>
              Page {pagination.currentPage} of {pagination.totalPages}
            </span>
            <button
              onClick={() => onPageChange(currentPage + 1)}
              disabled={currentPage >= pagination.totalPages}
              className={cn(
                'px-3 py-1.5 rounded text-sm font-medium transition-colors',
                'border border-zinc-300 dark:border-zinc-600',
                'hover:bg-zinc-100 dark:hover:bg-zinc-700',
                'disabled:opacity-50 disabled:cursor-not-allowed',
                theme.text.standard
              )}
            >
              Next
            </button>
          </div>
        )}
      </div>

      {/* Resizable Divider */}
      {showDetailPanel && (
        <div
          className={cn(
            'flex-shrink-0 w-1 cursor-col-resize relative group',
            'bg-zinc-200 dark:bg-zinc-700',
            'hover:bg-teal-400 dark:hover:bg-teal-600',
            'transition-colors duration-150',
            isDragging && 'bg-teal-500 dark:bg-teal-500'
          )}
          onMouseDown={handleMouseDown}
        >
          <div className="absolute inset-y-0 -left-1 -right-1" />
        </div>
      )}

      {/* Detail Panel */}
      {showDetailPanel && (
        <div className="flex-shrink-0 overflow-hidden" style={{ width: `${detailPanelWidth}px` }}>
          <SecurityAuditDetailPanel
            log={detail}
            isLoading={detailLoading}
            onClose={handleCloseDetail}
          />
        </div>
      )}
    </div>
  );
};
