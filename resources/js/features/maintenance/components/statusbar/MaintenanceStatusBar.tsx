import { useEffect, useState, type FC } from 'react';
import { cn } from '../../../../shared/utils/cn';
import { theme } from '../../../../shared/theme';
import { formatBytes, formatRelativeTime } from '../../../../shared/utils/formatters';

interface MaintenanceStatusBarProps {
  summary?: {
    totalImages: number;
    totalContainers: number;
    totalVolumes: number;
    totalNetworks: number;
    spaceUsed: number;
    lastUpdated: string;
  };
  canWrite: boolean;
}

const useTickEveryMinute = () => {
  const [, setTick] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => setTick((value) => value + 1), 60_000);
    return () => clearInterval(timer);
  }, []);
};

export const MaintenanceStatusBar: FC<MaintenanceStatusBarProps> = ({ summary, canWrite }) => {
  useTickEveryMinute();

  if (!summary) {
    return (
      <div className="flex items-center justify-between">
        <span className={cn('text-sm', theme.text.standard)}>Loading...</span>
      </div>
    );
  }

  const totalResources =
    summary.totalImages + summary.totalContainers + summary.totalVolumes + summary.totalNetworks;

  return (
    <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
      <span className={cn('text-sm', theme.text.standard)}>
        {totalResources} total resources · {formatBytes(summary.spaceUsed)} used
      </span>
      <span className={cn('flex items-center gap-3 text-sm', theme.text.muted)}>
        {!canWrite && <span>Read-only</span>}
        <span>read {formatRelativeTime(summary.lastUpdated)}</span>
      </span>
    </div>
  );
};
