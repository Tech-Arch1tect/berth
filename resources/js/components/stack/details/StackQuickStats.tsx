import React from 'react';
import { StatCard } from '../../common/StatCard';
import { CircleStackIcon, ServerIcon, GlobeAltIcon, FolderIcon } from '@heroicons/react/24/outline';

interface StackQuickStatsProps {
  serviceCount: number;
  containerCount: number;
  networkCount: number;
  volumeCount: number;
}

export const StackQuickStats: React.FC<StackQuickStatsProps> = ({
  serviceCount,
  containerCount,
  networkCount,
  volumeCount,
}) => {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
      <StatCard
        label="Services"
        value={serviceCount}
        icon={CircleStackIcon}
        iconColor="text-blue-600 dark:text-blue-400"
        iconBg="bg-blue-100 dark:bg-blue-900/20"
        className="rounded-2xl"
      />
      <StatCard
        label="Containers"
        value={containerCount}
        icon={ServerIcon}
        iconColor="text-green-600 dark:text-green-400"
        iconBg="bg-green-100 dark:bg-green-900/20"
        className="rounded-2xl"
      />
      <StatCard
        label="Networks"
        value={networkCount}
        icon={GlobeAltIcon}
        iconColor="text-purple-600 dark:text-purple-400"
        iconBg="bg-purple-100 dark:bg-purple-900/20"
        className="rounded-2xl"
      />
      <StatCard
        label="Volumes"
        value={volumeCount}
        icon={FolderIcon}
        iconColor="text-emerald-600 dark:text-emerald-400"
        iconBg="bg-emerald-100 dark:bg-emerald-900/20"
        className="rounded-2xl"
      />
    </div>
  );
};
