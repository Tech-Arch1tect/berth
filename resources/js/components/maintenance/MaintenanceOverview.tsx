import React from 'react';
import { cn } from '../../utils/cn';
import { theme } from '../../theme';
import { StatCard } from '../common/StatCard';
import { formatBytes, formatNumber } from '../../utils/formatters';
import {
  ServerIcon,
  DocumentDuplicateIcon,
  CircleStackIcon,
  FolderIcon,
  GlobeAltIcon,
  ChartBarIcon,
} from '@heroicons/react/24/outline';
import { useMaintenanceInfo } from '../../hooks/useDockerMaintenance';

interface MaintenanceOverviewProps {
  maintenanceInfo: ReturnType<typeof useMaintenanceInfo>['data'];
}

export const MaintenanceOverview: React.FC<MaintenanceOverviewProps> = ({ maintenanceInfo }) => {
  if (!maintenanceInfo) return null;

  return (
    <>
      {/* System Information */}
      <div className={cn(theme.containers.panel, 'rounded-lg mb-8')}>
        <div className={cn('px-6 py-4', theme.cards.sectionDivider)}>
          <h3 className={cn('text-lg font-medium flex items-center', theme.text.strong)}>
            <ServerIcon className={cn('h-5 w-5 mr-2', theme.text.info)} />
            System Information
          </h3>
        </div>
        <div className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <div className="space-y-3">
              <div>
                <dt className={cn('text-sm font-medium', theme.text.muted)}>Docker Version</dt>
                <dd className={cn('text-sm font-mono', theme.text.strong)}>
                  {maintenanceInfo.system_info.version}
                </dd>
              </div>
              <div>
                <dt className={cn('text-sm font-medium', theme.text.muted)}>API Version</dt>
                <dd className={cn('text-sm font-mono', theme.text.strong)}>
                  {maintenanceInfo.system_info.api_version}
                </dd>
              </div>
              <div>
                <dt className={cn('text-sm font-medium', theme.text.muted)}>Server Version</dt>
                <dd className={cn('text-sm font-mono', theme.text.strong)}>
                  {maintenanceInfo.system_info.server_version}
                </dd>
              </div>
            </div>
            <div className="space-y-3">
              <div>
                <dt className={cn('text-sm font-medium', theme.text.muted)}>Architecture</dt>
                <dd className={cn('text-sm font-mono', theme.text.strong)}>
                  {maintenanceInfo.system_info.architecture}
                </dd>
              </div>
              <div>
                <dt className={cn('text-sm font-medium', theme.text.muted)}>Operating System</dt>
                <dd className={cn('text-sm font-mono', theme.text.strong)}>
                  {maintenanceInfo.system_info.os}
                </dd>
              </div>
              <div>
                <dt className={cn('text-sm font-medium', theme.text.muted)}>Kernel Version</dt>
                <dd className={cn('text-sm font-mono', theme.text.strong)}>
                  {maintenanceInfo.system_info.kernel_version}
                </dd>
              </div>
            </div>
            <div className="space-y-3">
              <div>
                <dt className={cn('text-sm font-medium', theme.text.muted)}>CPU Cores</dt>
                <dd className={cn('text-sm font-mono', theme.text.strong)}>
                  {maintenanceInfo.system_info.ncpu}
                </dd>
              </div>
              <div>
                <dt className={cn('text-sm font-medium', theme.text.muted)}>Total Memory</dt>
                <dd className={cn('text-sm font-mono', theme.text.strong)}>
                  {formatBytes(maintenanceInfo.system_info.total_memory)}
                </dd>
              </div>
              <div>
                <dt className={cn('text-sm font-medium', theme.text.muted)}>Storage Driver</dt>
                <dd className={cn('text-sm font-mono', theme.text.strong)}>
                  {maintenanceInfo.system_info.storage_driver}
                </dd>
              </div>
            </div>
          </div>
          <div className={cn('mt-6 pt-6 border-t', theme.cards.sectionDivider)}>
            <div>
              <dt className={cn('text-sm font-medium', theme.text.muted)}>Docker Root Directory</dt>
              <dd className={cn('text-sm font-mono break-all', theme.text.strong)}>
                {maintenanceInfo.system_info.docker_root_dir}
              </dd>
            </div>
          </div>
        </div>
      </div>

      {/* Resource Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <StatCard
          label="Images"
          value={maintenanceInfo.image_summary.total_count}
          icon={DocumentDuplicateIcon}
          iconColor="text-blue-600 dark:text-blue-400"
          iconBg="bg-blue-100 dark:bg-blue-900/20"
          subtext={
            maintenanceInfo.image_summary.unused_count > 0
              ? `${maintenanceInfo.image_summary.unused_count} unused`
              : undefined
          }
          subtextColor="text-red-600 dark:text-red-400"
        />
        <StatCard
          label="Containers"
          value={maintenanceInfo.container_summary.total_count}
          icon={CircleStackIcon}
          iconColor="text-green-600 dark:text-green-400"
          iconBg="bg-green-100 dark:bg-green-900/20"
          subtext={`${maintenanceInfo.container_summary.running_count} running`}
          subtextColor="text-green-600 dark:text-green-400"
        />
        <StatCard
          label="Volumes"
          value={maintenanceInfo.volume_summary.total_count}
          icon={FolderIcon}
          iconColor="text-purple-600 dark:text-purple-400"
          iconBg="bg-purple-100 dark:bg-purple-900/20"
          subtext={
            maintenanceInfo.volume_summary.unused_count > 0
              ? `${maintenanceInfo.volume_summary.unused_count} unused`
              : undefined
          }
          subtextColor="text-red-600 dark:text-red-400"
        />
        <StatCard
          label="Networks"
          value={maintenanceInfo.network_summary.total_count}
          icon={GlobeAltIcon}
          iconColor="text-indigo-600 dark:text-indigo-400"
          iconBg="bg-indigo-100 dark:bg-indigo-900/20"
          subtext={
            maintenanceInfo.network_summary.unused_count > 0
              ? `${maintenanceInfo.network_summary.unused_count} unused`
              : undefined
          }
          subtextColor="text-red-600 dark:text-red-400"
        />
      </div>

      {/* Disk Usage Breakdown */}
      <div
        className={cn(
          theme.containers.panel,
          'p-6 rounded-lg shadow-sm border',
          theme.cards.sectionDivider,
          'mb-8'
        )}
      >
        <h3 className={cn('text-lg font-medium mb-4 flex items-center', theme.text.strong)}>
          <ChartBarIcon className="h-5 w-5 text-purple-600 mr-2" />
          Detailed Storage Usage
        </h3>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <div className="text-center">
            <div className="text-2xl font-bold text-blue-600">
              {formatBytes(maintenanceInfo.disk_usage.images_size)}
            </div>
            <div className={cn('text-sm', theme.text.muted)}>Images</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-green-600">
              {formatBytes(maintenanceInfo.disk_usage.containers_size)}
            </div>
            <div className={cn('text-sm', theme.text.muted)}>Containers</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-purple-600">
              {formatBytes(maintenanceInfo.disk_usage.volumes_size)}
            </div>
            <div className={cn('text-sm', theme.text.muted)}>Volumes</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-orange-600">
              {formatBytes(maintenanceInfo.disk_usage.layers_size)}
            </div>
            <div className={cn('text-sm', theme.text.muted)}>Layers</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-indigo-600">
              {formatBytes(maintenanceInfo.disk_usage.build_cache_size)}
            </div>
            <div className={cn('text-sm', theme.text.muted)}>Build Cache</div>
          </div>
        </div>
      </div>

      {/* Resource Summary */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div
          className={cn(
            theme.containers.panel,
            'p-6 rounded-lg shadow-sm border',
            theme.cards.sectionDivider
          )}
        >
          <h3 className={cn('text-lg font-medium mb-4 flex items-center', theme.text.strong)}>
            <DocumentDuplicateIcon className="h-5 w-5 text-blue-600 mr-2" />
            Images Summary
          </h3>
          <div className="space-y-3">
            <div className="flex justify-between">
              <span className={cn(theme.text.muted)}>Total Images:</span>
              <span className={cn('font-medium', theme.text.strong)}>
                {formatNumber(maintenanceInfo.image_summary.total_count)}
              </span>
            </div>
            <div className="flex justify-between">
              <span className={cn(theme.text.muted)}>Dangling Images:</span>
              <span className="font-medium text-orange-600">
                {formatNumber(maintenanceInfo.image_summary.dangling_count)} (
                {formatBytes(maintenanceInfo.image_summary.dangling_size)})
              </span>
            </div>
            <div className="flex justify-between">
              <span className={cn(theme.text.muted)}>Unused Images:</span>
              <span className="font-medium text-red-600">
                {formatNumber(maintenanceInfo.image_summary.unused_count)} (
                {formatBytes(maintenanceInfo.image_summary.unused_size)})
              </span>
            </div>
          </div>
        </div>

        <div
          className={cn(
            theme.containers.panel,
            'p-6 rounded-lg shadow-sm border',
            theme.cards.sectionDivider
          )}
        >
          <h3 className={cn('text-lg font-medium mb-4 flex items-center', theme.text.strong)}>
            <CircleStackIcon className="h-5 w-5 text-green-600 mr-2" />
            Container Summary
          </h3>
          <div className="space-y-3">
            <div className="flex justify-between">
              <span className={cn(theme.text.muted)}>Running:</span>
              <span className="font-medium text-green-600">
                {formatNumber(maintenanceInfo.container_summary.running_count)}
              </span>
            </div>
            <div className="flex justify-between">
              <span className={cn(theme.text.muted)}>Stopped:</span>
              <span className="font-medium text-orange-600">
                {formatNumber(maintenanceInfo.container_summary.stopped_count)}
              </span>
            </div>
            <div className="flex justify-between">
              <span className={cn(theme.text.muted)}>Total:</span>
              <span className={cn('font-medium', theme.text.strong)}>
                {formatNumber(maintenanceInfo.container_summary.total_count)}
              </span>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};
