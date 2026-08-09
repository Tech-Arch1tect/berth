import React, { useMemo, useState } from 'react';
import { ChevronDownIcon, ChevronUpDownIcon, ChevronUpIcon } from '@heroicons/react/20/solid';
import { cn } from '../utils/cn';
import { theme } from '../theme';
import { LoadingSpinner } from './LoadingSpinner';
import { useIsDesktop } from '../hooks/useMediaQuery';
import {
  filterRows,
  initialDirectionFor,
  sortRows,
  type SortDirection,
  type SortValue,
} from '../utils/tableRows';

export interface Column<T> {
  key: string;
  header: string;
  render: (item: T) => React.ReactNode;
  className?: string;
  sortValue?: (item: T) => SortValue;
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
  defaultSortKey?: string;
  searchValue?: (item: T) => string;
  searchPlaceholder?: string;
}

interface SortState {
  key: string;
  direction: SortDirection;
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
  defaultSortKey,
  searchValue,
  searchPlaceholder = 'Search',
}: TableProps<T>) {
  const isDesktop = useIsDesktop();
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState<SortState | null>(null);

  const sortableColumns = columns.filter((column) => column.sortValue);
  const activeSort = useMemo<SortState | null>(() => {
    if (sort) return sort;
    if (!defaultSortKey) return null;
    const column = columns.find((entry) => entry.key === defaultSortKey);
    if (!column?.sortValue) return null;
    return { key: defaultSortKey, direction: initialDirectionFor(data, column.sortValue) };
  }, [sort, defaultSortKey, columns, data]);

  const rows = useMemo(() => {
    const matched = searchValue ? filterRows(data, searchValue, query) : data;
    if (!activeSort) return matched;
    const column = columns.find((entry) => entry.key === activeSort.key);
    return column?.sortValue ? sortRows(matched, column.sortValue, activeSort.direction) : matched;
  }, [data, columns, searchValue, query, activeSort]);

  const toggleSort = (column: Column<T>) => {
    if (!column.sortValue) return;
    setSort((current) =>
      current?.key === column.key
        ? { key: column.key, direction: current.direction === 'asc' ? 'desc' : 'asc' }
        : { key: column.key, direction: initialDirectionFor(data, column.sortValue!) }
    );
  };

  if (isLoading) {
    return <LoadingSpinner />;
  }

  if (data.length === 0) {
    return (
      <div className={cn('py-12 text-center', theme.text.muted)}>
        {emptyIcon && <div className="mb-4">{emptyIcon}</div>}
        <p>{emptyMessage}</p>
      </div>
    );
  }

  const controls = (searchValue || (!isDesktop && sortableColumns.length > 0)) && (
    <div
      className={cn(
        'flex flex-wrap items-center gap-2 border-b px-3 py-2',
        'border-zinc-200 dark:border-zinc-800'
      )}
    >
      {searchValue && (
        <input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder={searchPlaceholder}
          aria-label={searchPlaceholder}
          className={cn(
            'min-h-[44px] flex-1 rounded-lg border px-3 text-sm',
            'border-zinc-300 bg-white text-zinc-900 placeholder:text-zinc-400',
            'dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100'
          )}
        />
      )}
      {searchValue && query.trim() !== '' && (
        <span className={cn('text-sm whitespace-nowrap', theme.text.muted)}>
          {rows.length} of {data.length}
        </span>
      )}
      {!isDesktop && sortableColumns.length > 0 && (
        <div className="flex items-center gap-2">
          <select
            value={activeSort?.key ?? ''}
            onChange={(event) => {
              const column = columns.find((entry) => entry.key === event.target.value);
              if (column?.sortValue) {
                setSort({
                  key: column.key,
                  direction: initialDirectionFor(data, column.sortValue),
                });
              }
            }}
            aria-label="Sort by"
            className={cn(
              'min-h-[44px] rounded-lg border px-2 text-sm',
              'border-zinc-300 bg-white text-zinc-900',
              'dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100'
            )}
          >
            <option value="">Sort by</option>
            {sortableColumns.map((column) => (
              <option key={column.key} value={column.key}>
                {column.header}
              </option>
            ))}
          </select>
          {activeSort && (
            <button
              type="button"
              onClick={() =>
                setSort({
                  key: activeSort.key,
                  direction: activeSort.direction === 'asc' ? 'desc' : 'asc',
                })
              }
              aria-label={activeSort.direction === 'asc' ? 'Sort descending' : 'Sort ascending'}
              className={cn(
                'flex min-h-[44px] min-w-[44px] items-center justify-center rounded-lg border',
                'border-zinc-300 dark:border-zinc-700',
                theme.text.muted
              )}
            >
              {activeSort.direction === 'asc' ? (
                <ChevronUpIcon className="h-4 w-4" />
              ) : (
                <ChevronDownIcon className="h-4 w-4" />
              )}
            </button>
          )}
        </div>
      )}
    </div>
  );

  const noMatches = rows.length === 0 && (
    <div className={cn('py-12 text-center', theme.text.muted)}>
      <p>No matches for &ldquo;{query.trim()}&rdquo;</p>
    </div>
  );

  if (renderCard && !isDesktop) {
    return (
      <div className={className}>
        {controls}
        {noMatches || (
          <ul className="space-y-2 p-3">
            {rows.map((item) => (
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
        )}
      </div>
    );
  }

  return (
    <div className={className}>
      {controls}
      {noMatches || (
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-800">
            <thead className={theme.table.head}>
              <tr>
                {columns.map((column) => {
                  const isActive = activeSort?.key === column.key;
                  return (
                    <th
                      key={column.key}
                      className={cn(theme.table.headCell, column.className)}
                      aria-sort={
                        isActive
                          ? activeSort.direction === 'asc'
                            ? 'ascending'
                            : 'descending'
                          : undefined
                      }
                    >
                      {column.sortValue ? (
                        <button
                          type="button"
                          onClick={() => toggleSort(column)}
                          className="inline-flex items-center gap-1 hover:underline"
                        >
                          {column.header}
                          {isActive ? (
                            activeSort.direction === 'asc' ? (
                              <ChevronUpIcon className="h-3.5 w-3.5" />
                            ) : (
                              <ChevronDownIcon className="h-3.5 w-3.5" />
                            )
                          ) : (
                            <ChevronUpDownIcon className="h-3.5 w-3.5 opacity-40" />
                          )}
                        </button>
                      ) : (
                        column.header
                      )}
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody
              className={cn(theme.table.body, 'divide-y divide-slate-200 dark:divide-slate-800')}
            >
              {rows.map((item) => (
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
      )}
    </div>
  );
}
