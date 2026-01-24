import React from 'react';
import { cn } from '../../utils/cn';
import { theme } from '../../theme';
import { Table } from '../common/Table';
import { formatBytes } from '../../utils/formatters';
import { getContainerStatusBadge } from '../../utils/statusHelpers';
import { CircleStackIcon, TrashIcon } from '@heroicons/react/24/outline';
import type { GetApiV1ServersServeridMaintenanceInfo200ContainerSummaryContainersItem } from '../../api/generated/models';

type DeleteResourceType = 'image' | 'container' | 'volume' | 'network';

interface MaintenanceContainersTabProps {
  containers: GetApiV1ServersServeridMaintenanceInfo200ContainerSummaryContainersItem[];
  onDelete: (deleteRequest: { type: DeleteResourceType; id: string; name?: string }) => void;
  isDeleting: boolean;
}

export const MaintenanceContainersTab: React.FC<MaintenanceContainersTabProps> = ({
  containers,
  onDelete,
  isDeleting,
}) => {
  const getStatusBadge = (status: string) => {
    const badgeInfo = getContainerStatusBadge(status);
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
          <CircleStackIcon className="h-5 w-5 text-green-600 mr-2" />
          Docker Containers ({containers.length})
        </h3>
      </div>
      <Table<GetApiV1ServersServeridMaintenanceInfo200ContainerSummaryContainersItem>
        data={containers}
        keyExtractor={(container) => container.id}
        emptyMessage="No Docker containers found"
        columns={[
          {
            key: 'name',
            header: 'Name',
            render: (container) => (
              <span className={cn('text-sm font-medium', theme.text.strong)}>{container.name}</span>
            ),
          },
          {
            key: 'id',
            header: 'Container ID',
            render: (container) => (
              <span className={cn('text-sm font-mono', theme.text.muted)}>
                {container.id.substring(0, 12)}
              </span>
            ),
          },
          {
            key: 'image',
            header: 'Image',
            render: (container) => (
              <span className={cn('text-sm', theme.text.muted)}>{container.image}</span>
            ),
          },
          {
            key: 'state',
            header: 'State',
            render: (container) => getStatusBadge(container.state),
          },
          {
            key: 'status',
            header: 'Status',
            render: (container) => (
              <span className={cn('text-sm', theme.text.muted)}>{container.status}</span>
            ),
          },
          {
            key: 'size',
            header: 'Size',
            render: (container) => (
              <span className={cn('text-sm', theme.text.muted)}>{formatBytes(container.size)}</span>
            ),
          },
          {
            key: 'actions',
            header: 'Actions',
            render: (container) => (
              <button
                onClick={() =>
                  onDelete({
                    type: 'container',
                    id: container.id,
                    name: container.name,
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
