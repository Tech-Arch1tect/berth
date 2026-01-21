import React, { useState, useCallback, useEffect } from 'react';
import {
  CheckCircleIcon,
  XCircleIcon,
  ExclamationTriangleIcon,
  UserIcon,
  CpuChipIcon,
  ClockIcon,
} from '@heroicons/react/24/outline';
import { cn } from '../../../utils/cn';
import { theme } from '../../../theme';
import type {
  GetApiV1AdminOperationLogs200DataItem,
  GetApiV1AdminOperationLogs200Pagination,
  GetApiV1AdminOperationLogsId200,
} from '../../../api/generated/models';
import { OperationDetailPanel } from '../panels/OperationDetailPanel';

const DETAIL_PANEL_MIN_WIDTH = 320;
const DETAIL_PANEL_MAX_WIDTH_PERCENT = 50;
const DETAIL_PANEL_DEFAULT_WIDTH = 400;
const DETAIL_PANEL_STORAGE_KEY = 'berth-operation-logs-detail-width';

interface OperationLogsContentProps {
  logs: GetApiV1AdminOperationLogs200DataItem[];
  loading: boolean;
  pagination: GetApiV1AdminOperationLogs200Pagination | null;
  currentPage: number;
  showUser?: boolean;
  onPageChange: (page: number) => void;
  onFetchDetail: (logId: number) => Promise<GetApiV1AdminOperationLogsId200 | null>;
}

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

const getOperationDuration = (log: GetApiV1AdminOperationLogs200DataItem) => {
  if (log.duration_ms !== null && log.duration_ms !== undefined) {
    return formatDuration(log.duration_ms, false);
  } else if (log.partial_duration_ms !== null && log.partial_duration_ms !== undefined) {
    return formatDuration(log.partial_duration_ms, true);
  } else {
    return 'N/A';
  }
};

const TriggerBadge: React.FC<{ triggerSource: string }> = ({ triggerSource }) => {
  const isScheduled = triggerSource === 'scheduled' || triggerSource === 'cron';
  const isApi = triggerSource === 'api';

  if (isScheduled) {
    return (
      <span
        className={cn(
          'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium',
          'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300'
        )}
      >
        <ClockIcon className="h-3 w-3" />
        Scheduled
      </span>
    );
  }

  if (isApi) {
    return (
      <span
        className={cn(
          'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium',
          'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300'
        )}
      >
        <CpuChipIcon className="h-3 w-3" />
        API
      </span>
    );
  }

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium',
        'bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400'
      )}
    >
      <UserIcon className="h-3 w-3" />
      Manual
    </span>
  );
};

const StatusBadge: React.FC<{ log: GetApiV1AdminOperationLogs200DataItem }> = ({ log }) => {
  if (log.is_incomplete) {
    return (
      <span
        className={cn(
          'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium',
          'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300'
        )}
      >
        <ExclamationTriangleIcon className="h-3 w-3" />
        Incomplete
      </span>
    );
  }
  if (log.success === true) {
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
  if (log.success === false) {
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
  }
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium',
        'bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400'
      )}
    >
      Unknown
    </span>
  );
};

const OperationRow: React.FC<{
  log: GetApiV1AdminOperationLogs200DataItem;
  isSelected: boolean;
  showUser: boolean;
  onClick: () => void;
}> = ({ log, isSelected, showUser, onClick }) => (
  <tr
    onClick={onClick}
    className={cn(
      'cursor-pointer transition-colors',
      isSelected ? 'bg-teal-50 dark:bg-teal-900/20' : 'hover:bg-zinc-50 dark:hover:bg-zinc-800/50'
    )}
  >
    <td className="px-4 py-3">
      <div className={cn('font-medium', theme.text.strong)}>{log.command}</div>
      <div className={cn('text-xs font-mono', theme.text.muted)}>{log.operation_id.slice(-8)}</div>
    </td>
    <td className="px-4 py-3">
      <div className={theme.text.standard}>{log.stack_name}</div>
    </td>
    <td className="px-4 py-3">
      <TriggerBadge triggerSource={log.trigger_source} />
    </td>
    {showUser && (
      <td className="px-4 py-3">
        <div className={theme.text.standard}>{log.user_name}</div>
      </td>
    )}
    <td className="px-4 py-3">
      <div className={theme.text.standard}>{log.server_name}</div>
    </td>
    <td className="px-4 py-3">
      <StatusBadge log={log} />
    </td>
    <td className="px-4 py-3">
      <span className={cn('text-sm', theme.text.muted)}>{getOperationDuration(log)}</span>
    </td>
    <td className="px-4 py-3 max-w-xs">
      {log.summary ? (
        <span className={cn('text-sm italic truncate block', theme.text.muted)} title={log.summary}>
          {log.summary}
        </span>
      ) : (
        <span className={cn('text-sm', theme.text.subtle)}>-</span>
      )}
    </td>
    <td className="px-4 py-3">
      <span className={cn('text-sm', theme.text.muted)}>{log.formatted_date}</span>
    </td>
  </tr>
);

export const OperationLogsContent: React.FC<OperationLogsContentProps> = ({
  logs,
  loading,
  pagination,
  currentPage,
  showUser = false,
  onPageChange,
  onFetchDetail,
}) => {
  const [selectedLogId, setSelectedLogId] = useState<number | null>(null);
  const [detail, setDetail] = useState<GetApiV1AdminOperationLogsId200 | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailPanelWidth, setDetailPanelWidth] = useState(() => {
    const stored = localStorage.getItem(DETAIL_PANEL_STORAGE_KEY);
    return stored ? parseInt(stored, 10) : DETAIL_PANEL_DEFAULT_WIDTH;
  });
  const [containerWidth, setContainerWidth] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [startX, setStartX] = useState(0);
  const containerRef = React.useRef<HTMLDivElement>(null);

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
              <p className={theme.text.muted}>No operation logs found.</p>
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
                    Operation
                  </th>
                  <th
                    className={cn(
                      'px-4 py-2 text-left text-xs font-semibold uppercase tracking-wider',
                      theme.text.muted
                    )}
                  >
                    Stack
                  </th>
                  <th
                    className={cn(
                      'px-4 py-2 text-left text-xs font-semibold uppercase tracking-wider',
                      theme.text.muted
                    )}
                  >
                    Trigger
                  </th>
                  {showUser && (
                    <th
                      className={cn(
                        'px-4 py-2 text-left text-xs font-semibold uppercase tracking-wider',
                        theme.text.muted
                      )}
                    >
                      User
                    </th>
                  )}
                  <th
                    className={cn(
                      'px-4 py-2 text-left text-xs font-semibold uppercase tracking-wider',
                      theme.text.muted
                    )}
                  >
                    Server
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
                    Duration
                  </th>
                  <th
                    className={cn(
                      'px-4 py-2 text-left text-xs font-semibold uppercase tracking-wider',
                      theme.text.muted
                    )}
                  >
                    Summary
                  </th>
                  <th
                    className={cn(
                      'px-4 py-2 text-left text-xs font-semibold uppercase tracking-wider',
                      theme.text.muted
                    )}
                  >
                    Started
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-200 dark:divide-zinc-700">
                {logs.map((log) => (
                  <OperationRow
                    key={log.id}
                    log={log}
                    isSelected={selectedLogId === log.id}
                    showUser={showUser}
                    onClick={() => handleSelectLog(log.id)}
                  />
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Pagination */}
        {pagination && pagination.total_pages > 1 && (
          <div
            className={cn(
              'flex-shrink-0 flex items-center justify-between px-4 py-2',
              'border-t border-zinc-200 dark:border-zinc-700',
              'bg-zinc-50 dark:bg-zinc-800/50'
            )}
          >
            <button
              onClick={() => onPageChange(currentPage - 1)}
              disabled={!pagination.has_prev}
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
              Page {pagination.current_page} of {pagination.total_pages}
            </span>
            <button
              onClick={() => onPageChange(currentPage + 1)}
              disabled={!pagination.has_next}
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
          <OperationDetailPanel
            detail={detail}
            isLoading={detailLoading}
            showUser={showUser}
            onClose={handleCloseDetail}
          />
        </div>
      )}
    </div>
  );
};
