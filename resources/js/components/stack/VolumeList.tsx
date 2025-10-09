import { theme } from '../../theme';
import { Volume } from '../../types/stack';
import { cn } from '../../utils/cn';
import VolumeCard from './VolumeCard';
import { EmptyState, LoadingSpinner } from '../common';
import { ExclamationCircleIcon } from '@heroicons/react/24/outline';

interface VolumeListProps {
  volumes: Volume[];
  isLoading?: boolean;
  error?: Error | null;
}

export const VolumeList = ({ volumes, isLoading, error }: VolumeListProps) => {
  if (isLoading) {
    return <LoadingSpinner text="Loading volumes..." />;
  }

  if (error) {
    return (
      <EmptyState
        icon={ExclamationCircleIcon}
        title="Error loading volumes"
        description={error?.message ?? 'An unknown error occurred'}
        variant="error"
      />
    );
  }

  if (!volumes || volumes.length === 0) {
    return (
      <EmptyState
        title="No volumes found"
        description="This stack doesn't have any volumes configured."
        variant="default"
      />
    );
  }

  const activeVolumes = volumes.filter((volume) => volume.exists);
  const declaredVolumes = volumes.filter((volume) => !volume.exists);

  return (
    <div className="space-y-6">
      {activeVolumes.length > 0 && (
        <section>
          <h2 className={cn('text-lg font-semibold', theme.text.strong)}>
            Active Volumes ({activeVolumes.length})
          </h2>
          <div className="mt-4 space-y-4">
            {activeVolumes.map((volume) => (
              <VolumeCard key={volume.name} volume={volume} />
            ))}
          </div>
        </section>
      )}

      {declaredVolumes.length > 0 && (
        <section>
          <h2 className={cn('text-lg font-semibold', theme.text.strong)}>
            Declared Volumes ({declaredVolumes.length})
          </h2>
          <div className="mt-4 space-y-4">
            {declaredVolumes.map((volume) => (
              <VolumeCard key={volume.name} volume={volume} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
};

export default VolumeList;
