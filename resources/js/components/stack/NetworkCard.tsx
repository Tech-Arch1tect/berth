import React from 'react';
import { Network } from '../../types/stack';

interface NetworkCardProps {
  network: Network;
}

const NetworkCard: React.FC<NetworkCardProps> = ({ network }) => {
  const getNetworkStatusColor = (exists: boolean) => {
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
                className="w-6 h-6 text-blue-500 dark:text-blue-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
                />
              </svg>
            </div>
            <div>
              <h3 className="text-lg font-medium text-gray-900 dark:text-white">{network.name}</h3>
              {network.driver && (
                <p className="text-sm text-gray-600 dark:text-gray-400">Driver: {network.driver}</p>
              )}
            </div>
          </div>
          <div className="flex items-center space-x-2">
            <span
              className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getNetworkStatusColor(network.exists)}`}
            >
              {network.exists ? 'Active' : 'Declared'}
            </span>
            {network.external && (
              <span className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-400">
                External
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="px-6 py-4 space-y-4">
        {/* Network Information */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">Status</dt>
            <dd className="mt-1 text-sm text-gray-900 dark:text-white">
              {network.exists ? 'Running' : 'Not Created'}
            </dd>
          </div>
          {network.created && (
            <div>
              <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">Created</dt>
              <dd className="mt-1 text-sm text-gray-900 dark:text-white">
                {formatDate(network.created)}
              </dd>
            </div>
          )}
        </div>

        {/* IPAM Configuration */}
        {network.ipam && (
          <div>
            <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Network Configuration
            </h4>
            <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-3 space-y-2">
              {network.ipam.driver && (
                <div className="flex justify-between">
                  <span className="text-sm text-gray-600 dark:text-gray-400">IPAM Driver:</span>
                  <span className="text-sm text-gray-900 dark:text-white font-mono">
                    {network.ipam.driver}
                  </span>
                </div>
              )}
              {network.ipam.config && network.ipam.config.length > 0 && (
                <div>
                  <span className="text-sm text-gray-600 dark:text-gray-400 block mb-1">
                    Subnets:
                  </span>
                  <div className="space-y-1">
                    {network.ipam.config.map((config, index) => (
                      <div
                        key={index}
                        className="flex flex-col sm:flex-row sm:justify-between text-sm"
                      >
                        {config.subnet && (
                          <span className="text-gray-900 dark:text-white font-mono">
                            {config.subnet}
                          </span>
                        )}
                        {config.gateway && (
                          <span className="text-gray-600 dark:text-gray-400">
                            Gateway: {config.gateway}
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Connected Containers */}
        {network.containers && Object.keys(network.containers).length > 0 && (
          <div>
            <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Connected Containers ({Object.keys(network.containers).length})
            </h4>
            <div className="space-y-2">
              {Object.entries(network.containers).map(([containerId, endpoint]) => (
                <div key={containerId} className="bg-gray-50 dark:bg-gray-800 rounded-lg p-3">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-medium text-gray-900 dark:text-white">
                      {endpoint.name}
                    </span>
                    <span className="text-xs text-gray-500 dark:text-gray-400 font-mono">
                      {containerId.substring(0, 12)}...
                    </span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                    {endpoint.ipv4_address && (
                      <div>
                        <span className="text-gray-600 dark:text-gray-400">IPv4: </span>
                        <span className="text-gray-900 dark:text-white font-mono">
                          {endpoint.ipv4_address}
                        </span>
                      </div>
                    )}
                    {endpoint.mac_address && (
                      <div>
                        <span className="text-gray-600 dark:text-gray-400">MAC: </span>
                        <span className="text-gray-900 dark:text-white font-mono">
                          {endpoint.mac_address}
                        </span>
                      </div>
                    )}
                    {endpoint.ipv6_address && (
                      <div className="sm:col-span-2">
                        <span className="text-gray-600 dark:text-gray-400">IPv6: </span>
                        <span className="text-gray-900 dark:text-white font-mono">
                          {endpoint.ipv6_address}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Labels */}
        {network.labels && Object.keys(network.labels).length > 0 && (
          <div>
            <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Labels</h4>
            <div className="flex flex-wrap gap-2">
              {Object.entries(network.labels).map(([key, value]) => (
                <span
                  key={key}
                  className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-indigo-100 text-indigo-800 dark:bg-indigo-900/20 dark:text-indigo-300"
                >
                  {key}: {value}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Driver Options */}
        {network.options && Object.keys(network.options).length > 0 && (
          <div>
            <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Driver Options
            </h4>
            <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-3 space-y-1">
              {Object.entries(network.options).map(([key, value]) => (
                <div key={key} className="flex justify-between text-sm">
                  <span className="text-gray-600 dark:text-gray-400">{key}:</span>
                  <span className="text-gray-900 dark:text-white font-mono">{value}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default NetworkCard;
