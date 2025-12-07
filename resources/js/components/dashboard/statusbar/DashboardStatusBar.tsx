import React, { useState, useEffect } from 'react';
import { HealthSummary } from '../types/dashboard';
import { cn } from '../../../utils/cn';
import { theme } from '../../../theme';

interface DashboardStatusBarProps {
  healthSummary: HealthSummary;
  lastUpdated: Date | null;
  isLoading: boolean;
}

export const DashboardStatusBar: React.FC<DashboardStatusBarProps> = ({
  healthSummary,
  lastUpdated,
  isLoading,
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

  return (
    <div className={cn('h-6 px-3 flex items-center justify-between text-xs', theme.surface.muted)}>
      {/* Left side */}
      <div className="flex items-center gap-4">
        {/* Live indicator */}
        <div className="flex items-center gap-1.5">
          <span
            className={cn(
              'w-2 h-2 rounded-full',
              isLoading ? 'bg-amber-500 animate-pulse' : 'bg-emerald-500'
            )}
          />
          <span className={theme.text.muted}>{isLoading ? 'Loading...' : 'Live'}</span>
        </div>

        {/* Server counts */}
        <div className={theme.text.muted}>
          <span
            className={
              healthSummary.serversOnline === healthSummary.totalActiveServers &&
              healthSummary.totalActiveServers > 0
                ? 'text-emerald-600 dark:text-emerald-400'
                : ''
            }
          >
            {healthSummary.serversOnline}
          </span>
          <span className={theme.text.subtle}>/</span>
          <span>{healthSummary.totalActiveServers}</span>
          <span className={cn('ml-1', theme.text.subtle)}>servers online</span>
        </div>

        {/* Stack counts */}
        <div className={theme.text.muted}>
          <span
            className={
              healthSummary.healthyStacks === healthSummary.totalStacks &&
              healthSummary.totalStacks > 0
                ? 'text-emerald-600 dark:text-emerald-400'
                : ''
            }
          >
            {healthSummary.healthyStacks}
          </span>
          <span className={theme.text.subtle}>/</span>
          <span>{healthSummary.totalStacks}</span>
          <span className={cn('ml-1', theme.text.subtle)}>stacks healthy</span>
        </div>
      </div>

      {/* Right side */}
      <div className="flex items-center gap-4">
        {/* Alerts */}
        {healthSummary.unhealthyStacks > 0 && (
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-red-500" />
            <span className="text-red-600 dark:text-red-400">
              {healthSummary.unhealthyStacks} alert{healthSummary.unhealthyStacks !== 1 ? 's' : ''}
            </span>
          </div>
        )}

        {/* Last updated */}
        <div className={theme.text.subtle}>Updated {formatLastUpdated(lastUpdated)}</div>
      </div>
    </div>
  );
};
