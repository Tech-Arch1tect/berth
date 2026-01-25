import { useState } from 'react';
import type {
  ContainerImageDetails,
  ImageHistoryLayer as ImageHistoryLayerType,
} from '../../../api/generated/models';
import { ImageHistoryLayer } from './ImageHistoryLayer';
import { ImageConfigDetails } from './ImageConfigDetails';
import { formatImageSize, formatCreatedTime } from './utils/image-helpers';
import {
  ChevronDownIcon,
  ChevronRightIcon,
  DocumentDuplicateIcon,
  CubeIcon,
  InformationCircleIcon,
  CodeBracketIcon,
} from '@heroicons/react/24/outline';
import { cn } from '../../../utils/cn';
import { theme } from '../../../theme';

interface ContainerImageCardProps {
  imageDetails: ContainerImageDetails;
}

export const ContainerImageCard: React.FC<ContainerImageCardProps> = ({ imageDetails }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [showHistory, setShowHistory] = useState(false);

  const { container_name, image_name, image_info, image_history } = imageDetails;

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  const truncateImageId = (imageId: string) => {
    return imageId.startsWith('sha256:') ? imageId.slice(7, 19) : imageId.slice(0, 12);
  };

  return (
    <div
      className={cn(
        'rounded-lg border',
        'border-zinc-200 dark:border-zinc-800',
        'bg-white dark:bg-zinc-900'
      )}
    >
      {/* Header */}
      <div className="p-4 border-b border-zinc-200 dark:border-zinc-800">
        <div className="flex items-start justify-between">
          <div className="flex items-start gap-3">
            <div
              className={cn(
                'p-2 rounded-lg',
                'bg-teal-100 dark:bg-teal-900/30',
                'text-teal-600 dark:text-teal-400'
              )}
            >
              <CubeIcon className="w-5 h-5" />
            </div>

            <div className="flex-1 min-w-0">
              <h3 className={cn('text-base font-semibold', theme.text.strong)}>{container_name}</h3>
              <div className="flex items-center gap-2 mt-1">
                <code className={cn('text-sm font-mono truncate', theme.text.muted)}>
                  {image_name}
                </code>
                <button
                  onClick={() => copyToClipboard(image_name)}
                  className={cn(
                    'p-1 rounded hover:bg-zinc-100 dark:hover:bg-zinc-800',
                    'text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300'
                  )}
                  title="Copy image name"
                >
                  <DocumentDuplicateIcon className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </div>

          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className={cn(
              'p-1.5 rounded-lg',
              'hover:bg-zinc-100 dark:hover:bg-zinc-800',
              'text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300'
            )}
          >
            {isExpanded ? (
              <ChevronDownIcon className="w-5 h-5" />
            ) : (
              <ChevronRightIcon className="w-5 h-5" />
            )}
          </button>
        </div>

        {/* Basic Image Info - Always Visible */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4">
          <div>
            <p className={cn('text-xs', theme.text.muted)}>Architecture</p>
            <p className={cn('text-sm font-medium', theme.text.strong)}>
              {image_info.architecture}
            </p>
          </div>

          <div>
            <p className={cn('text-xs', theme.text.muted)}>OS</p>
            <p className={cn('text-sm font-medium', theme.text.strong)}>{image_info.os}</p>
          </div>

          <div>
            <p className={cn('text-xs', theme.text.muted)}>Size</p>
            <p className={cn('text-sm font-medium', theme.text.strong)}>
              {formatImageSize(image_info.size)}
            </p>
          </div>

          <div>
            <p className={cn('text-xs', theme.text.muted)}>Created</p>
            <p className={cn('text-sm font-medium', theme.text.strong)}>
              {formatCreatedTime(image_info.created)}
            </p>
          </div>
        </div>
      </div>

      {/* Expanded Content */}
      {isExpanded && (
        <div className="p-4 space-y-6">
          {/* Additional Details */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <p className={cn('text-xs', theme.text.muted)}>Image ID</p>
              <div className="flex items-center gap-2">
                <code className={cn('text-sm font-mono', theme.text.standard)}>
                  {truncateImageId(imageDetails.image_id)}
                </code>
                <button
                  onClick={() => copyToClipboard(imageDetails.image_id)}
                  className={cn(
                    'p-1 rounded hover:bg-zinc-100 dark:hover:bg-zinc-800',
                    'text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300'
                  )}
                  title="Copy full image ID"
                >
                  <DocumentDuplicateIcon className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {image_info.author && (
              <div>
                <p className={cn('text-xs', theme.text.muted)}>Author</p>
                <p className={cn('text-sm', theme.text.standard)}>{image_info.author}</p>
              </div>
            )}

            {image_info.docker_version && (
              <div>
                <p className={cn('text-xs', theme.text.muted)}>Docker Version</p>
                <p className={cn('text-sm', theme.text.standard)}>{image_info.docker_version}</p>
              </div>
            )}

            {image_info.rootfs.layers && (
              <div>
                <p className={cn('text-xs', theme.text.muted)}>Layers</p>
                <p className={cn('text-sm', theme.text.standard)}>
                  {image_info.rootfs.layers.length} layers
                </p>
              </div>
            )}
          </div>

          {/* Base Image Information */}
          {(image_info.parent || image_info.repo_tags || image_info.repo_digests) && (
            <div className="pt-4 border-t border-zinc-200 dark:border-zinc-700">
              <h4
                className={cn(
                  'text-sm font-medium mb-3 flex items-center gap-2',
                  theme.text.strong
                )}
              >
                <InformationCircleIcon className="w-4 h-4" />
                <span>Base Image Information</span>
              </h4>

              <div className="grid grid-cols-1 gap-4">
                {image_info.parent && (
                  <div>
                    <p className={cn('text-xs', theme.text.muted)}>Parent Image</p>
                    <div className="flex items-center gap-2">
                      <code className={cn('text-sm font-mono', theme.text.standard)}>
                        {truncateImageId(image_info.parent)}
                      </code>
                      <button
                        onClick={() => image_info.parent && copyToClipboard(image_info.parent)}
                        className={cn(
                          'p-1 rounded hover:bg-zinc-100 dark:hover:bg-zinc-800',
                          'text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300'
                        )}
                        title="Copy parent image ID"
                      >
                        <DocumentDuplicateIcon className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                )}

                {image_info.repo_tags && image_info.repo_tags.length > 0 && (
                  <div>
                    <p className={cn('text-xs', theme.text.muted)}>Repository Tags</p>
                    <div className="flex flex-wrap gap-2 mt-1">
                      {image_info.repo_tags.map((tag: string, index: number) => (
                        <span
                          key={index}
                          className={cn(
                            'px-2 py-0.5 rounded text-xs font-medium',
                            'bg-teal-100 dark:bg-teal-900/30',
                            'text-teal-700 dark:text-teal-300'
                          )}
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {image_info.repo_digests && image_info.repo_digests.length > 0 && (
                  <div>
                    <p className={cn('text-xs', theme.text.muted)}>Repository Digests</p>
                    <div className="space-y-1 mt-1">
                      {image_info.repo_digests.map((digest: string, index: number) => (
                        <div key={index} className="flex items-center gap-2">
                          <code
                            className={cn('text-xs font-mono break-all truncate', theme.text.muted)}
                            title={digest}
                          >
                            {digest}
                          </code>
                          <button
                            onClick={() => copyToClipboard(digest)}
                            className={cn(
                              'p-1 rounded hover:bg-zinc-100 dark:hover:bg-zinc-800 flex-shrink-0',
                              'text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300'
                            )}
                            title="Copy digest"
                          >
                            <DocumentDuplicateIcon className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Configuration Details */}
          <ImageConfigDetails config={image_info.config} />

          {/* Dockerfile History */}
          {image_history && image_history.length > 0 && (
            <div>
              <button
                onClick={() => setShowHistory(!showHistory)}
                className={cn(
                  'flex items-center gap-2 text-sm font-medium transition-colors',
                  theme.text.standard,
                  'hover:text-zinc-900 dark:hover:text-zinc-100'
                )}
              >
                <CodeBracketIcon className="w-4 h-4" />
                <span>Dockerfile History ({image_history.length} layers)</span>
                {showHistory ? (
                  <ChevronDownIcon className="w-4 h-4" />
                ) : (
                  <ChevronRightIcon className="w-4 h-4" />
                )}
              </button>

              {showHistory && (
                <div className={cn('mt-4 rounded-lg p-4', 'bg-zinc-50 dark:bg-zinc-800/50')}>
                  <div className="space-y-1 max-h-96 overflow-y-auto">
                    {image_history.map((layer: ImageHistoryLayerType, index: number) => (
                      <ImageHistoryLayer key={layer.id || index} layer={layer} />
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
