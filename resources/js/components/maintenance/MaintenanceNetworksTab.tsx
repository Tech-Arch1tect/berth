import React from 'react';
import { cn } from '../../utils/cn';
import { theme } from '../../theme';
import { Table } from '../common/Table';
import { formatDate } from '../../utils/formatters';
import { getResourceStatusBadge } from '../../utils/statusHelpers';
import { GlobeAltIcon, TrashIcon } from '@heroicons/react/24/outline';
import type { NetworkInfo } from '../../api/generated/models';

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
            render: (network) => (
              <button
                onClick={() =>
                  onDelete({
                    type: 'network',
                    id: network.id,
                    name: network.name,
                  })
                }
                className={cn(theme.text.danger, 'hover:opacity-75')}
                disabled={isDeleting || ['bridge', 'host', 'none'].includes(network.name)}
              >
                <TrashIcon className="h-4 w-4" />
              </button>
            ),
          },
        ]}
      />
    </div>
  );
};
