import type { FC } from 'react';
import { ArrowPathIcon, WrenchScrewdriverIcon } from '@heroicons/react/24/outline';
import { cn } from '../../../utils/cn';
import { theme } from '../../../theme';

interface MaintenanceToolbarProps {
  serverName: string;
  onRefresh: () => void;
  isRefreshing?: boolean;
}

export const MaintenanceToolbar: FC<MaintenanceToolbarProps> = ({
  serverName,
  onRefresh,
  isRefreshing = false,
}) => {
  return (
    <div className={cn('px-4 py-3 flex items-center justify-between gap-4', theme.surface.muted)}>
      {/* Left: Title with Icon */}
      <div className="flex items-center gap-3 min-w-0">
        <div
          className={cn(
            'w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0',
            theme.brand.accent
          )}
        >
          <WrenchScrewdriverIcon className="w-5 h-5 text-white" />
        </div>
        <h1 className={cn('text-lg font-bold', theme.brand.titleColor)}>
          {serverName} - Docker Maintenance
        </h1>
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
          title="Refresh maintenance information"
        >
          <ArrowPathIcon className={cn('w-4 h-4', isRefreshing && 'animate-spin')} />
        </button>
      </div>
    </div>
  );
};
