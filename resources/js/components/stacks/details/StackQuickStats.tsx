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
    <div className="grid grid-cols-2 gap-4">
      <StatCard
        label="Services"
        value={serviceCount}
        icon={CircleStackIcon}
        iconColor={theme.text.info}
        iconBg={theme.intent.info.surface}
      />
      <StatCard
        label="Containers"
        value={containerCount}
        icon={ServerIcon}
        iconColor={theme.text.success}
        iconBg={theme.intent.success.surface}
      />
      <StatCard
        label="Networks"
        value={networkCount}
        icon={GlobeAltIcon}
        iconColor={theme.text.info}
        iconBg={theme.intent.info.surface}
      />
      <StatCard
        label="Volumes"
        value={volumeCount}
        icon={FolderIcon}
        iconColor={theme.text.success}
        iconBg={theme.intent.success.surface}
      />
    </div>
  );
};
