import React from 'react';
import { useStackImages } from '../../hooks/useStackImages';
import { ContainerImageCard } from './ContainerImageCard';
import { ArrowPathIcon } from '@heroicons/react/24/outline';
import { cn } from '../../utils/cn';
import { theme } from '../../theme';
import { EmptyState } from '../common/EmptyState';
import { LoadingSpinner } from '../common/LoadingSpinner';

interface StackImagesTabProps {
  serverid: number;
  stackname: string;
}

export const StackImagesTab: React.FC<StackImagesTabProps> = ({ serverid, stackname }) => {
  const {
    data: imageDetails,
    isLoading,
    error,
    refetch,
    isFetching,
  } = useStackImages({ serverid, stackname });

  if (isLoading) {
    return <LoadingSpinner text="Inspecting Docker images and build history..." />;
  }

  if (error) {
    return (
      <EmptyState
        variant="error"
        title="Error loading image details"
        description={error?.message || 'Unable to fetch container image information.'}
        action={{
          label: 'Try Again',
          onClick: () => refetch(),
        }}
        icon={({ className }) => (
          <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
            />
          </svg>
        )}
      />
    );
  }

  if (!imageDetails || imageDetails.length === 0) {
    return (
      <EmptyState
        title="No images found"
        description="This stack doesn't have any running containers with image information."
        icon={({ className }) => (
          <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M20.25 6.375c0 2.278-3.694 4.125-8.25 4.125S3.75 8.653 3.75 6.375m16.5 0c0-2.278-3.694-4.125-8.25-4.125S3.75 4.097 3.75 6.375m16.5 0v11.25c0 2.278-3.694 4.125-8.25 4.125s-8.25-1.847-8.25-4.125V6.375m16.5 0v3.75m-16.5-3.75v3.75m16.5 0v3.75C20.25 16.153 16.556 18 12 18s-8.25-1.847-8.25-4.125v-3.75m16.5 0c0 2.278-3.694 4.125-8.25 4.125s-8.25-1.847-8.25-4.125"
            />
          </svg>
        )}
      />
    );
  }

  const totalImages = imageDetails.length;
  const uniqueImages = new Set(imageDetails.map((img) => img.image_name)).size;

  return (
    <div className="space-y-6">
      {/* Summary */}
      <div className={theme.cards.translucent}>
        <div className="flex items-center justify-between">
          <div>
            <h3 className={cn('text-lg font-semibold', theme.text.strong)}>Container Images</h3>
            <p className={cn('text-sm mt-1', theme.text.muted)}>
              {totalImages} container{totalImages !== 1 ? 's' : ''} using {uniqueImages} unique
              image{uniqueImages !== 1 ? 's' : ''}
            </p>
          </div>

          <button
            onClick={() => refetch()}
            disabled={isFetching}
            className={theme.buttons.secondary}
          >
            <ArrowPathIcon className={`w-4 h-4 ${isFetching ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>
        </div>
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
