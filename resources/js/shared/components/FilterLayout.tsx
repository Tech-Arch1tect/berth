import { useState, type FC, type ReactNode } from 'react';
import { FunnelIcon, XMarkIcon } from '@heroicons/react/24/outline';
import { cn } from '../utils/cn';
import { theme } from '../theme';
import { useIsDesktop } from '../hooks/useMediaQuery';

interface FilterLayoutProps {
  toolbar: ReactNode;
  filters: ReactNode;
  content: ReactNode;
  statusBar?: ReactNode;
  activeFilterCount?: number;
}

export const FilterLayout: FC<FilterLayoutProps> = ({
  toolbar,
  filters,
  content,
  statusBar,
  activeFilterCount = 0,
}) => {
  const isDesktop = useIsDesktop();
  const [sheetOpen, setSheetOpen] = useState(false);

  return (
    <div className={cn('h-full flex flex-col overflow-hidden', theme.surface.panel)}>
      <div className="flex-shrink-0 border-b border-zinc-200 dark:border-zinc-800">{toolbar}</div>

      {!isDesktop && (
        <div className="flex-shrink-0 border-b border-zinc-200 bg-white px-2 py-1.5 dark:border-zinc-800 dark:bg-zinc-900">
          <button
            type="button"
            onClick={() => setSheetOpen(true)}
            className={cn(
              'inline-flex min-h-[44px] items-center gap-2 rounded-lg px-3 text-sm font-medium',
              'text-zinc-700 hover:bg-zinc-100 dark:text-zinc-200 dark:hover:bg-zinc-800'
            )}
          >
            <FunnelIcon className="h-4 w-4" />
            <span>Filters</span>
            {activeFilterCount > 0 && (
              <span className="rounded-full bg-teal-100 px-1.5 py-0.5 text-xs font-semibold text-teal-700 dark:bg-teal-900/40 dark:text-teal-300">
                {activeFilterCount}
              </span>
            )}
          </button>
        </div>
      )}

      <div className="flex min-h-0 flex-1 overflow-hidden">
        {isDesktop && (
          <aside className="w-64 flex-shrink-0 overflow-y-auto border-r border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
            {filters}
          </aside>
        )}

        <div className="min-w-0 flex-1 overflow-auto bg-white dark:bg-zinc-900">{content}</div>
      </div>

      {statusBar && (
        <div className="flex-shrink-0 border-t border-zinc-200 dark:border-zinc-800">
          {statusBar}
        </div>
      )}

      {!isDesktop && sheetOpen && (
        <div className="fixed inset-0 z-[60]">
          <button
            type="button"
            aria-label="Close filters"
            onClick={() => setSheetOpen(false)}
            className="absolute inset-0 bg-black/40"
          />
          <div className="absolute inset-x-0 bottom-0 flex max-h-[85dvh] flex-col rounded-t-2xl bg-white shadow-xl dark:bg-zinc-900">
            <div className="flex flex-shrink-0 items-center justify-between border-b border-zinc-200 px-4 py-3 dark:border-zinc-800">
              <span className="text-sm font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                Filters
              </span>
              <button
                type="button"
                aria-label="Close"
                onClick={() => setSheetOpen(false)}
                className="flex h-11 w-11 items-center justify-center rounded-lg text-zinc-500 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800"
              >
                <XMarkIcon className="h-5 w-5" />
              </button>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto pb-[env(safe-area-inset-bottom)]">
              {filters}
            </div>

            <div className="flex-shrink-0 border-t border-zinc-200 p-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] dark:border-zinc-800">
              <button
                type="button"
                onClick={() => setSheetOpen(false)}
                className={cn('w-full min-h-[44px]', theme.buttons.primary)}
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
