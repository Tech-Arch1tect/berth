import React from 'react';
import { Network } from '../../types/stack';
import NetworkCard from './NetworkCard';
import { cn } from '../../utils/cn';
import { theme } from '../../theme';

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
          <div key={i} className={cn('rounded-lg animate-pulse', theme.cards.shell)}>
            <div className={cn('px-6 py-4', theme.surface.muted)}>
              <div className="flex items-center space-x-3">
                <div className={cn('w-6 h-6 rounded', theme.surface.code)}></div>
                <div>
                  <div className={cn('w-24 h-4 rounded mb-1', theme.surface.code)}></div>
                  <div className={cn('w-16 h-3 rounded', theme.surface.code)}></div>
                </div>
              </div>
            </div>
            <div className="px-6 py-4 space-y-3">
              <div className={cn('w-full h-4 rounded', theme.surface.code)}></div>
              <div className={cn('w-3/4 h-4 rounded', theme.surface.code)}></div>
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-12">
        <div
          className={cn(
            'inline-flex items-center justify-center w-16 h-16 rounded-full mb-4',
            theme.intent.danger.surface
          )}
        >
          <svg
            className={cn('w-8 h-8', theme.intent.danger.icon)}
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
        <h3 className={cn('text-lg font-medium mb-2', theme.text.strong)}>
          Error loading networks
        </h3>
        <p className={cn('mb-4', theme.text.muted)}>
          {error.message || 'An unknown error occurred'}
        </p>
      </div>
    );
  }

  if (!networks || networks.length === 0) {
    return (
      <div className="text-center py-12">
        <div
          className={cn(
            'inline-flex items-center justify-center w-16 h-16 rounded-full mb-4',
            theme.surface.muted
          )}
        >
          <svg
            className={cn('w-8 h-8', theme.text.subtle)}
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
        <h3 className={cn('text-lg font-medium mb-2', theme.text.strong)}>No networks found</h3>
        <p className={theme.text.muted}>This stack doesn't have any networks configured.</p>
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
          <h3 className={cn('text-lg font-medium mb-4', theme.text.strong)}>
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
          <h3 className={cn('text-lg font-medium mb-4', theme.text.strong)}>
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
