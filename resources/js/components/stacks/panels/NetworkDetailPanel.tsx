import React from 'react';
import { Network } from '../../../types/stack';
import { GlobeAltIcon, ServerIcon } from '@heroicons/react/24/outline';
import { cn } from '../../../utils/cn';
import { theme } from '../../../theme';

interface NetworkDetailPanelProps {
  network: Network;
}

export const NetworkDetailPanel: React.FC<NetworkDetailPanelProps> = ({ network }) => {
  const containerCount = network.containers ? Object.keys(network.containers).length : 0;

  return (
    <div className="h-full overflow-auto p-6">
      <div className="max-w-3xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center gap-4">
          <div
            className={cn(
              'w-12 h-12 rounded-lg flex items-center justify-center',
              'bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400'
            )}
          >
            <GlobeAltIcon className="w-6 h-6" />
          </div>
          <div>
            <h2 className={cn('text-xl font-bold', theme.text.strong)}>{network.name}</h2>
            <div className="flex items-center gap-2">
              {network.exists ? (
                <span className="text-xs px-2 py-0.5 rounded bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400">
                  Active
                </span>
              ) : (
                <span className="text-xs px-2 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 text-zinc-500">
                  Not Created
                </span>
              )}
              {network.external && (
                <span className="text-xs px-2 py-0.5 rounded bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400">
                  External
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Network Details */}
        {network.exists && (
          <div
            className={cn(
              'rounded-lg border p-4',
              'border-zinc-200 dark:border-zinc-800',
              'bg-white dark:bg-zinc-900'
            )}
          >
            <h3 className={cn('text-sm font-semibold mb-3', theme.text.strong)}>Configuration</h3>
            <div className="space-y-2 text-sm">
              {network.driver && (
                <div className="flex justify-between">
                  <span className={theme.text.muted}>Driver</span>
                  <span className={cn('font-mono', theme.text.strong)}>{network.driver}</span>
                </div>
              )}
              {network.ipam?.config && network.ipam.config.length > 0 && (
                <>
                  {network.ipam.config[0].subnet && (
                    <div className="flex justify-between">
                      <span className={theme.text.muted}>Subnet</span>
                      <span className={cn('font-mono', theme.text.strong)}>
                        {network.ipam.config[0].subnet}
                      </span>
                    </div>
                  )}
                  {network.ipam.config[0].gateway && (
                    <div className="flex justify-between">
                      <span className={theme.text.muted}>Gateway</span>
                      <span className={cn('font-mono', theme.text.strong)}>
                        {network.ipam.config[0].gateway}
                      </span>
                    </div>
                  )}
                </>
              )}
              {network.created && (
                <div className="flex justify-between">
                  <span className={theme.text.muted}>Created</span>
                  <span className={theme.text.strong}>
                    {new Date(network.created).toLocaleString()}
                  </span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Connected Containers */}
        {network.containers && containerCount > 0 && (
          <div
            className={cn(
              'rounded-lg border p-4',
              'border-zinc-200 dark:border-zinc-800',
              'bg-white dark:bg-zinc-900'
            )}
          >
            <h3 className={cn('text-sm font-semibold mb-3', theme.text.strong)}>
              Connected Containers ({containerCount})
            </h3>
            <div className="space-y-2">
              {Object.entries(network.containers).map(([name, endpoint]) => (
                <div key={name} className="flex items-center justify-between py-1">
                  <div className="flex items-center gap-2">
                    <ServerIcon className={cn('w-4 h-4', theme.text.subtle)} />
                    <span className={cn('text-sm font-medium', theme.text.strong)}>
                      {endpoint.name || name}
                    </span>
                  </div>
                  {endpoint.ipv4_address && (
                    <span
                      className={cn('text-xs font-mono px-2 py-0.5 rounded', theme.surface.code)}
                    >
                      {endpoint.ipv4_address}
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Labels */}
        {network.labels && Object.keys(network.labels).length > 0 && (
          <div
            className={cn(
              'rounded-lg border p-4',
              'border-zinc-200 dark:border-zinc-800',
              'bg-white dark:bg-zinc-900'
            )}
          >
            <h3 className={cn('text-sm font-semibold mb-3', theme.text.strong)}>Labels</h3>
            <div className="space-y-1">
              {Object.entries(network.labels).map(([key, value]) => (
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
