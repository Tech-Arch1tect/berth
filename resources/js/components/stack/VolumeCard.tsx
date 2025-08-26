import React from 'react';
import { Volume } from '../../types/stack';

interface VolumeCardProps {
  volume: Volume;
}

const VolumeCard: React.FC<VolumeCardProps> = ({ volume }) => {
  const getVolumeStatusColor = (exists: boolean) => {
    return exists
      ? 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400'
      : 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-500';
  };

  const formatDate = (dateString: string | undefined) => {
    if (!dateString) return 'Unknown';
    try {
      return new Date(dateString).toLocaleString();
    } catch {
      return 'Invalid date';
    }
  };

  return (
    <div className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
      {/* Header */}
      <div className="px-6 py-4 bg-gray-50 dark:bg-gray-700 border-b border-gray-200 dark:border-gray-600">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="flex-shrink-0">
              <svg
                className="w-6 h-6 text-purple-500 dark:text-purple-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M5 19a2 2 0 01-2-2V7a2 2 0 012-2h4l2 2h4a2 2 0 012 2v1M5 19h14a2 2 0 002-2v-5a2 2 0 00-2-2H9a2 2 0 00-2 2v5a2 2 0 01-2 2z"
                />
              </svg>
            </div>
            <div>
              <h3 className="text-lg font-medium text-gray-900 dark:text-white">{volume.name}</h3>
              {volume.driver && (
                <p className="text-sm text-gray-600 dark:text-gray-400">Driver: {volume.driver}</p>
              )}
            </div>
          </div>
          <div className="flex items-center space-x-2">
            <span
              className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getVolumeStatusColor(volume.exists)}`}
            >
              {volume.exists ? 'Active' : 'Declared'}
            </span>
            {volume.external && (
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-400">
                External
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="px-6 py-4 space-y-4">
        {/* Basic Information */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">Status</dt>
            <dd className="mt-1 text-sm text-gray-900 dark:text-white">
              {volume.exists ? 'Running' : 'Not Created'}
            </dd>
          </div>
          {volume.created && (
            <div>
              <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">Created</dt>
              <dd className="mt-1 text-sm text-gray-900 dark:text-white">
                {formatDate(volume.created)}
              </dd>
            </div>
          )}
          {volume.scope && (
            <div>
              <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">Scope</dt>
              <dd className="mt-1 text-sm text-gray-900 dark:text-white font-mono">
                {volume.scope}
              </dd>
            </div>
          )}
          {volume.mountpoint && (
            <div>
              <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">Mount Point</dt>
              <dd className="mt-1 text-sm text-gray-900 dark:text-white font-mono break-all">
                {volume.mountpoint}
              </dd>
            </div>
          )}
        </div>

        {/* Used By Containers */}
        {volume.used_by && volume.used_by.length > 0 && (
          <div>
            <dt className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-2">
              Used by Containers ({volume.used_by.length})
            </dt>
            <div className="space-y-2">
              {volume.used_by.map((usage, index) => (
                <div key={index} className="bg-gray-50 dark:bg-gray-800 rounded-md p-3">
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-medium text-gray-900 dark:text-white">
                      {usage.container_name}
                    </span>
                    <span className="text-sm text-gray-600 dark:text-gray-400">
                      Service: {usage.service_name}
                    </span>
                  </div>
                  {usage.mounts.map((mount, mountIndex) => (
                    <div
                      key={mountIndex}
                      className="text-sm text-gray-600 dark:text-gray-400 space-y-1"
                    >
                      <div className="flex flex-wrap gap-4">
                        <span>
                          Type: <span className="font-mono">{mount.type}</span>
                        </span>
                        <span>
                          Source: <span className="font-mono break-all">{mount.source}</span>
                        </span>
                        <span>
                          Target: <span className="font-mono break-all">{mount.target}</span>
                        </span>
                        {mount.read_only && (
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400">
                            Read Only
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Driver Options */}
        {volume.driver_opts && Object.keys(volume.driver_opts).length > 0 && (
          <div>
            <dt className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-2">
              Driver Options
            </dt>
            <div className="bg-gray-50 dark:bg-gray-800 rounded-md p-3">
              <dl className="space-y-1">
                {Object.entries(volume.driver_opts).map(([key, value]) => (
                  <div key={key} className="flex">
                    <dt className="text-sm text-gray-500 dark:text-gray-400 min-w-0 flex-1">
                      {key}:
                    </dt>
                    <dd className="text-sm text-gray-900 dark:text-white font-mono ml-2">
                      {value}
                    </dd>
                  </div>
                ))}
              </dl>
            </div>
          </div>
        )}

        {/* Labels */}
        {volume.labels && Object.keys(volume.labels).length > 0 && (
          <div>
            <dt className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-2">Labels</dt>
            <div className="flex flex-wrap gap-2">
              {Object.entries(volume.labels).map(([key, value]) => (
                <span
                  key={key}
                  className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300"
                >
                  {key}: {value}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default VolumeCard;
