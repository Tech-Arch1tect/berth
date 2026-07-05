import type { ReactNode } from 'react';
import { InboxIcon } from '@heroicons/react/24/outline';
import { cn } from '../utils/cn';
import { theme } from '../theme';
import { useIsDesktop } from '../hooks/useMediaQuery';
import { EmptyState } from './EmptyState';

export interface RecordListColumn<T> {
  key: string;
  header: string;
  render: (record: T) => ReactNode;
  className?: string;
}

interface RecordListProps<T> {
  records: T[];
  columns: RecordListColumn<T>[];
  recordKey: (record: T) => number | string;
  renderCard: (record: T) => ReactNode;
  onSelect: (record: T) => void;
  selectedKey: number | string | null;
  isLoading: boolean;
  emptyTitle: string;
  emptyDescription?: string;
  page: number;
  pageSize: number;
  totalCount: number;
  onPageChange: (page: number) => void;
  detail: ReactNode | null;
  onCloseDetail: () => void;
}

function LoadingSkeleton() {
  return (
    <div className="space-y-3 p-4">
      {Array.from({ length: 6 }, (_, i) => (
        <div
          key={i}
          className="h-14 animate-pulse rounded-lg bg-zinc-100 dark:bg-zinc-800"
          data-testid="record-skeleton"
        />
      ))}
    </div>
  );
}

export function RecordList<T>({
  records,
  columns,
  recordKey,
  renderCard,
  onSelect,
  selectedKey,
  isLoading,
  emptyTitle,
  emptyDescription,
  page,
  pageSize,
  totalCount,
  onPageChange,
  detail,
  onCloseDetail,
}: RecordListProps<T>) {
  const isDesktop = useIsDesktop();
  const totalPages = pageSize > 0 ? Math.max(1, Math.ceil(totalCount / pageSize)) : 1;

  const body = isLoading ? (
    <LoadingSkeleton />
  ) : records.length === 0 ? (
    <div className="flex h-full items-center justify-center p-6">
      <EmptyState icon={InboxIcon} title={emptyTitle} description={emptyDescription} size="md" />
    </div>
  ) : isDesktop ? (
    <table className="w-full">
      <thead className="sticky top-0 border-b border-zinc-200 bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-800">
        <tr>
          {columns.map((column) => (
            <th
              key={column.key}
              className={cn(
                'px-4 py-2 text-left text-xs font-semibold uppercase tracking-wider',
                theme.text.muted,
                column.className
              )}
            >
              {column.header}
            </th>
          ))}
        </tr>
      </thead>
      <tbody className="divide-y divide-zinc-200 dark:divide-zinc-700">
        {records.map((record) => {
          const key = recordKey(record);
          return (
            <tr
              key={key}
              onClick={() => onSelect(record)}
              className={cn(
                'cursor-pointer transition-colors',
                key === selectedKey
                  ? 'bg-teal-50 dark:bg-teal-900/20'
                  : 'hover:bg-zinc-50 dark:hover:bg-zinc-800/50'
              )}
            >
              {columns.map((column) => (
                <td key={column.key} className={cn('px-4 py-3', column.className)}>
                  {column.render(record)}
                </td>
              ))}
            </tr>
          );
        })}
      </tbody>
    </table>
  ) : (
    <ul className="space-y-2 p-3">
      {records.map((record) => {
        const key = recordKey(record);
        return (
          <li key={key}>
            <button
              type="button"
              onClick={() => onSelect(record)}
              className={cn(
                'w-full min-h-[44px] rounded-lg border p-3 text-left transition-colors',
                key === selectedKey
                  ? 'border-teal-300 bg-teal-50 dark:border-teal-700 dark:bg-teal-900/20'
                  : 'border-zinc-200 bg-white hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900 dark:hover:bg-zinc-800/50'
              )}
            >
              {renderCard(record)}
            </button>
          </li>
        );
      })}
    </ul>
  );

  return (
    <div className="flex h-full min-h-0">
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="min-h-0 flex-1 overflow-auto">{body}</div>

        {totalPages > 1 && (
          <div
            className={cn(
              'flex flex-shrink-0 items-center justify-between border-t px-4 py-2',
              'border-zinc-200 bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-800/50'
            )}
          >
            <button
              type="button"
              onClick={() => onPageChange(page - 1)}
              disabled={page <= 1}
              className={cn(
                'min-h-[44px] rounded-lg border px-4 text-sm font-medium transition-colors',
                'border-zinc-300 hover:bg-zinc-100 dark:border-zinc-600 dark:hover:bg-zinc-700',
                'disabled:cursor-not-allowed disabled:opacity-50',
                theme.text.standard
              )}
            >
              Previous
            </button>
            <span className={cn('text-sm tabular-nums', theme.text.muted)}>
              Page {page} of {totalPages}
            </span>
            <button
              type="button"
              onClick={() => onPageChange(page + 1)}
              disabled={page >= totalPages}
              className={cn(
                'min-h-[44px] rounded-lg border px-4 text-sm font-medium transition-colors',
                'border-zinc-300 hover:bg-zinc-100 dark:border-zinc-600 dark:hover:bg-zinc-700',
                'disabled:cursor-not-allowed disabled:opacity-50',
                theme.text.standard
              )}
            >
              Next
            </button>
          </div>
        )}
      </div>

      {detail !== null && isDesktop && (
        <div className="w-[400px] flex-shrink-0 overflow-hidden">{detail}</div>
      )}

      {detail !== null && !isDesktop && (
        <div className="fixed inset-0 z-[60]">
          <button
            type="button"
            aria-label="Close details"
            onClick={onCloseDetail}
            className="absolute inset-0 bg-black/40"
          />
          <div className="absolute inset-x-0 bottom-0 top-12 overflow-hidden rounded-t-2xl bg-white shadow-xl dark:bg-zinc-900">
            {detail}
          </div>
        </div>
      )}
    </div>
  );
}
