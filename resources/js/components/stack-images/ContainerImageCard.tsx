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
    <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
      {/* Header */}
      <div className="p-6 border-b border-slate-200 dark:border-slate-700">
        <div className="flex items-start justify-between">
          <div className="flex items-start space-x-3">
            <div className="p-2 rounded-lg bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400">
              <CubeIcon className="w-5 h-5" />
            </div>

            <div className="flex-1">
              <h3 className="text-lg font-semibold text-slate-900 dark:text-white">
                {container_name}
              </h3>
              <div className="flex items-center space-x-2 mt-1">
                <span className="text-sm text-slate-600 dark:text-slate-400">📦</span>
                <code className="text-sm font-mono text-slate-700 dark:text-slate-300">
                  {image_name}
                </code>
                <button
                  onClick={() => copyToClipboard(image_name)}
                  className="p-1 hover:bg-slate-100 dark:hover:bg-slate-700 rounded transition-colors"
                  title="Copy image name"
                >
                  <DocumentDuplicateIcon className="w-3 h-3 text-slate-400" />
                </button>
              </div>
            </div>
          </div>

          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
          >
            {isExpanded ? (
              <ChevronDownIcon className="w-5 h-5 text-slate-500" />
            ) : (
              <ChevronRightIcon className="w-5 h-5 text-slate-500" />
            )}
          </button>
        </div>

        {/* Basic Image Info - Always Visible */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4">
          <div>
            <p className="text-xs text-slate-600 dark:text-slate-400">Architecture</p>
            <p className="text-sm font-medium text-slate-900 dark:text-white">
              {image_info.architecture}
            </p>
          </div>

          <div>
            <p className="text-xs text-slate-600 dark:text-slate-400">OS</p>
            <p className="text-sm font-medium text-slate-900 dark:text-white">{image_info.os}</p>
          </div>

          <div>
            <p className="text-xs text-slate-600 dark:text-slate-400">Size</p>
            <p className="text-sm font-medium text-slate-900 dark:text-white">
              {formatImageSize(image_info.size)}
            </p>
          </div>

          <div>
            <p className="text-xs text-slate-600 dark:text-slate-400">Created</p>
            <p className="text-sm font-medium text-slate-900 dark:text-white">
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
              <p className="text-xs text-slate-600 dark:text-slate-400">Image ID</p>
              <div className="flex items-center space-x-2">
                <code className="text-sm font-mono text-slate-700 dark:text-slate-300">
                  {truncateImageId(imageDetails.image_id)}
                </code>
                <button
                  onClick={() => copyToClipboard(imageDetails.image_id)}
                  className="p-1 hover:bg-slate-100 dark:hover:bg-slate-700 rounded transition-colors"
                  title="Copy full image ID"
                >
                  <DocumentDuplicateIcon className="w-3 h-3 text-slate-400" />
                </button>
              </div>
            </div>

            {image_info.author && (
              <div>
                <p className="text-xs text-slate-600 dark:text-slate-400">Author</p>
                <p className="text-sm text-slate-700 dark:text-slate-300">{image_info.author}</p>
              </div>
            )}

            {image_info.docker_version && (
              <div>
                <p className="text-xs text-slate-600 dark:text-slate-400">Docker Version</p>
                <p className="text-sm text-slate-700 dark:text-slate-300">
                  {image_info.docker_version}
                </p>
              </div>
            )}

            {image_info.rootfs.layers && (
              <div>
                <p className="text-xs text-slate-600 dark:text-slate-400">Layers</p>
                <p className="text-sm text-slate-700 dark:text-slate-300">
                  {image_info.rootfs.layers.length} layers
                </p>
              </div>
            )}
          </div>

          {/* Base Image Information */}
          {(image_info.parent || image_info.repo_tags || image_info.repo_digests) && (
            <div className="border-t border-slate-200 dark:border-slate-700 pt-6">
              <h4 className="text-sm font-medium text-slate-900 dark:text-white mb-3 flex items-center space-x-2">
                <InformationCircleIcon className="w-4 h-4" />
                <span>Base Image Information</span>
              </h4>

              <div className="grid grid-cols-1 gap-4">
                {image_info.parent && (
                  <div>
                    <p className="text-xs text-slate-600 dark:text-slate-400">Parent Image</p>
                    <div className="flex items-center space-x-2">
                      <code className="text-sm font-mono text-slate-700 dark:text-slate-300">
                        {truncateImageId(image_info.parent)}
                      </code>
                      <button
                        onClick={() => copyToClipboard(image_info.parent)}
                        className="p-1 hover:bg-slate-100 dark:hover:bg-slate-700 rounded transition-colors"
                        title="Copy parent image ID"
                      >
                        <DocumentDuplicateIcon className="w-3 h-3 text-slate-400" />
                      </button>
                    </div>
                  </div>
                )}

                {image_info.repo_tags && image_info.repo_tags.length > 0 && (
                  <div>
                    <p className="text-xs text-slate-600 dark:text-slate-400">Repository Tags</p>
                    <div className="flex flex-wrap gap-2 mt-1">
                      {image_info.repo_tags.map((tag, index) => (
                        <span
                          key={index}
                          className="inline-flex items-center px-2 py-1 rounded-md text-xs font-medium bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-200"
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {image_info.repo_digests && image_info.repo_digests.length > 0 && (
                  <div>
                    <p className="text-xs text-slate-600 dark:text-slate-400">Repository Digests</p>
                    <div className="space-y-1 mt-1">
                      {image_info.repo_digests.map((digest, index) => (
                        <div key={index} className="flex items-center space-x-2">
                          <code className="text-xs font-mono text-slate-600 dark:text-slate-400 break-all">
                            {digest}
                          </code>
                          <button
                            onClick={() => copyToClipboard(digest)}
                            className="p-1 hover:bg-slate-100 dark:hover:bg-slate-700 rounded transition-colors flex-shrink-0"
                            title="Copy digest"
                          >
                            <DocumentDuplicateIcon className="w-3 h-3 text-slate-400" />
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
                className="flex items-center space-x-2 text-sm font-medium text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white transition-colors"
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
                <div className="mt-4 bg-slate-50 dark:bg-slate-800/50 rounded-lg p-4">
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
