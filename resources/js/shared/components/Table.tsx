import React from 'react';
import { cn } from '../utils/cn';
import { theme } from '../theme';
import { LoadingSpinner } from './LoadingSpinner';
import { useIsDesktop } from '../hooks/useMediaQuery';

export interface Column<T> {
  key: string;
  header: string;
  render: (item: T) => React.ReactNode;
  className?: string;
  sortable?: boolean;
}

export interface TableProps<T> {
  data: T[];
  columns: Column<T>[];
  keyExtractor: (item: T) => string;
  onRowClick?: (item: T) => void;
  isLoading?: boolean;
  emptyMessage?: string;
  emptyIcon?: React.ReactNode;
  className?: string;
  renderCard?: (item: T) => React.ReactNode;
}

export function Table<T>({
  data,
  columns,
  keyExtractor,
  onRowClick,
  isLoading = false,
  emptyMessage = 'No data available',
  emptyIcon,
  className,
  renderCard,
}: TableProps<T>) {
  const isDesktop = useIsDesktop();

  if (isLoading) {
    return <LoadingSpinner />;
  }

  if (data.length === 0) {
    return (
      <div className={cn('text-center py-12', theme.text.muted)}>
        {emptyIcon && <div className="mb-4">{emptyIcon}</div>}
        <p>{emptyMessage}</p>
      </div>
    );
  }

  if (renderCard && !isDesktop) {
    return (
      <ul className={cn('space-y-2 p-3', className)}>
        {data.map((item) => (
          <li
            key={keyExtractor(item)}
            onClick={() => onRowClick?.(item)}
            className={cn(
              'rounded-lg border border-zinc-200 bg-white p-3 dark:border-zinc-700 dark:bg-zinc-900',
              onRowClick && 'cursor-pointer hover:bg-zinc-50 dark:hover:bg-zinc-800/50'
            )}
          >
            {renderCard(item)}
          </li>
        ))}
      </ul>
    );
  }

  return (
    <div className={cn('overflow-x-auto', className)}>
      <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-800">
        <thead className={theme.table.head}>
          <tr>
            {columns.map((column) => (
              <th key={column.key} className={cn(theme.table.headCell, column.className)}>
                {column.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className={cn(theme.table.body, 'divide-y divide-slate-200 dark:divide-slate-800')}>
          {data.map((item) => (
            <tr
              key={keyExtractor(item)}
              onClick={() => onRowClick?.(item)}
              className={cn(
                'transition-colors',
                'hover:bg-slate-50 dark:hover:bg-slate-800/50',
                onRowClick && 'cursor-pointer'
              )}
            >
              {columns.map((column) => (
                <td key={column.key} className={theme.table.cell}>
                  {column.render(item)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
