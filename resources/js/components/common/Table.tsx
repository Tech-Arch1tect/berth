import React from 'react';
import { cn } from '../../utils/cn';
import { theme } from '../../theme';

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
}: TableProps<T>) {
  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className={theme.effects.spinner}></div>
      </div>
    );
  }

  if (data.length === 0) {
    return (
      <div className={cn('text-center py-12', theme.text.muted)}>
        {emptyIcon && <div className="mb-4">{emptyIcon}</div>}
        <p>{emptyMessage}</p>
      </div>
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
