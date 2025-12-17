import type { FC } from 'react';
import { cn } from '../../../utils/cn';
import { theme } from '../../../theme';
import { formatBytes } from '../../../utils/formatters';

interface MaintenanceStatusBarProps {
  summary?: {
    totalImages: number;
    totalContainers: number;
    totalVolumes: number;
    totalNetworks: number;
    spaceUsed: number;
  };
}

export const MaintenanceStatusBar: FC<MaintenanceStatusBarProps> = ({ summary }) => {
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
    <div className="flex items-center justify-between">
      <span className={cn('text-sm', theme.text.standard)}>
        {totalResources} total resources · {formatBytes(summary.spaceUsed)} used
      </span>
    </div>
  );
};
