import React from 'react';
import { cn } from '../../../shared/utils/cn';
import { theme } from '../../../shared/theme';
import { Table } from '../../../shared/components/Table';
import { formatBytes, formatDate } from '../../../shared/utils/formatters';
import { getResourceStatusBadge } from '../../stacks/utils/statusHelpers';
import { FolderIcon, TrashIcon } from '@heroicons/react/24/outline';
import type { VolumeInfo } from '../../../api/generated/models';

type DeleteResourceType = 'image' | 'container' | 'volume' | 'network';

interface MaintenanceVolumesTabProps {
  volumes: VolumeInfo[];
  onDelete: (deleteRequest: { type: DeleteResourceType; id: string; name?: string }) => void;
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

  const deleteButton = (volume: VolumeInfo) => (
    <button
      onClick={() =>
        onDelete({
          type: 'volume',
          id: volume.name,
          name: volume.name,
        })
      }
      aria-label={`Delete volume ${volume.name}`}
      className={cn(
        'flex h-11 w-11 items-center justify-center rounded-lg transition-colors',
        theme.text.danger,
        'hover:bg-rose-50 dark:hover:bg-rose-900/20',
        'disabled:cursor-not-allowed disabled:opacity-50'
      )}
      disabled={isDeleting}
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
            render: (volume) => deleteButton(volume),
          },
        ]}
        renderCard={(volume) => (
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0 flex-1 space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <p className={cn('truncate text-sm font-medium', theme.text.strong)}>
                  {volume.name}
                </p>
                {getStatusBadge('active', volume.unused)}
              </div>
              <p className={cn('truncate font-mono text-xs', theme.text.muted)}>
                {volume.mountpoint}
              </p>
              <p className={cn('flex flex-wrap items-center gap-x-2 text-xs', theme.text.muted)}>
                <span>{volume.driver}</span>
                <span>·</span>
                <span>{formatBytes(volume.size)}</span>
                <span>·</span>
                <span>{formatDate(volume.created)}</span>
              </p>
            </div>
            {deleteButton(volume)}
          </div>
        )}
      />
    </div>
  );
};
