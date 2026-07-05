import React from 'react';
import { cn } from '../../../shared/utils/cn';
import { theme } from '../../../shared/theme';
import { Table } from '../../../shared/components/Table';
import { formatBytes, formatDate } from '../../../shared/utils/formatters';
import { getResourceStatusBadge } from '../../stacks/utils/statusHelpers';
import { DocumentDuplicateIcon, TrashIcon } from '@heroicons/react/24/outline';
import type { ImageInfo } from '../../../api/generated/models';

type DeleteResourceType = 'image' | 'container' | 'volume' | 'network';

interface MaintenanceImagesTabProps {
  images: ImageInfo[];
  onDelete: (deleteRequest: { type: DeleteResourceType; id: string; name?: string }) => void;
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

  const deleteButton = (image: ImageInfo) => (
    <button
      onClick={() =>
        onDelete({
          type: 'image',
          id: image.id,
          name: `${image.repository}:${image.tag}`,
        })
      }
      aria-label={`Delete image ${image.repository}:${image.tag}`}
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
            render: (image) => deleteButton(image),
          },
        ]}
        renderCard={(image) => (
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0 flex-1 space-y-1">
              <p className={cn('truncate text-sm font-medium', theme.text.strong)}>
                {image.repository || '<none>'}:{image.tag || '<none>'}
              </p>
              <p className={cn('flex flex-wrap items-center gap-x-2 text-xs', theme.text.muted)}>
                <span className="font-mono">{image.id.substring(0, 12)}</span>
                <span>·</span>
                <span>{formatBytes(image.size)}</span>
                <span>·</span>
                <span>{formatDate(image.created)}</span>
              </p>
              {getStatusBadge('active', image.unused, image.dangling)}
            </div>
            {deleteButton(image)}
          </div>
        )}
      />
    </div>
  );
};
