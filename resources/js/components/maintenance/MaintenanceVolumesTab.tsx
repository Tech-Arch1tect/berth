import React from 'react';
import { cn } from '../../utils/cn';
import { theme } from '../../theme';
import { Table } from '../common/Table';
import { formatBytes, formatDate } from '../../utils/formatters';
import { getResourceStatusBadge } from '../../utils/statusHelpers';
import { FolderIcon, TrashIcon } from '@heroicons/react/24/outline';
import { VolumeInfo, DeleteRequest } from '../../hooks/useDockerMaintenance';

interface MaintenanceVolumesTabProps {
  volumes: VolumeInfo[];
  onDelete: (deleteRequest: { type: DeleteRequest['type']; id: string; name?: string }) => void;
  isDeleting: boolean;
}

export const MaintenanceVolumesTab: React.FC<MaintenanceVolumesTabProps> = ({
  volumes,
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
          <FolderIcon className={cn('h-5 w-5 mr-2', theme.text.info)} />
          Docker Volumes ({volumes.length})
        </h3>
      </div>
      <Table<VolumeInfo>
        data={volumes}
        keyExtractor={(volume) => volume.name}
        emptyMessage="No Docker volumes found"
        columns={[
          {
            key: 'name',
            header: 'Name',
            render: (volume) => (
              <span className={cn('text-sm font-medium', theme.text.strong)}>{volume.name}</span>
            ),
          },
          {
            key: 'driver',
            header: 'Driver',
            render: (volume) => (
              <span className={cn('text-sm', theme.text.muted)}>{volume.driver}</span>
            ),
          },
          {
            key: 'mountpoint',
            header: 'Mountpoint',
            render: (volume) => (
              <span className={cn('text-sm max-w-xs truncate', theme.text.muted)}>
                {volume.mountpoint}
              </span>
            ),
          },
          {
            key: 'size',
            header: 'Size',
            render: (volume) => (
              <span className={cn('text-sm', theme.text.muted)}>{formatBytes(volume.size)}</span>
            ),
          },
          {
            key: 'created',
            header: 'Created',
            render: (volume) => (
              <span className={cn('text-sm', theme.text.muted)}>{formatDate(volume.created)}</span>
            ),
          },
          {
            key: 'status',
            header: 'Status',
            render: (volume) => getStatusBadge('active', volume.unused),
          },
          {
            key: 'actions',
            header: 'Actions',
            render: (volume) => (
              <button
                onClick={() =>
                  onDelete({
                    type: 'volume',
                    id: volume.name,
                    name: volume.name,
                  })
                }
                className={cn(theme.text.danger, 'hover:opacity-75')}
                disabled={isDeleting}
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
