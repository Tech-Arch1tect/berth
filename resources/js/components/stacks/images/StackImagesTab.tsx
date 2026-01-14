import { useStackImages } from '../../../hooks/useStackImages';
import { ContainerImageCard } from './ContainerImageCard';
import { ArrowPathIcon, Square2StackIcon } from '@heroicons/react/24/outline';
import { cn } from '../../../utils/cn';
import { theme } from '../../../theme';
import { EmptyState } from '../../common/EmptyState';
import { LoadingSpinner } from '../../common/LoadingSpinner';
import { useServerStack } from '../../../contexts/ServerStackContext';

export const StackImagesTab: React.FC = () => {
  const { serverId, stackName } = useServerStack();

  const {
    data: imageDetails,
    isLoading,
    error,
    refetch,
    isFetching,
  } = useStackImages({ serverid: serverId, stackname: stackName });

  if (isLoading) {
    return (
      <div className="h-full flex items-center justify-center">
        <LoadingSpinner size="lg" text="Inspecting container images..." />
      </div>
    );
  }

  if (error) {
    return (
      <div className="h-full flex items-center justify-center">
        <EmptyState
          variant="error"
          title="Error loading image details"
          description={error?.message || 'Unable to fetch container image information.'}
          action={{
            label: 'Try Again',
            onClick: () => refetch(),
          }}
          icon={Square2StackIcon}
        />
      </div>
    );
  }

  if (!imageDetails || imageDetails.length === 0) {
    return (
      <div className="h-full flex items-center justify-center">
        <EmptyState
          title="No images found"
          description="This stack doesn't have any running containers with image information."
          icon={Square2StackIcon}
        />
      </div>
    );
  }

  const totalImages = imageDetails.length;
  const uniqueImages = new Set(imageDetails.map((img) => img.image_name)).size;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className={cn('text-xl font-bold', theme.text.strong)}>Images</h2>
          <p className={cn('text-sm', theme.text.subtle)}>
            {totalImages} container{totalImages !== 1 ? 's' : ''} using {uniqueImages} unique image
            {uniqueImages !== 1 ? 's' : ''}
          </p>
        </div>

        <button
          onClick={() => refetch()}
          disabled={isFetching}
          className={cn(theme.buttons.secondary, 'gap-2')}
        >
          <ArrowPathIcon className={cn('w-4 h-4', isFetching && 'animate-spin')} />
          Refresh
        </button>
      </div>

      {/* Image Cards */}
      <div className="space-y-4">
        {imageDetails.map((imageDetail) => (
          <ContainerImageCard
            key={`${imageDetail.container_name}-${imageDetail.image_id}`}
            imageDetails={imageDetail}
          />
        ))}
      </div>
    </div>
  );
};
