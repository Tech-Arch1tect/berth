import type { FC } from 'react';
import {
  DocumentDuplicateIcon,
  CircleStackIcon,
  FolderIcon,
  GlobeAltIcon,
  ChartBarIcon,
  TrashIcon,
} from '@heroicons/react/24/outline';
import { cn } from '../../../utils/cn';
import { theme } from '../../../theme';
import { formatBytes } from '../../../utils/formatters';

interface MaintenanceSidebarProps {
  activeTab: string;
  onTabChange: (tabId: string) => void;
  summary?: {
    totalImages: number;
    totalContainers: number;
    totalVolumes: number;
    totalNetworks: number;
    spaceUsed: number;
  };
}

export const MaintenanceSidebar: FC<MaintenanceSidebarProps> = ({
  activeTab,
  onTabChange,
  summary,
}) => {
  const tabs = [
    { id: 'overview', label: 'Overview', icon: ChartBarIcon },
    { id: 'images', label: 'Images', icon: DocumentDuplicateIcon, count: summary?.totalImages },
    {
      id: 'containers',
      label: 'Containers',
      icon: CircleStackIcon,
      count: summary?.totalContainers,
    },
    { id: 'volumes', label: 'Volumes', icon: FolderIcon, count: summary?.totalVolumes },
    { id: 'networks', label: 'Networks', icon: GlobeAltIcon, count: summary?.totalNetworks },
    { id: 'actions', label: 'Cleanup', icon: TrashIcon },
  ];

  return (
    <div className="space-y-6">
      {/* Summary Section */}
      {summary && (
        <div>
          <h3 className={cn('text-sm font-semibold mb-3', theme.text.strong)}>Summary</h3>
          <div className="space-y-2">
            <div
              className={cn(
                'flex items-center justify-between py-2 px-3 rounded-lg',
                theme.surface.subtle
              )}
            >
              <span className={cn('text-sm', theme.text.standard)}>Space Used</span>
              <span className={cn('text-sm font-semibold', theme.text.strong)}>
                {formatBytes(summary.spaceUsed)}
              </span>
            </div>
            <div
              className={cn(
                'flex items-center justify-between py-2 px-3 rounded-lg',
                theme.surface.subtle
              )}
            >
              <span className={cn('text-sm', theme.text.standard)}>Images</span>
              <span className={cn('text-sm font-semibold', theme.text.strong)}>
                {summary.totalImages}
              </span>
            </div>
            <div
              className={cn(
                'flex items-center justify-between py-2 px-3 rounded-lg',
                theme.surface.subtle
              )}
            >
              <span className={cn('text-sm', theme.text.standard)}>Containers</span>
              <span className={cn('text-sm font-semibold', theme.text.strong)}>
                {summary.totalContainers}
              </span>
            </div>
            <div
              className={cn(
                'flex items-center justify-between py-2 px-3 rounded-lg',
                theme.surface.subtle
              )}
            >
              <span className={cn('text-sm', theme.text.standard)}>Volumes</span>
              <span className={cn('text-sm font-semibold', theme.text.strong)}>
                {summary.totalVolumes}
              </span>
            </div>
            <div
              className={cn(
                'flex items-center justify-between py-2 px-3 rounded-lg',
                theme.surface.subtle
              )}
            >
              <span className={cn('text-sm', theme.text.standard)}>Networks</span>
              <span className={cn('text-sm font-semibold', theme.text.strong)}>
                {summary.totalNetworks}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Navigation Section */}
      <div>
        <h3 className={cn('text-sm font-semibold mb-3', theme.text.strong)}>Navigation</h3>
        <div className="space-y-1">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;

            return (
              <button
                key={tab.id}
                onClick={() => onTabChange(tab.id)}
                className={cn(
                  'w-full flex items-center justify-between py-2 px-3 rounded-lg transition-colors',
                  isActive
                    ? 'bg-teal-50 text-teal-700 dark:bg-teal-900/20 dark:text-teal-300'
                    : cn('hover:bg-slate-100 dark:hover:bg-slate-800', theme.text.standard)
                )}
              >
                <div className="flex items-center space-x-2">
                  <Icon className="w-4 h-4 flex-shrink-0" />
                  <span className="text-sm font-medium">{tab.label}</span>
                </div>
                {tab.count !== undefined && (
                  <span
                    className={cn(
                      'text-xs font-semibold',
                      isActive ? 'text-teal-700 dark:text-teal-300' : theme.text.muted
                    )}
                  >
                    {tab.count}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};
