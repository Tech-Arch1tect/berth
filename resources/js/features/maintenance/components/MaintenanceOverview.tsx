import React from 'react';
import { cn } from '../../../shared/utils/cn';
import { theme } from '../../../shared/theme';
import { StatCard } from '../../../shared/components/StatCard';
import { formatBytes } from '../../../shared/utils/formatters';
import {
  ServerIcon,
  DocumentDuplicateIcon,
  CircleStackIcon,
  FolderIcon,
  GlobeAltIcon,
  CubeIcon,
  ChartBarIcon,
} from '@heroicons/react/24/outline';
import type { MaintenanceInfo } from '../../../api/generated/models';
import { totalDiskUsage } from '../pruneModes';

interface MaintenanceOverviewProps {
  maintenanceInfo: MaintenanceInfo;
}

const systemFacts = (info: MaintenanceInfo): Array<{ label: string; value: string }> => [
  { label: 'Docker Version', value: info.system_info.version },
  { label: 'API Version', value: info.system_info.api_version },
  { label: 'Storage Driver', value: info.system_info.storage_driver },
  { label: 'Architecture', value: info.system_info.architecture },
  { label: 'Operating System', value: info.system_info.os },
  { label: 'Kernel Version', value: info.system_info.kernel_version },
  { label: 'CPU Cores', value: String(info.system_info.ncpu) },
  { label: 'Total Memory', value: formatBytes(info.system_info.total_memory) },
  { label: 'Docker Root Directory', value: info.system_info.docker_root_dir },
];

export const MaintenanceOverview: React.FC<MaintenanceOverviewProps> = ({ maintenanceInfo }) => {
  const images = maintenanceInfo.image_summary;
  const containers = maintenanceInfo.container_summary;
  const volumes = maintenanceInfo.volume_summary;
  const networks = maintenanceInfo.network_summary;
  const buildCache = maintenanceInfo.build_cache_summary;

  const storage = [
    { label: 'Images', value: images.total.size, color: theme.text.info },
    { label: 'Containers', value: containers.total.size, color: theme.text.success },
    { label: 'Volumes', value: volumes.total.size, color: theme.text.info },
    { label: 'Build Cache', value: buildCache.total.size, color: theme.text.warning },
  ];

  return (
    <>
      <div className="mb-8 grid grid-cols-1 gap-6 md:grid-cols-2">
        <StatCard
          label="Total Docker disk usage"
          value={formatBytes(totalDiskUsage(maintenanceInfo))}
          icon={ChartBarIcon}
          iconColor={theme.text.info}
          iconBg={theme.intent.info.surface}
        />
        <StatCard
          label="Build cache records"
          value={buildCache.total.count}
          icon={CubeIcon}
          iconColor={theme.text.warning}
          iconBg={theme.intent.warning.surface}
          subtext={formatBytes(buildCache.total.size)}
          subtextColor={theme.text.warning}
        />
      </div>

      <div className="mb-8 grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Images"
          value={images.total.count}
          icon={DocumentDuplicateIcon}
          iconColor={theme.text.info}
          iconBg={theme.intent.info.surface}
          subtext={images.unused_count > 0 ? `${images.unused_count} unused` : undefined}
          subtextColor={theme.text.danger}
        />
        <StatCard
          label="Containers"
          value={containers.total.count}
          icon={CircleStackIcon}
          iconColor={theme.text.success}
          iconBg={theme.intent.success.surface}
          subtext={`${containers.running_count} running`}
          subtextColor={theme.text.success}
        />
        <StatCard
          label="Volumes"
          value={volumes.total.count}
          icon={FolderIcon}
          iconColor={theme.text.info}
          iconBg={theme.intent.info.surface}
          subtext={
            volumes.unused.count > 0
              ? `${volumes.unused.count} unused · ${formatBytes(volumes.unused.size)}`
              : undefined
          }
          subtextColor={theme.text.danger}
        />
        <StatCard
          label="Networks"
          value={networks.total_count}
          icon={GlobeAltIcon}
          iconColor={theme.text.info}
          iconBg={theme.intent.info.surface}
          subtext={networks.unused_count > 0 ? `${networks.unused_count} unused` : undefined}
          subtextColor={theme.text.danger}
        />
      </div>

      <div
        className={cn(
          theme.containers.panel,
          'mb-8 rounded-lg border p-6 shadow-sm',
          theme.cards.sectionDivider
        )}
      >
        <h3 className={cn('mb-4 flex items-center text-lg font-medium', theme.text.strong)}>
          <ChartBarIcon className={cn('mr-2 h-5 w-5', theme.text.info)} />
          Where the space goes
        </h3>
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          {storage.map(({ label, value, color }) => (
            <div key={label} className="text-center">
              <div className={cn('text-2xl font-bold', color)}>{formatBytes(value)}</div>
              <div className={cn('text-sm', theme.text.muted)}>{label}</div>
            </div>
          ))}
        </div>
      </div>

      <div
        className={cn(
          theme.containers.panel,
          'rounded-lg border shadow-sm',
          theme.cards.sectionDivider
        )}
      >
        <div className={cn('border-b px-6 py-4', theme.cards.sectionDivider)}>
          <h3 className={cn('flex items-center text-lg font-medium', theme.text.strong)}>
            <ServerIcon className={cn('mr-2 h-5 w-5', theme.text.info)} />
            Docker Engine
          </h3>
        </div>
        <dl className="grid grid-cols-1 gap-6 p-6 md:grid-cols-2 lg:grid-cols-3">
          {systemFacts(maintenanceInfo).map(({ label, value }) => (
            <div key={label}>
              <dt className={cn('text-sm font-medium', theme.text.muted)}>{label}</dt>
              <dd className={cn('break-all font-mono text-sm', theme.text.strong)}>{value}</dd>
            </div>
          ))}
        </dl>
      </div>
    </>
  );
};
