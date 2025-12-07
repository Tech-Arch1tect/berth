import React from 'react';
import { ArrowPathIcon, MagnifyingGlassIcon } from '@heroicons/react/24/outline';
import { cn } from '../../../utils/cn';
import { theme } from '../../../theme';

interface OperationLogsToolbarProps {
  searchTerm: string;
  onSearchChange: (value: string) => void;
  onRefresh: () => void;
  isRefreshing: boolean;
}

export const OperationLogsToolbar: React.FC<OperationLogsToolbarProps> = ({
  searchTerm,
  onSearchChange,
  onRefresh,
  isRefreshing,
}) => {
  return (
    <div className={cn('flex items-center gap-4 px-4 py-3', 'bg-white dark:bg-zinc-900')}>
      {/* Title */}
      <div className="flex-shrink-0">
        <h1 className={cn('text-lg font-semibold', theme.text.strong)}>Operation Logs</h1>
        <p className={cn('text-xs', theme.text.muted)}>View your Docker stack operation history</p>
      </div>

      {/* Spacer */}
      <div className="flex-1" />

      {/* Search */}
      <div className="relative w-64">
        <MagnifyingGlassIcon
          className={cn('absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4', theme.text.muted)}
        />
        <input
          type="text"
          value={searchTerm}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="Search operations..."
          className={cn(
            'w-full pl-9 pr-3 py-1.5 rounded-lg text-sm',
            'border border-zinc-300 dark:border-zinc-600',
            'bg-white dark:bg-zinc-800',
            'placeholder:text-zinc-400 dark:placeholder:text-zinc-500',
            'focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent',
            theme.text.standard
          )}
        />
      </div>

      {/* Refresh */}
      <button
        onClick={onRefresh}
        disabled={isRefreshing}
        className={cn(
          'flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors',
          'border border-zinc-300 dark:border-zinc-600',
          'hover:bg-zinc-100 dark:hover:bg-zinc-800',
          'disabled:opacity-50 disabled:cursor-not-allowed',
          theme.text.standard
        )}
      >
        <ArrowPathIcon className={cn('h-4 w-4', isRefreshing && 'animate-spin')} />
        Refresh
      </button>
    </div>
  );
};
