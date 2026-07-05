import React from 'react';
import { cn } from '../../../shared/utils/cn';
import { theme } from '../../../shared/theme';
import { Table } from '../../../shared/components/Table';
import { formatDate } from '../../../shared/utils/formatters';
import { getResourceStatusBadge } from '../../stacks/utils/statusHelpers';
import { GlobeAltIcon, TrashIcon } from '@heroicons/react/24/outline';
import type { NetworkInfo } from '../../../api/generated/models';

type DeleteResourceType = 'image' | 'container' | 'volume' | 'network';

interface MaintenanceNetworksTabProps {
  networks: NetworkInfo[];
  onDelete: (deleteRequest: { type: DeleteResourceType; id: string; name?: string }) => void;
  isDeleting: boolean;
}

export const MaintenanceNetworksTab: React.FC<MaintenanceNetworksTabProps> = ({
  networks,
  onDelete,
  isDeleting,
}) => {
  const getStatusBadge = (status: string, isUnused?: boolean) => {
    const badgeInfo = getResourceStatusBadge(status, isUnused);
    return <span className={badgeInfo.className}>{badgeInfo.label}</span>;
  };

  const deleteButton = (network: NetworkInfo) => (
    <button
      onClick={() =>
        onDelete({
          type: 'network',
          id: network.id,
          name: network.name,
        })
      }
      aria-label={`Delete network ${network.name}`}
      className={cn(
        'flex h-11 w-11 items-center justify-center rounded-lg transition-colors',
        theme.text.danger,
        'hover:bg-rose-50 dark:hover:bg-rose-900/20',
        'disabled:cursor-not-allowed disabled:opacity-50'
      )}
      disabled={isDeleting || ['bridge', 'host', 'none'].includes(network.name)}
    >
      <TrashIcon className="h-4 w-4" />
    </button>
  );

  return (
    <div
      className={cn(
        theme.containers.panel,
        'rounded-lg shadow-sm border',
        theme.cards.sectionDivider,
        'overflow-hidden'
      )}
    >
      <div className={cn('px-6 py-4 border-b', theme.cards.sectionDivider)}>
        <h3 className={cn('text-lg font-medium flex items-center', theme.text.strong)}>
          <GlobeAltIcon className={cn('h-5 w-5 mr-2', theme.text.info)} />
          Docker Networks ({networks.length})
        </h3>
      </div>
      <Table<NetworkInfo>
        data={networks}
        keyExtractor={(network) => network.id}
        emptyMessage="No Docker networks found"
        columns={[
          {
            key: 'name',
            header: 'Name',
            render: (network) => (
              <span className={cn('text-sm font-medium', theme.text.strong)}>
                {network.name}
                {network.internal && (
                  <span
                    className={cn(
                      'ml-2 inline-flex items-center px-2 py-1 rounded-full text-xs font-medium',
                      theme.badges.tag.info
                    )}
                  >
                    Internal
                  </span>
                )}
              </span>
            ),
          },
          {
            key: 'id',
            header: 'Network ID',
            render: (network) => (
              <span className={cn('text-sm font-mono', theme.text.muted)}>
                {network.id.substring(0, 12)}
              </span>
            ),
          },
          {
            key: 'driver',
            header: 'Driver',
            render: (network) => (
              <span className={cn('text-sm', theme.text.muted)}>{network.driver}</span>
            ),
          },
          {
            key: 'scope',
            header: 'Scope',
            render: (network) => (
              <span className={cn('text-sm', theme.text.muted)}>{network.scope}</span>
            ),
          },
          {
            key: 'subnet',
            header: 'Subnet',
            render: (network) => (
              <span className={cn('text-sm font-mono', theme.text.muted)}>
                {network.subnet || 'N/A'}
              </span>
            ),
          },
          {
            key: 'created',
            header: 'Created',
            render: (network) => (
              <span className={cn('text-sm', theme.text.muted)}>{formatDate(network.created)}</span>
            ),
          },
          {
            key: 'status',
            header: 'Status',
            render: (network) => getStatusBadge('active', network.unused),
          },
          {
            key: 'actions',
            header: 'Actions',
            render: (network) => deleteButton(network),
          },
        ]}
        renderCard={(network) => (
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0 flex-1 space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <p className={cn('truncate text-sm font-medium', theme.text.strong)}>
                  {network.name}
                </p>
                {network.internal && (
                  <span
                    className={cn(
                      'inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium',
                      theme.badges.tag.info
                    )}
                  >
                    Internal
                  </span>
                )}
                {getStatusBadge('active', network.unused)}
              </div>
              <p className={cn('flex flex-wrap items-center gap-x-2 text-xs', theme.text.muted)}>
                <span className="font-mono">{network.id.substring(0, 12)}</span>
                <span>·</span>
                <span>{network.driver}</span>
                <span>·</span>
                <span>{network.scope}</span>
                {network.subnet && (
                  <>
                    <span>·</span>
                    <span className="font-mono">{network.subnet}</span>
                  </>
                )}
              </p>
              <p className={cn('text-xs', theme.text.muted)}>{formatDate(network.created)}</p>
            </div>
            {deleteButton(network)}
          </div>
        )}
      />
    </div>
  );
};
