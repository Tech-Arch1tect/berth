import React from 'react';
import { Network } from '../../types/stack';
import NetworkCard from './NetworkCard';

interface NetworkListProps {
  networks: Network[];
  isLoading?: boolean;
  error?: Error | null;
}

const NetworkList: React.FC<NetworkListProps> = ({ networks, isLoading, error }) => {
  if (isLoading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map((i) => (
          <div
            key={i}
            className="border border-gray-200 dark:border-gray-700 rounded-lg animate-pulse"
          >
            <div className="px-6 py-4 bg-gray-50 dark:bg-gray-700">
              <div className="flex items-center space-x-3">
                <div className="w-6 h-6 bg-gray-200 dark:bg-gray-600 rounded"></div>
                <div>
                  <div className="w-24 h-4 bg-gray-200 dark:bg-gray-600 rounded mb-1"></div>
                  <div className="w-16 h-3 bg-gray-200 dark:bg-gray-600 rounded"></div>
                </div>
              </div>
            </div>
            <div className="px-6 py-4 space-y-3">
              <div className="w-full h-4 bg-gray-200 dark:bg-gray-600 rounded"></div>
              <div className="w-3/4 h-4 bg-gray-200 dark:bg-gray-600 rounded"></div>
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-12">
        <div className="inline-flex items-center justify-center w-16 h-16 bg-red-100 dark:bg-red-900/20 rounded-full mb-4">
          <svg
            className="w-8 h-8 text-red-400"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
        </div>
        <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
          Error loading networks
        </h3>
        <p className="text-gray-500 dark:text-gray-400 mb-4">
          {error.message || 'An unknown error occurred'}
        </p>
      </div>
    );
  }

  if (!networks || networks.length === 0) {
    return (
      <div className="text-center py-12">
        <div className="inline-flex items-center justify-center w-16 h-16 bg-gray-100 dark:bg-gray-800 rounded-full mb-4">
          <svg
            className="w-8 h-8 text-gray-400 dark:text-gray-600"
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
        <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
          No networks found
        </h3>
        <p className="text-gray-500 dark:text-gray-400">
          This stack doesn't have any networks configured.
        </p>
      </div>
    );
  }

  const activeNetworks = networks.filter((network) => network.exists);
  const declaredNetworks = networks.filter((network) => !network.exists);

  return (
    <div className="space-y-6">
      {/* Active Networks */}
      {activeNetworks.length > 0 && (
        <div>
          <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">
            Active Networks ({activeNetworks.length})
          </h3>
          <div className="space-y-4">
            {activeNetworks.map((network) => (
              <NetworkCard key={network.name} network={network} />
            ))}
          </div>
        </div>
      )}

      {/* Declared but Not Created Networks */}
      {declaredNetworks.length > 0 && (
        <div>
          <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">
            Declared Networks ({declaredNetworks.length})
          </h3>
          <div className="space-y-4">
            {declaredNetworks.map((network) => (
              <NetworkCard key={network.name} network={network} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default NetworkList;
