import React from 'react';
import { cn } from '../../utils/cn';
import { theme } from '../../theme';
import { Table } from '../common/Table';
import { formatBytes, formatDate } from '../../utils/formatters';
import { getResourceStatusBadge } from '../../utils/statusHelpers';
import { DocumentDuplicateIcon, TrashIcon } from '@heroicons/react/24/outline';
import { ImageInfo, DeleteRequest } from '../../hooks/useDockerMaintenance';

interface MaintenanceImagesTabProps {
  images: ImageInfo[];
  onDelete: (deleteRequest: { type: DeleteRequest['type']; id: string; name?: string }) => void;
  isDeleting: boolean;
}

export const MaintenanceImagesTab: React.FC<MaintenanceImagesTabProps> = ({
  images,
  onDelete,
  isDeleting,
}) => {
  const getStatusBadge = (status: string, isUnused?: boolean, isDangling?: boolean) => {
    const badgeInfo = getResourceStatusBadge(status, isUnused, isDangling);
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
          <DocumentDuplicateIcon className={cn('h-5 w-5 mr-2', theme.text.info)} />
          Docker Images ({images.length})
        </h3>
      </div>
      <Table<ImageInfo>
        data={images}
        keyExtractor={(image) => image.id}
        emptyMessage="No Docker images found"
        columns={[
          {
            key: 'repository',
            header: 'Repository',
            render: (image) => (
              <span className={cn('text-sm font-medium', theme.text.strong)}>
                {image.repository || '<none>'}
              </span>
            ),
          },
          {
            key: 'tag',
            header: 'Tag',
            render: (image) => (
              <span className={cn('text-sm', theme.text.muted)}>{image.tag || '<none>'}</span>
            ),
          },
          {
            key: 'id',
            header: 'Image ID',
            render: (image) => (
              <span className={cn('text-sm font-mono', theme.text.muted)}>
                {image.id.substring(0, 12)}
              </span>
            ),
          },
          {
            key: 'size',
            header: 'Size',
            render: (image) => (
              <span className={cn('text-sm', theme.text.muted)}>{formatBytes(image.size)}</span>
            ),
          },
          {
            key: 'created',
            header: 'Created',
            render: (image) => (
              <span className={cn('text-sm', theme.text.muted)}>{formatDate(image.created)}</span>
            ),
          },
          {
            key: 'status',
            header: 'Status',
            render: (image) => getStatusBadge('active', image.unused, image.dangling),
          },
          {
            key: 'actions',
            header: 'Actions',
            render: (image) => (
              <button
                onClick={() =>
                  onDelete({
                    type: 'image',
                    id: image.id,
                    name: `${image.repository}:${image.tag}`,
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
