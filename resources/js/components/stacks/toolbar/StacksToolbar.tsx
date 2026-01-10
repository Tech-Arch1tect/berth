import {
  ArrowPathIcon,
  CircleStackIcon,
  Squares2X2Icon,
  ListBulletIcon,
  PlusIcon,
} from '@heroicons/react/24/outline';
import { cn } from '../../../utils/cn';
import { theme } from '../../../theme';

interface StacksToolbarProps {
  title: string;
  isRefreshing: boolean;
  onRefresh: () => void;
  layoutMode: 'compact' | 'normal';
  onLayoutToggle: () => void;
  onCreateStack?: () => void;
}

export const StacksToolbar: React.FC<StacksToolbarProps> = ({
  title,
  isRefreshing,
  onRefresh,
  layoutMode,
  onLayoutToggle,
  onCreateStack,
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
          <CircleStackIcon className="w-5 h-5 text-white" />
        </div>
        <h1 className={cn('text-lg font-bold', theme.brand.titleColor)}>{title}</h1>
      </div>

      {/* Right: Actions */}
      <div className="flex items-center gap-1">
        {onCreateStack && (
          <button
            onClick={onCreateStack}
            className={cn(
              'px-3 py-1.5 rounded-md text-sm font-medium transition-colors flex items-center gap-1.5',
              theme.buttons.primary
            )}
            title="Create new stack"
          >
            <PlusIcon className="w-4 h-4" />
            <span className="hidden sm:inline">Create Stack</span>
          </button>
        )}

        <button
          onClick={onLayoutToggle}
          className={cn(
            'px-3 py-1.5 rounded-md text-sm font-medium transition-colors flex items-center gap-1.5',
            'hover:bg-zinc-100 dark:hover:bg-zinc-800',
            theme.text.muted
          )}
          title={layoutMode === 'compact' ? 'Switch to normal view' : 'Switch to compact view'}
        >
          {layoutMode === 'compact' ? (
            <>
              <Squares2X2Icon className="w-4 h-4" />
              <span className="hidden sm:inline">Normal</span>
            </>
          ) : (
            <>
              <ListBulletIcon className="w-4 h-4" />
              <span className="hidden sm:inline">Compact</span>
            </>
          )}
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
          title="Refresh all stacks"
        >
          <ArrowPathIcon className={cn('w-4 h-4', isRefreshing && 'animate-spin')} />
        </button>
      </div>
    </div>
  );
};
