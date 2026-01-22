import React from 'react';
import type { GetApiV1ServersServeridStacksStacknameVolumes200VolumesItem } from '../../../api/generated/models';
import { CircleStackIcon, ServerIcon } from '@heroicons/react/24/outline';
import { cn } from '../../../utils/cn';
import { theme } from '../../../theme';

interface VolumeDetailPanelProps {
  volume: GetApiV1ServersServeridStacksStacknameVolumes200VolumesItem;
}

export const VolumeDetailPanel: React.FC<VolumeDetailPanelProps> = ({ volume }) => {
  const usageCount = volume.used_by?.length || 0;

  return (
    <div className="h-full overflow-auto p-6">
      <div className="max-w-3xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center gap-4">
          <div
            className={cn(
              'w-12 h-12 rounded-lg flex items-center justify-center',
              'bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400'
            )}
          >
            <CircleStackIcon className="w-6 h-6" />
          </div>
          <div>
            <h2 className={cn('text-xl font-bold', theme.text.strong)}>{volume.name}</h2>
            <div className="flex items-center gap-2">
              {volume.exists ? (
                <span className="text-xs px-2 py-0.5 rounded bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400">
                  Active
                </span>
              ) : (
                <span className="text-xs px-2 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 text-zinc-500">
                  Not Created
                </span>
              )}
              {volume.external && (
                <span className="text-xs px-2 py-0.5 rounded bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400">
                  External
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Volume Details */}
        {volume.exists && (
          <div
            className={cn(
              'rounded-lg border p-4',
              'border-zinc-200 dark:border-zinc-800',
              'bg-white dark:bg-zinc-900'
            )}
          >
            <h3 className={cn('text-sm font-semibold mb-3', theme.text.strong)}>Configuration</h3>
            <div className="space-y-2 text-sm">
              {volume.driver && (
                <div className="flex justify-between">
                  <span className={theme.text.muted}>Driver</span>
                  <span className={cn('font-mono', theme.text.strong)}>{volume.driver}</span>
                </div>
              )}
              {volume.scope && (
                <div className="flex justify-between">
                  <span className={theme.text.muted}>Scope</span>
                  <span className={theme.text.strong}>{volume.scope}</span>
                </div>
              )}
              {volume.mountpoint && (
                <div className="flex justify-between">
                  <span className={theme.text.muted}>Mountpoint</span>
                  <span className={cn('font-mono text-xs break-all', theme.text.strong)}>
                    {volume.mountpoint}
                  </span>
                </div>
              )}
              {volume.created && (
                <div className="flex justify-between">
                  <span className={theme.text.muted}>Created</span>
                  <span className={theme.text.strong}>
                    {new Date(volume.created).toLocaleString()}
                  </span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Usage */}
        {volume.used_by && usageCount > 0 && (
          <div
            className={cn(
              'rounded-lg border p-4',
              'border-zinc-200 dark:border-zinc-800',
              'bg-white dark:bg-zinc-900'
            )}
          >
            <h3 className={cn('text-sm font-semibold mb-3', theme.text.strong)}>
              Used By ({usageCount})
            </h3>
            <div className="space-y-3">
              {volume.used_by.map((usage, i) => (
                <div key={i} className="space-y-1">
                  <div className="flex items-center gap-2">
                    <ServerIcon className={cn('w-4 h-4', theme.text.subtle)} />
                    <span className={cn('text-sm font-medium', theme.text.strong)}>
                      {usage.container_name}
                    </span>
                    <span className={cn('text-xs', theme.text.subtle)}>({usage.service_name})</span>
                  </div>
                  {usage.mounts && usage.mounts.length > 0 && (
                    <div className="pl-6 space-y-1">
                      {usage.mounts.map((mount, j) => (
                        <div key={j} className={cn('text-xs font-mono', theme.text.muted)}>
                          → {mount.target}
                          <span
                            className={cn(
                              'ml-2',
                              mount.read_only ? 'text-amber-600' : 'text-emerald-600'
                            )}
                          >
                            {mount.read_only ? 'RO' : 'RW'}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Driver Options */}
        {volume.driver_opts && Object.keys(volume.driver_opts).length > 0 && (
          <div
            className={cn(
              'rounded-lg border p-4',
              'border-zinc-200 dark:border-zinc-800',
              'bg-white dark:bg-zinc-900'
            )}
          >
            <h3 className={cn('text-sm font-semibold mb-3', theme.text.strong)}>Driver Options</h3>
            <div className="space-y-1">
              {Object.entries(volume.driver_opts).map(([key, value]) => (
                <div key={key} className="text-xs font-mono">
                  <span className={theme.text.muted}>{key}</span>
                  <span className={theme.text.subtle}>=</span>
                  <span className={theme.text.strong}>{value}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Labels */}
        {volume.labels && Object.keys(volume.labels).length > 0 && (
          <div
            className={cn(
              'rounded-lg border p-4',
              'border-zinc-200 dark:border-zinc-800',
              'bg-white dark:bg-zinc-900'
            )}
          >
            <h3 className={cn('text-sm font-semibold mb-3', theme.text.strong)}>Labels</h3>
            <div className="space-y-1">
              {Object.entries(volume.labels).map(([key, value]) => (
                <div key={key} className="text-xs font-mono">
                  <span className={theme.text.muted}>{key}</span>
                  <span className={theme.text.subtle}>=</span>
                  <span className={theme.text.strong}>{value}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
