import React from 'react';
import { Network } from '../../../types/stack';
import NetworkCard from './NetworkCard';
import { EmptyState, LoadingSpinner } from '../../common';
import { ExclamationCircleIcon } from '@heroicons/react/24/outline';
import { cn } from '../../../utils/cn';
import { theme } from '../../../theme';

interface NetworkListProps {
  networks: Network[];
  isLoading?: boolean;
  error?: Error | null;
}

const NetworkList: React.FC<NetworkListProps> = ({ networks, isLoading, error }) => {
  if (isLoading) {
    return <LoadingSpinner text="Loading networks..." />;
  }

  if (error) {
    return (
      <EmptyState
        icon={ExclamationCircleIcon}
        title="Error loading networks"
        description={error.message || 'An unknown error occurred'}
        variant="error"
      />
    );
  }

  if (!networks || networks.length === 0) {
    return (
      <EmptyState
        title="No networks found"
        description="This stack doesn't have any networks configured."
        variant="default"
      />
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
