import React from 'react';
import { cn } from '../../../shared/utils/cn';
import { theme } from '../../../shared/theme';
import { Table } from '../../../shared/components/Table';
import { formatBytes, formatDate } from '../../../shared/utils/formatters';
import { getResourceStatusBadge } from '../../stacks/utils/statusHelpers';
import { DocumentDuplicateIcon, TrashIcon } from '@heroicons/react/24/outline';
import type { ImageInfo } from '../../../api/generated/models';
import { containerCount, imageDeleteBlockedReason } from '../deletions';
import { timeValue } from '../../../shared/utils/tableRows';

type DeleteResourceType = 'image' | 'container' | 'volume' | 'network';

interface MaintenanceImagesTabProps {
  images: ImageInfo[];
  onDelete: (deleteRequest: { type: DeleteResourceType; id: string; name?: string }) => void;
  isDeleting: boolean;
  canWrite: boolean;
}

export const MaintenanceImagesTab: React.FC<MaintenanceImagesTabProps> = ({
  images,
  onDelete,
  isDeleting,
  canWrite,
}) => {
  const getStatusBadge = (status: string, isUnused?: boolean, isDangling?: boolean) => {
    const badgeInfo = getResourceStatusBadge(status, isUnused, isDangling);
    return <span className={badgeInfo.className}>{badgeInfo.label}</span>;
  };

  const imageName = (image: ImageInfo) =>
    image.tags.length > 0 ? image.tags.join(', ') : `<untagged> ${image.id.substring(0, 12)}`;

  const deleteButton = (image: ImageInfo) => {
    const blocked = imageDeleteBlockedReason(image);
    return (
      <button
        onClick={() =>
          onDelete({
            type: 'image',
            id: image.id,
            name: imageName(image),
          })
        }
        aria-label={`Delete image ${imageName(image)}`}
        title={blocked}
        className={cn(
          'flex h-11 w-11 items-center justify-center rounded-lg transition-colors',
          theme.text.danger,
          'hover:bg-rose-50 dark:hover:bg-rose-900/20',
          'disabled:cursor-not-allowed disabled:opacity-50'
        )}
        disabled={isDeleting || blocked !== undefined}
      >
        <TrashIcon className="h-4 w-4" />
      </button>
    );
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
        defaultSortKey="size"
        searchValue={(image) => `${image.tags.join(' ')} ${image.id}`}
        searchPlaceholder="Search images by tag or ID"
        columns={[
          {
            key: 'tags',
            header: 'Tags',
            sortValue: (image) => image.tags.join(', '),
            render: (image) => (
              <span className={cn('text-sm font-medium', theme.text.strong)}>
                {image.tags.length > 0 ? image.tags.join(', ') : '<untagged>'}
              </span>
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
            sortValue: (image) => image.size,
            render: (image) => (
              <span className={cn('text-sm', theme.text.muted)}>{formatBytes(image.size)}</span>
            ),
          },
          {
            key: 'shared_size',
            header: 'Not shared',
            sortValue: (image) => (image.shared_size >= 0 ? image.size - image.shared_size : null),
            render: (image) => (
              <span className={cn('text-sm', theme.text.muted)}>
                {image.shared_size >= 0 ? formatBytes(image.size - image.shared_size) : 'unknown'}
              </span>
            ),
          },
          {
            key: 'containers',
            header: 'Used by',
            sortValue: (image) => image.containers,
            render: (image) => (
              <span className={cn('text-sm', theme.text.muted)}>
                {image.containers === 0 ? 'nothing' : containerCount(image.containers)}
              </span>
            ),
          },
          {
            key: 'created',
            header: 'Created',
            sortValue: (image) => timeValue(image.created),
            render: (image) => (
              <span className={cn('text-sm', theme.text.muted)}>{formatDate(image.created)}</span>
            ),
          },
          {
            key: 'status',
            header: 'Status',
            render: (image) => getStatusBadge('active', image.unused, image.dangling),
          },
          ...(canWrite
            ? [
                {
                  key: 'actions',
                  header: 'Actions',
                  render: (image: ImageInfo) => deleteButton(image),
                },
              ]
            : []),
        ]}
        renderCard={(image) => (
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0 flex-1 space-y-1">
              <p className={cn('truncate text-sm font-medium', theme.text.strong)}>
                {image.tags.length > 0 ? image.tags.join(', ') : '<untagged>'}
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
            {canWrite && deleteButton(image)}
          </div>
        )}
      />
    </div>
  );
};
