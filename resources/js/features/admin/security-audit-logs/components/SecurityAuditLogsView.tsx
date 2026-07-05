import { useCallback, useState } from 'react';
import {
  ArrowPathIcon,
  CheckCircleIcon,
  ClockIcon,
  FunnelIcon,
  MagnifyingGlassIcon,
  XCircleIcon,
} from '@heroicons/react/24/outline';
import { cn } from '../../../../shared/utils/cn';
import { theme } from '../../../../shared/theme';
import { FilterLayout } from '../../../../shared/components/FilterLayout';
import { RecordList, type RecordListColumn } from '../../../../shared/components/RecordList';
import type {
  Meta,
  SecurityAuditLogInfo,
  StatsResponseData,
} from '../../../../api/generated/models';
import { SecurityAuditDetailPanel } from './panels/SecurityAuditDetailPanel';
import { SecurityAuditLogsFilters } from './filters/SecurityAuditLogsFilters';
import { getSeverityBadgeStyle, getCategoryBadgeStyle } from '../utils/securityAuditHelpers';

interface SecurityAuditLogsViewProps {
  logs: SecurityAuditLogInfo[];
  stats: StatsResponseData | null;
  meta: Meta | null;
  isLoading: boolean;
  page: number;
  onPageChange: (page: number) => void;
  searchTerm: string;
  onSearchChange: (value: string) => void;
  selectedSuccess: string;
  onSuccessChange: (success: string) => void;
  selectedSeverity: string;
  onSeverityChange: (severity: string) => void;
  selectedCategory: string;
  onCategoryChange: (category: string) => void;
  startDate: string;
  onStartDateChange: (date: string) => void;
  endDate: string;
  onEndDateChange: (date: string) => void;
  onClearFilters: () => void;
  isRefreshing: boolean;
  onRefresh: () => void;
  lastUpdated: Date | null;
  onFetchDetail: (logId: number) => Promise<SecurityAuditLogInfo | null>;
}

const StatusBadge: React.FC<{ success: boolean }> = ({ success }) => (
  <span
    className={cn(
      'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium',
      success
        ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300'
        : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300'
    )}
  >
    {success ? <CheckCircleIcon className="h-3 w-3" /> : <XCircleIcon className="h-3 w-3" />}
    {success ? 'Success' : 'Failed'}
  </span>
);

export const SecurityAuditLogsView: React.FC<SecurityAuditLogsViewProps> = ({
  logs,
  stats,
  meta,
  isLoading,
  page,
  onPageChange,
  searchTerm,
  onSearchChange,
  selectedSuccess,
  onSuccessChange,
  selectedSeverity,
  onSeverityChange,
  selectedCategory,
  onCategoryChange,
  startDate,
  onStartDateChange,
  endDate,
  onEndDateChange,
  onClearFilters,
  isRefreshing,
  onRefresh,
  lastUpdated,
  onFetchDetail,
}) => {
  const [selectedLogId, setSelectedLogId] = useState<number | null>(null);
  const [detail, setDetail] = useState<SecurityAuditLogInfo | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const handleSelectLog = useCallback(
    async (log: SecurityAuditLogInfo) => {
      if (selectedLogId === log.id) {
        setSelectedLogId(null);
        setDetail(null);
        return;
      }
      setSelectedLogId(log.id);
      setDetailLoading(true);
      try {
        setDetail(await onFetchDetail(log.id));
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

  const hasActiveFilters =
    searchTerm !== '' ||
    selectedSuccess !== 'all' ||
    selectedSeverity !== 'all' ||
    selectedCategory !== 'all' ||
    startDate !== '' ||
    endDate !== '';
  const activeFilterCount = [
    searchTerm !== '',
    selectedSuccess !== 'all',
    selectedSeverity !== 'all',
    selectedCategory !== 'all',
    startDate !== '',
    endDate !== '',
  ].filter(Boolean).length;

  const columns: RecordListColumn<SecurityAuditLogInfo>[] = [
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
        <span className={cn('font-medium', theme.text.strong)}>{log.event_type}</span>
      ),
    },
    {
      key: 'category',
      header: 'Category',
      render: (log) => (
        <span
          className={cn(
            'rounded px-2 py-1 text-xs font-medium',
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
            'rounded px-2 py-1 text-xs font-medium',
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
      render: (log) => <span className={theme.text.standard}>{log.actor_username || '-'}</span>,
    },
    {
      key: 'target',
      header: 'Target',
      render: (log) => <span className={theme.text.standard}>{log.target_name || '-'}</span>,
    },
    {
      key: 'status',
      header: 'Status',
      render: (log) => <StatusBadge success={log.success} />,
    },
    {
      key: 'ip',
      header: 'IP',
      render: (log) => (
        <span className={cn('font-mono text-sm', theme.text.muted)}>{log.actor_ip}</span>
      ),
    },
  ];

  const renderCard = (log: SecurityAuditLogInfo) => (
    <div className="space-y-1.5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className={cn('font-medium', theme.text.strong)}>{log.event_type}</span>
        <StatusBadge success={log.success} />
      </div>
      <div className="flex flex-wrap items-center gap-1.5">
        <span
          className={cn(
            'rounded px-2 py-0.5 text-xs font-medium',
            getSeverityBadgeStyle(log.severity)
          )}
        >
          {log.severity}
        </span>
        <span
          className={cn(
            'rounded px-2 py-0.5 text-xs font-medium',
            getCategoryBadgeStyle(log.event_category)
          )}
        >
          {log.event_category}
        </span>
      </div>
      {(log.actor_username || log.target_name) && (
        <div className={cn('text-sm', theme.text.standard)}>
          {log.actor_username || '-'}
          {log.target_name && <> → {log.target_name}</>}
        </div>
      )}
      <div className={cn('flex flex-wrap items-center gap-x-2 text-xs', theme.text.subtle)}>
        <span>{new Date(log.created_at).toLocaleString()}</span>
        {log.actor_ip && (
          <>
            <span>·</span>
            <span className="font-mono">{log.actor_ip}</span>
          </>
        )}
      </div>
    </div>
  );

  const toolbar = (
    <div className="flex flex-wrap items-center gap-3 bg-white px-4 py-3 dark:bg-zinc-900">
      <div className="min-w-0">
        <h1 className={cn('text-lg font-semibold', theme.text.strong)}>Security Audit Logs</h1>
        <p className={cn('text-xs', theme.text.muted)}>
          Monitor and review security-relevant events
        </p>
      </div>
      <div className="ml-auto flex w-full items-center gap-2 sm:w-auto">
        <div className="relative min-w-0 flex-1 sm:w-64 sm:flex-none">
          <MagnifyingGlassIcon
            className={cn('absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2', theme.text.muted)}
          />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Search events..."
            className={cn(
              'w-full min-h-[44px] rounded-lg pl-9 pr-3 text-sm',
              'border border-zinc-300 dark:border-zinc-600',
              'bg-white dark:bg-zinc-800',
              'placeholder:text-zinc-400 dark:placeholder:text-zinc-500',
              'focus:border-transparent focus:outline-none focus:ring-2 focus:ring-teal-500',
              theme.text.standard
            )}
          />
        </div>
        <button
          type="button"
          onClick={onRefresh}
          disabled={isRefreshing}
          className={cn(
            'flex min-h-[44px] items-center gap-2 rounded-lg border px-3 text-sm font-medium transition-colors',
            'border-zinc-300 hover:bg-zinc-100 dark:border-zinc-600 dark:hover:bg-zinc-800',
            'disabled:cursor-not-allowed disabled:opacity-50',
            theme.text.standard
          )}
        >
          <ArrowPathIcon className={cn('h-4 w-4', isRefreshing && 'animate-spin')} />
          <span className="hidden sm:inline">Refresh</span>
        </button>
      </div>
    </div>
  );

  const successCount = stats ? stats.total_events - stats.failed_events : 0;
  const statusChips = stats && (
    <div className="flex flex-wrap items-center gap-2 border-b border-zinc-200 bg-white px-4 py-2 dark:border-zinc-800 dark:bg-zinc-900">
      {[
        { value: 'all', label: 'all', count: stats.total_events, color: '' },
        {
          value: 'true',
          label: 'ok',
          count: successCount,
          color: 'text-emerald-600 dark:text-emerald-400',
        },
        {
          value: 'false',
          label: 'failed',
          count: stats.failed_events,
          color: 'text-red-600 dark:text-red-400',
        },
      ].map((chip) => {
        if (chip.value !== 'all' && chip.count === 0) return null;
        const active = selectedSuccess === chip.value;
        return (
          <button
            key={chip.value}
            type="button"
            aria-pressed={active}
            onClick={() => onSuccessChange(active && chip.value !== 'all' ? 'all' : chip.value)}
            className={cn(
              'min-h-[44px] rounded-full border px-3 font-mono text-xs transition-colors',
              chip.color || theme.text.muted,
              active
                ? 'border-teal-500 bg-teal-50 dark:bg-teal-900/30'
                : 'border-zinc-200 hover:border-zinc-400 dark:border-zinc-700 dark:hover:border-zinc-500'
            )}
          >
            {chip.count.toLocaleString()} {chip.label}
          </button>
        );
      })}
    </div>
  );

  const content = (
    <div className="flex h-full min-h-0 flex-col">
      {statusChips}
      <div className="min-h-0 flex-1">
        <RecordList
          records={logs}
          columns={columns}
          recordKey={(log) => log.id}
          renderCard={renderCard}
          onSelect={handleSelectLog}
          selectedKey={selectedLogId}
          isLoading={isLoading}
          emptyTitle="No security events found"
          emptyDescription={
            hasActiveFilters
              ? 'No events match the current filters.'
              : 'Security-relevant events will appear here as they occur.'
          }
          page={meta?.page ?? page}
          pageSize={meta?.pageSize ?? 50}
          totalCount={meta?.totalCount ?? 0}
          onPageChange={onPageChange}
          detail={
            selectedLogId !== null ? (
              <SecurityAuditDetailPanel
                log={detail}
                isLoading={detailLoading}
                onClose={handleCloseDetail}
              />
            ) : null
          }
          onCloseDetail={handleCloseDetail}
        />
      </div>
    </div>
  );

  const statusBar = (
    <div
      className={cn(
        'flex items-center justify-between px-4 py-2 text-xs',
        'bg-zinc-50 dark:bg-zinc-800/50'
      )}
    >
      <div className="flex items-center gap-4">
        {meta?.page != null && meta.pageSize != null && meta.totalCount != null && (
          <span className={theme.text.muted}>
            Showing{' '}
            <span className={cn('font-medium', theme.text.standard)}>
              {meta.totalCount === 0 ? 0 : ((meta.page - 1) * meta.pageSize + 1).toLocaleString()}
            </span>
            {' - '}
            <span className={cn('font-medium', theme.text.standard)}>
              {Math.min(meta.page * meta.pageSize, meta.totalCount).toLocaleString()}
            </span>
            {' of '}
            <span className={cn('font-medium', theme.text.standard)}>
              {meta.totalCount.toLocaleString()}
            </span>{' '}
            events
          </span>
        )}
        {hasActiveFilters && (
          <span
            className={cn(
              'flex items-center gap-1.5 rounded-full px-2 py-0.5',
              'bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-300'
            )}
          >
            <FunnelIcon className="h-3 w-3" />
            <span className="font-medium">
              {activeFilterCount} filter{activeFilterCount !== 1 ? 's' : ''} active
            </span>
          </span>
        )}
      </div>
      {lastUpdated && (
        <span className={cn('flex items-center gap-1.5', theme.text.muted)}>
          <ClockIcon className="h-3.5 w-3.5" />
          Updated{' '}
          {lastUpdated.toLocaleTimeString(undefined, {
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
          })}
        </span>
      )}
    </div>
  );

  return (
    <FilterLayout
      toolbar={toolbar}
      filters={
        <SecurityAuditLogsFilters
          stats={stats}
          selectedSeverity={selectedSeverity}
          selectedCategory={selectedCategory}
          startDate={startDate}
          endDate={endDate}
          onSeverityChange={onSeverityChange}
          onCategoryChange={onCategoryChange}
          onStartDateChange={onStartDateChange}
          onEndDateChange={onEndDateChange}
          onClearFilters={onClearFilters}
          hasActiveFilters={hasActiveFilters}
        />
      }
      content={content}
      statusBar={statusBar}
      activeFilterCount={activeFilterCount}
    />
  );
};
