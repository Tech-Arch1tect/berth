import React from 'react';
import { StatCard } from '../../common/StatCard';
import { CircleStackIcon, ServerIcon, GlobeAltIcon, FolderIcon } from '@heroicons/react/24/outline';
import { theme } from '../../../theme';

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
        iconColor={theme.text.info}
        iconBg={theme.intent.info.surface}
        className="rounded-2xl"
      />
      <StatCard
        label="Containers"
        value={containerCount}
        icon={ServerIcon}
        iconColor={theme.text.success}
        iconBg={theme.intent.success.surface}
        className="rounded-2xl"
      />
      <StatCard
        label="Networks"
        value={networkCount}
        icon={GlobeAltIcon}
        iconColor={theme.text.info}
        iconBg={theme.intent.info.surface}
        className="rounded-2xl"
      />
      <StatCard
        label="Volumes"
        value={volumeCount}
        icon={FolderIcon}
        iconColor={theme.text.success}
        iconBg={theme.intent.success.surface}
        className="rounded-2xl"
      />
    </div>
  );
};
