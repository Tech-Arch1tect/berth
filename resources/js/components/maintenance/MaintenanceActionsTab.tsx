import React from 'react';
import { cn } from '../../utils/cn';
import { theme } from '../../theme';
import { formatBytes } from '../../utils/formatters';
import {
  TrashIcon,
  InformationCircleIcon,
  CheckCircleIcon,
  CloudIcon,
  DocumentDuplicateIcon,
  CircleStackIcon,
  FolderIcon,
  GlobeAltIcon,
  CubeIcon,
  WrenchIcon,
} from '@heroicons/react/24/outline';
import type { MaintenanceInfo } from '../../api/generated/models';

type PruneType = 'images' | 'containers' | 'volumes' | 'networks' | 'build-cache' | 'system';

interface MaintenanceActionsTabProps {
  maintenanceInfo: MaintenanceInfo | undefined;
  selectedPruneType: PruneType;
  pruneAll: boolean;
  isPruning: boolean;
  isLoading: boolean;
  onPruneTypeChange: (type: PruneType) => void;
  onPruneAllChange: (pruneAll: boolean) => void;
  onStartPrune: () => void;
  onRefresh: () => void;
}

export const MaintenanceActionsTab: React.FC<MaintenanceActionsTabProps> = ({
  maintenanceInfo,
  selectedPruneType,
  pruneAll,
  isPruning,
  isLoading,
  onPruneTypeChange,
  onPruneAllChange,
  onStartPrune,
  onRefresh,
}) => {
  const getPruneIcon = (type: PruneType) => {
    const icons = {
      images: DocumentDuplicateIcon,
      containers: CircleStackIcon,
      volumes: FolderIcon,
      networks: GlobeAltIcon,
      'build-cache': CubeIcon,
      system: WrenchIcon,
    };
    return icons[type];
  };

  const getPruneDescription = (type: PruneType): string => {
    const descriptions = {
      images: pruneAll
        ? 'Remove all unused images (not just dangling)'
        : 'Remove dangling images only',
      containers: 'Remove all stopped containers',
      volumes: pruneAll
        ? 'Remove all unused volumes (including named volumes)'
        : 'Remove dangling volumes only (anonymous volumes)',
      networks: 'Remove all unused networks',
      'build-cache': pruneAll
        ? 'Remove all build cache entries'
        : 'Remove unused build cache entries only',
      system: 'Remove all unused containers, networks, images, and optionally volumes',
    };
    return descriptions[type];
  };

  const getPruneStats = (type: PruneType) => {
    if (!maintenanceInfo) return null;

    const stats = {
      images: {
        total: maintenanceInfo.image_summary.total_count,
        problematic:
          maintenanceInfo.image_summary.dangling_count + maintenanceInfo.image_summary.unused_count,
        size:
          maintenanceInfo.image_summary.dangling_size + maintenanceInfo.image_summary.unused_size,
      },
      containers: {
        total: maintenanceInfo.container_summary.total_count,
        problematic: maintenanceInfo.container_summary.stopped_count,
        size: 0,
      },
      volumes: {
        total: maintenanceInfo.volume_summary.total_count,
        problematic: maintenanceInfo.volume_summary.unused_count,
        size: maintenanceInfo.volume_summary.unused_size,
      },
      networks: {
        total: maintenanceInfo.network_summary.total_count,
        problematic: maintenanceInfo.network_summary.unused_count,
        size: 0,
      },
      'build-cache': {
        total: maintenanceInfo.build_cache_summary.total_count,
        problematic: maintenanceInfo.build_cache_summary.cache.filter((c) => !c.in_use).length,
        size: maintenanceInfo.build_cache_summary.total_size,
      },
      system: {
        total:
          maintenanceInfo.image_summary.total_count +
          maintenanceInfo.container_summary.total_count +
          maintenanceInfo.volume_summary.total_count +
          maintenanceInfo.network_summary.total_count,
        problematic:
          maintenanceInfo.image_summary.dangling_count +
          maintenanceInfo.image_summary.unused_count +
          maintenanceInfo.container_summary.stopped_count +
          maintenanceInfo.volume_summary.unused_count +
          maintenanceInfo.network_summary.unused_count,
        size: maintenanceInfo.disk_usage.total_size,
      },
    };
    return stats[type];
  };

  return (
    <div className="space-y-6">
      {/* Cleanup Type Selection */}
      <div
        className={cn(
          theme.containers.panel,
          'p-6 rounded-lg shadow-sm border',
          theme.cards.sectionDivider
        )}
      >
        <h3 className={cn('text-lg font-medium mb-6 flex items-center', theme.text.strong)}>
          <TrashIcon className="h-5 w-5 text-red-600 mr-2" />
          Docker Cleanup Actions
        </h3>

        {/* Cleanup Type Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
          {[
            {
              type: 'images' as const,
              name: 'Images',
              description: 'Remove unused Docker images',
            },
            {
              type: 'containers' as const,
              name: 'Containers',
              description: 'Remove stopped containers',
            },
            {
              type: 'volumes' as const,
              name: 'Volumes',
              description: 'Remove unused volumes',
            },
            {
              type: 'networks' as const,
              name: 'Networks',
              description: 'Remove unused networks',
            },
            {
              type: 'build-cache' as const,
              name: 'Build Cache',
              description: 'Remove build cache entries',
            },
            {
              type: 'system' as const,
              name: 'System',
              description: 'Full system cleanup',
            },
          ].map(({ type, name, description }) => {
            const Icon = getPruneIcon(type);
            const stats = getPruneStats(type);
            const isSelected = selectedPruneType === type;

            return (
              <div
                key={type}
                onClick={() => onPruneTypeChange(type)}
                className={cn(
                  'p-4 rounded-lg border-2 cursor-pointer transition-all duration-200',
                  isSelected
                    ? cn(theme.selection.tile.selected, 'border-2')
                    : cn(theme.selection.tile.unselected, 'border-2', theme.containers.panel)
                )}
              >
                <div className="flex items-start space-x-3">
                  <Icon
                    className={cn('h-6 w-6 mt-1', isSelected ? theme.text.info : theme.text.muted)}
                  />
                  <div className="flex-1 min-w-0">
                    <h4
                      className={cn(
                        'font-medium',
                        isSelected ? theme.intent.info.textStrong : theme.text.strong
                      )}
                    >
                      {name}
                    </h4>
                    <p className={cn('text-sm mt-1', theme.text.muted)}>{description}</p>
                    {stats && (
                      <div className="mt-2 text-xs space-y-1">
                        <div className="flex justify-between">
                          <span className={cn(theme.text.muted)}>Total:</span>
                          <span className="font-medium text-gray-700 dark:text-slate-300">
                            {stats.total}
                          </span>
                        </div>
                        {stats.problematic > 0 && (
                          <div className="flex justify-between">
                            <span className={theme.text.warning}>To Clean:</span>
                            <span className={cn('font-medium', theme.text.warning)}>
                              {stats.problematic}
                            </span>
                          </div>
                        )}
                        {stats.size > 0 && (
                          <div className="flex justify-between">
                            <span className={cn(theme.text.muted)}>Size:</span>
                            <span className="font-medium text-gray-700 dark:text-slate-300">
                              {formatBytes(stats.size)}
                            </span>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                  {isSelected && <CheckCircleIcon className={cn('h-5 w-5', theme.text.info)} />}
                </div>
              </div>
            );
          })}
        </div>

        {/* Options */}
        {(selectedPruneType === 'images' ||
          selectedPruneType === 'volumes' ||
          selectedPruneType === 'build-cache') && (
          <div className="mb-6 p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
            <div className="flex items-center">
              <input
                id="prune-all"
                type="checkbox"
                checked={pruneAll}
                onChange={(e) => onPruneAllChange(e.target.checked)}
                className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700"
                disabled={isPruning}
              />
              <label htmlFor="prune-all" className={cn('ml-2 block text-sm', theme.text.strong)}>
                {selectedPruneType === 'images'
                  ? 'Remove all unused images (not just dangling)'
                  : selectedPruneType === 'volumes'
                    ? 'Remove all unused volumes (including named volumes)'
                    : 'Remove all build cache entries (not just unused)'}
              </label>
            </div>
          </div>
        )}

        {/* Description */}
        <div className={cn('mb-6 p-4 rounded-lg', theme.intent.info.surface)}>
          <div className="flex items-start space-x-3">
            <InformationCircleIcon className={cn('h-5 w-5 mt-0.5', theme.text.info)} />
            <div>
              <p className={cn('text-sm font-medium mb-1', theme.intent.info.textStrong)}>
                {selectedPruneType.charAt(0).toUpperCase() + selectedPruneType.slice(1)} Cleanup
              </p>
              <p className={cn('text-sm', theme.intent.info.textMuted)}>
                {getPruneDescription(selectedPruneType)}
              </p>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row gap-3">
          <button
            onClick={onStartPrune}
            disabled={isPruning}
            className="flex-1 px-6 py-3 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center transition-colors"
          >
            {isPruning ? (
              <>
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-3"></div>
                Cleaning...
              </>
            ) : (
              <>
                <TrashIcon className="h-5 w-5 mr-3" />
                Start {selectedPruneType.charAt(0).toUpperCase() + selectedPruneType.slice(1)}{' '}
                Cleanup
              </>
            )}
          </button>

          <button
            onClick={onRefresh}
            disabled={isLoading || isPruning}
            className="px-6 py-3 bg-gray-600 dark:bg-gray-600 text-white rounded-lg hover:bg-gray-700 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center transition-colors"
          >
            <CloudIcon className="h-5 w-5 mr-2" />
            Refresh Data
          </button>
        </div>
      </div>

      {/* Quick Stats */}
      <div
        className={cn(
          theme.containers.panel,
          'p-6 rounded-lg shadow-sm border',
          theme.cards.sectionDivider
        )}
      >
        <h4 className={cn('text-md font-medium mb-4', theme.text.strong)}>System Overview</h4>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="text-center">
            <div className={cn('text-2xl font-bold', theme.text.info)}>
              {maintenanceInfo?.image_summary.total_count || 0}
            </div>
            <div className={cn('text-sm', theme.text.muted)}>Images</div>
          </div>
          <div className="text-center">
            <div className={cn('text-2xl font-bold', theme.text.success)}>
              {maintenanceInfo?.container_summary.total_count || 0}
            </div>
            <div className={cn('text-sm', theme.text.muted)}>Containers</div>
          </div>
          <div className="text-center">
            <div className={cn('text-2xl font-bold', theme.text.info)}>
              {maintenanceInfo?.volume_summary.total_count || 0}
            </div>
            <div className={cn('text-sm', theme.text.muted)}>Volumes</div>
          </div>
          <div className="text-center">
            <div className={cn('text-2xl font-bold', theme.text.info)}>
              {maintenanceInfo?.network_summary.total_count || 0}
            </div>
            <div className={cn('text-sm', theme.text.muted)}>Networks</div>
          </div>
        </div>
      </div>
    </div>
  );
};
