import { useCallback, useState } from 'react';
import {
  ArrowPathIcon,
  ClockIcon,
  FunnelIcon,
  MagnifyingGlassIcon,
} from '@heroicons/react/24/outline';
import { cn } from '../../../shared/utils/cn';
import { theme } from '../../../shared/theme';
import { FilterLayout } from '../../../shared/components/FilterLayout';
import { RecordList, type RecordListColumn } from '../../../shared/components/RecordList';
import type {
  Meta,
  OperationLogDetailData,
  OperationLogInfo,
  OperationLogStatsData,
} from '../../../api/generated/models';
import { OperationDetailPanel } from './panels/OperationDetailPanel';
import { OperationLogsFilters } from './filters/OperationLogsFilters';
import { StatusBadge, TriggerBadge } from './badges';
import { operationDuration } from '../duration';

interface OperationLogsViewProps {
  title: string;
  subtitle: string;
  showUser: boolean;
  logs: OperationLogInfo[];
  stats: OperationLogStatsData | null;
  meta: Meta | null;
  isLoading: boolean;
  page: number;
  onPageChange: (page: number) => void;
  searchTerm: string;
  onSearchChange: (value: string) => void;
  selectedStatus: string;
  onStatusChange: (status: string) => void;
  selectedCommand: string;
  onCommandChange: (command: string) => void;
  daysBack: number | null;
  onDaysBackChange: (daysBack: number | null) => void;
  onClearFilters: () => void;
  isRefreshing: boolean;
  onRefresh: () => void;
  lastUpdated: Date | null;
  onFetchDetail: (logId: number) => Promise<OperationLogDetailData | null>;
}

const statusChipDefs = [
  { value: '', label: 'all', color: '' },
  { value: 'success', label: 'ok', color: 'text-emerald-600 dark:text-emerald-400' },
  { value: 'failed', label: 'failed', color: 'text-red-600 dark:text-red-400' },
  { value: 'incomplete', label: 'incomplete', color: 'text-amber-600 dark:text-amber-400' },
] as const;

function statusChipCount(stats: OperationLogStatsData, value: string) {
  switch (value) {
    case 'success':
      return stats.successful_operations;
    case 'failed':
      return stats.failed_operations;
    case 'incomplete':
      return stats.incomplete_operations;
    default:
      return stats.total_operations;
  }
}

export const OperationLogsView: React.FC<OperationLogsViewProps> = ({
  title,
  subtitle,
  showUser,
  logs,
  stats,
  meta,
  isLoading,
  page,
  onPageChange,
  searchTerm,
  onSearchChange,
  selectedStatus,
  onStatusChange,
  selectedCommand,
  onCommandChange,
  daysBack,
  onDaysBackChange,
  onClearFilters,
  isRefreshing,
  onRefresh,
  lastUpdated,
  onFetchDetail,
}) => {
  const [selectedLogId, setSelectedLogId] = useState<number | null>(null);
  const [detail, setDetail] = useState<OperationLogDetailData | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const handleSelectLog = useCallback(
    async (log: OperationLogInfo) => {
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
    searchTerm !== '' || selectedStatus !== '' || selectedCommand !== '' || daysBack !== null;
  const activeFilterCount = [
    searchTerm !== '',
    selectedStatus !== '',
    selectedCommand !== '',
    daysBack !== null,
  ].filter(Boolean).length;

  const columns: RecordListColumn<OperationLogInfo>[] = [
    {
      key: 'operation',
      header: 'Operation',
      render: (log) => (
        <>
          <div className={cn('font-medium', theme.text.strong)}>{log.command}</div>
          <div className={cn('text-xs font-mono', theme.text.muted)}>
            {log.operation_id.slice(-8)}
          </div>
        </>
      ),
    },
    {
      key: 'stack',
      header: 'Stack',
      render: (log) => <span className={theme.text.standard}>{log.stack_name}</span>,
    },
    {
      key: 'trigger',
      header: 'Trigger',
      render: (log) => <TriggerBadge triggerSource={log.trigger_source} />,
    },
    ...(showUser
      ? [
          {
            key: 'user',
            header: 'User',
            render: (log: OperationLogInfo) => (
              <span className={theme.text.standard}>{log.user_name}</span>
            ),
          },
        ]
      : []),
    {
      key: 'server',
      header: 'Server',
      render: (log) => <span className={theme.text.standard}>{log.server_name}</span>,
    },
    {
      key: 'status',
      header: 'Status',
      render: (log) => <StatusBadge log={log} />,
    },
    {
      key: 'duration',
      header: 'Duration',
      render: (log) => (
        <span className={cn('text-sm', theme.text.muted)}>{operationDuration(log)}</span>
      ),
    },
    {
      key: 'summary',
      header: 'Summary',
      className: 'max-w-xs',
      render: (log) =>
        log.summary ? (
          <span
            className={cn('block truncate text-sm italic', theme.text.muted)}
            title={log.summary}
          >
            {log.summary}
          </span>
        ) : (
          <span className={cn('text-sm', theme.text.subtle)}>-</span>
        ),
    },
    {
      key: 'started',
      header: 'Started',
      render: (log) => (
        <span className={cn('text-sm', theme.text.muted)}>{log.formatted_date}</span>
      ),
    },
  ];

  const renderCard = (log: OperationLogInfo) => (
    <div className="space-y-1">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className={cn('font-medium', theme.text.strong)}>{log.command}</span>
        <StatusBadge log={log} />
      </div>
      <div className={cn('text-sm', theme.text.standard)}>
        {log.stack_name} · {log.server_name}
        {showUser && <> · {log.user_name}</>}
      </div>
      {log.summary && (
        <div className={cn('truncate text-sm italic', theme.text.muted)}>{log.summary}</div>
      )}
      <div className={cn('flex flex-wrap items-center gap-x-2 text-xs', theme.text.subtle)}>
        <span>{operationDuration(log)}</span>
        <span>·</span>
        <span>{log.formatted_date}</span>
        {log.trigger_source !== 'manual' && <TriggerBadge triggerSource={log.trigger_source} />}
      </div>
    </div>
  );

  const toolbar = (
    <div className="flex flex-wrap items-center gap-3 bg-white px-4 py-3 dark:bg-zinc-900">
      <div className="min-w-0">
        <h1 className={cn('text-lg font-semibold', theme.text.strong)}>{title}</h1>
        <p className={cn('text-xs', theme.text.muted)}>{subtitle}</p>
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
            placeholder="Search operations..."
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

  const statusChips = stats && (
    <div className="flex flex-wrap items-center gap-2 border-b border-zinc-200 bg-white px-4 py-2 dark:border-zinc-800 dark:bg-zinc-900">
      {statusChipDefs.map((chip) => {
        const count = statusChipCount(stats, chip.value);
        if (chip.value !== '' && count === 0) return null;
        const active = selectedStatus === chip.value;
        return (
          <button
            key={chip.value}
            type="button"
            aria-pressed={active}
            onClick={() => onStatusChange(active && chip.value !== '' ? '' : chip.value)}
            className={cn(
              'min-h-[44px] rounded-full border px-3 font-mono text-xs transition-colors',
              chip.color || theme.text.muted,
              active
                ? 'border-teal-500 bg-teal-50 dark:bg-teal-900/30'
                : 'border-zinc-200 hover:border-zinc-400 dark:border-zinc-700 dark:hover:border-zinc-500'
            )}
          >
            {count.toLocaleString()} {chip.label}
          </button>
        );
      })}
    </div>
  );

  const totalPages =
    meta && meta.totalCount != null && meta.pageSize != null && meta.pageSize > 0
      ? Math.max(1, Math.ceil(meta.totalCount / meta.pageSize))
      : 1;

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
          emptyTitle="No operations found"
          emptyDescription={
            hasActiveFilters
              ? 'No operations match the current filters.'
              : 'Stack operations will appear here once they run.'
          }
          page={meta?.page ?? page}
          pageSize={meta?.pageSize ?? 25}
          totalCount={meta?.totalCount ?? 0}
          onPageChange={onPageChange}
          detail={
            selectedLogId !== null ? (
              <OperationDetailPanel
                detail={detail}
                isLoading={detailLoading}
                showUser={showUser}
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
            operations
            {totalPages > 1 && <> · page {meta.page}</>}
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
        <OperationLogsFilters
          selectedCommand={selectedCommand}
          daysBack={daysBack}
          onCommandChange={onCommandChange}
          onDaysBackChange={onDaysBackChange}
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
