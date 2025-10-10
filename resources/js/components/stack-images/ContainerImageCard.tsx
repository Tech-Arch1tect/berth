import React, { useState } from 'react';
import { ContainerImageDetails } from '../../types/stack';
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
import { cn } from '../../utils/cn';
import { theme } from '../../theme';

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
    <div className={theme.cards.shell}>
      {/* Header */}
      <div className="p-6 border-b border-slate-200 dark:border-slate-700">
        <div className="flex items-start justify-between">
          <div className="flex items-start space-x-3">
            <div
              className={cn(
                'p-2 rounded-lg',
                theme.intent.info.surface,
                theme.intent.info.textStrong
              )}
            >
              <CubeIcon className="w-5 h-5" />
            </div>

            <div className="flex-1">
              <h3 className={cn('text-lg font-semibold', theme.text.strong)}>{container_name}</h3>
              <div className="flex items-center space-x-2 mt-1">
                <span className={cn('text-sm', theme.text.muted)}>📦</span>
                <code className={cn('text-sm font-mono', theme.text.standard)}>{image_name}</code>
                <button
                  onClick={() => copyToClipboard(image_name)}
                  className={theme.buttons.ghost}
                  title="Copy image name"
                >
                  <DocumentDuplicateIcon className={cn('w-3 h-3', theme.text.subtle)} />
                </button>
              </div>
            </div>
          </div>

          <button onClick={() => setIsExpanded(!isExpanded)} className={theme.buttons.ghost}>
            {isExpanded ? (
              <ChevronDownIcon className={cn('w-5 h-5', theme.text.subtle)} />
            ) : (
              <ChevronRightIcon className={cn('w-5 h-5', theme.text.subtle)} />
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
        <div className="p-6 space-y-6">
          {/* Additional Details */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <p className={cn('text-xs', theme.text.muted)}>Image ID</p>
              <div className="flex items-center space-x-2">
                <code className={cn('text-sm font-mono', theme.text.standard)}>
                  {truncateImageId(imageDetails.image_id)}
                </code>
                <button
                  onClick={() => copyToClipboard(imageDetails.image_id)}
                  className={theme.buttons.ghost}
                  title="Copy full image ID"
                >
                  <DocumentDuplicateIcon className={cn('w-3 h-3', theme.text.subtle)} />
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
            <div className="pt-6 border-t border-slate-200 dark:border-slate-700">
              <h4
                className={cn(
                  'text-sm font-medium mb-3 flex items-center space-x-2',
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
                    <div className="flex items-center space-x-2">
                      <code className={cn('text-sm font-mono', theme.text.standard)}>
                        {truncateImageId(image_info.parent)}
                      </code>
                      <button
                        onClick={() => image_info.parent && copyToClipboard(image_info.parent)}
                        className={theme.buttons.ghost}
                        title="Copy parent image ID"
                      >
                        <DocumentDuplicateIcon className={cn('w-3 h-3', theme.text.subtle)} />
                      </button>
                    </div>
                  </div>
                )}

                {image_info.repo_tags && image_info.repo_tags.length > 0 && (
                  <div>
                    <p className={cn('text-xs', theme.text.muted)}>Repository Tags</p>
                    <div className="flex flex-wrap gap-2 mt-1">
                      {image_info.repo_tags.map((tag, index) => (
                        <span
                          key={index}
                          className={cn(theme.badges.tag.base, theme.badges.tag.info)}
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
                      {image_info.repo_digests.map((digest, index) => (
                        <div key={index} className="flex items-center space-x-2">
                          <code className={cn('text-xs font-mono break-all', theme.text.muted)}>
                            {digest}
                          </code>
                          <button
                            onClick={() => copyToClipboard(digest)}
                            className={cn(theme.buttons.ghost, 'flex-shrink-0')}
                            title="Copy digest"
                          >
                            <DocumentDuplicateIcon className={cn('w-3 h-3', theme.text.subtle)} />
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
                  'flex items-center space-x-2 text-sm font-medium transition-colors',
                  theme.text.standard,
                  'hover:' + theme.text.strong
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
                <div className={cn('mt-4 rounded-lg p-4', theme.surface.muted)}>
                  <div className="space-y-1 max-h-96 overflow-y-auto">
                    {image_history.map((layer, index) => (
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
