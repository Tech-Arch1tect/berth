import React from 'react';
import { Link } from '@inertiajs/react';
import { ArrowPathIcon, Cog6ToothIcon } from '@heroicons/react/24/outline';
import { cn } from '../../../utils/cn';
import { theme } from '../../../theme';

interface DashboardToolbarProps {
  title: string;
  isRefreshing: boolean;
  onRefresh: () => void;
  isAdmin: boolean;
}

export const DashboardToolbar: React.FC<DashboardToolbarProps> = ({
  title,
  isRefreshing,
  onRefresh,
  isAdmin,
}) => {
  return (
    <div className={cn('px-4 py-3 flex items-center justify-between gap-4', theme.surface.muted)}>
      {/* Left: Title */}
      <div className="flex items-center gap-3 min-w-0">
        <h1 className={cn('text-lg font-bold', theme.brand.titleColor)}>{title}</h1>
        <div className={cn('flex items-center gap-1.5 text-xs', theme.text.subtle)}>
          <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" />
          <span>Live</span>
        </div>
      </div>

      {/* Right: Actions */}
      <div className="flex items-center gap-1">
        <button
          onClick={onRefresh}
          disabled={isRefreshing}
          className={cn(
            'p-2 rounded-md transition-colors',
            'hover:bg-zinc-100 dark:hover:bg-zinc-800',
            theme.text.muted,
            isRefreshing && 'opacity-50'
          )}
          title="Refresh all data"
        >
          <ArrowPathIcon className={cn('w-4 h-4', isRefreshing && 'animate-spin')} />
        </button>

        {isAdmin && (
          <Link
            href="/admin/servers"
            className={cn(
              'p-2 rounded-md transition-colors',
              'hover:bg-zinc-100 dark:hover:bg-zinc-800',
              theme.text.muted
            )}
            title="Server management"
          >
            <Cog6ToothIcon className="w-4 h-4" />
          </Link>
        )}
      </div>
    </div>
  );
};
