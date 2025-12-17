import type { FC } from 'react';
import { PlusIcon, ArrowPathIcon, KeyIcon } from '@heroicons/react/24/outline';
import { cn } from '../../../utils/cn';
import { theme } from '../../../theme';

interface RegistriesToolbarProps {
  serverName: string;
  onAddCredential: () => void;
  onRefresh: () => void;
  isRefreshing?: boolean;
  disableAdd?: boolean;
}

export const RegistriesToolbar: FC<RegistriesToolbarProps> = ({
  serverName,
  onAddCredential,
  onRefresh,
  isRefreshing = false,
  disableAdd = false,
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
          <KeyIcon className="w-5 h-5 text-white" />
        </div>
        <h1 className={cn('text-lg font-bold', theme.brand.titleColor)}>
          {serverName} - Registry Credentials
        </h1>
      </div>

      {/* Right: Actions */}
      <div className="flex items-center gap-1">
        <button
          onClick={onAddCredential}
          disabled={disableAdd}
          className={cn(
            'px-3 py-1.5 rounded-md text-sm font-medium transition-colors flex items-center gap-1.5',
            'bg-teal-600 hover:bg-teal-700 dark:bg-teal-600 dark:hover:bg-teal-700',
            'text-white',
            disableAdd && 'opacity-50 cursor-not-allowed'
          )}
          title="Add new credential"
        >
          <PlusIcon className="w-4 h-4" />
          <span className="hidden sm:inline">Add Credential</span>
        </button>

        <button
          onClick={onRefresh}
          disabled={isRefreshing}
          className={cn(
            'p-2 rounded-md transition-colors',
            'hover:bg-zinc-100 dark:hover:bg-zinc-800',
            theme.text.muted,
            isRefreshing && 'opacity-50'
          )}
          title="Refresh credentials"
        >
          <ArrowPathIcon className={cn('w-4 h-4', isRefreshing && 'animate-spin')} />
        </button>
      </div>
    </div>
  );
};
