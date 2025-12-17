import { useState, useEffect } from 'react';
import { cn } from '../../../utils/cn';
import { theme } from '../../../theme';

interface StacksStatusBarProps {
  filteredCount: number;
  totalCount: number;
  lastUpdated: Date | null;
  activeFilterCount: number;
}

export const StacksStatusBar: React.FC<StacksStatusBarProps> = ({
  filteredCount,
  totalCount,
  lastUpdated,
  activeFilterCount,
}) => {
  const [, setTick] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => setTick((t) => t + 1), 30000);
    return () => clearInterval(interval);
  }, []);

  const formatLastUpdated = (date: Date | null): string => {
    if (!date) return 'Never';
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffSec = Math.floor(diffMs / 1000);

    if (diffSec < 5) return 'Just now';
    if (diffSec < 60) return `${diffSec}s ago`;
    const diffMin = Math.floor(diffSec / 60);
    if (diffMin < 60) return `${diffMin}m ago`;
    const diffHr = Math.floor(diffMin / 60);
    if (diffHr < 24) return `${diffHr}h ago`;
    return date.toLocaleDateString();
  };

  const isFiltered = filteredCount !== totalCount;

  return (
    <div className={cn('h-6 px-3 flex items-center justify-between text-xs', theme.surface.muted)}>
      {/* Left side */}
      <div className="flex items-center gap-4">
        {/* Stack count */}
        <div className={theme.text.muted}>
          <span>Showing </span>
          <span
            className={
              isFiltered
                ? 'text-teal-600 dark:text-teal-400 font-medium'
                : 'text-emerald-600 dark:text-emerald-400 font-medium'
            }
          >
            {filteredCount}
          </span>
          {isFiltered && (
            <>
              <span className={theme.text.subtle}> of </span>
              <span>{totalCount}</span>
            </>
          )}
          <span className={cn('ml-1', theme.text.subtle)}>
            {filteredCount === 1 ? 'stack' : 'stacks'}
          </span>
        </div>

        {/* Active filters indicator */}
        {activeFilterCount > 0 && (
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-teal-500" />
            <span className="text-teal-600 dark:text-teal-400">
              {activeFilterCount} {activeFilterCount === 1 ? 'filter' : 'filters'} active
            </span>
          </div>
        )}
      </div>

      {/* Right side */}
      <div className="flex items-center gap-4">
        {/* Last updated */}
        <div className={theme.text.subtle}>Updated {formatLastUpdated(lastUpdated)}</div>
      </div>
    </div>
  );
};
