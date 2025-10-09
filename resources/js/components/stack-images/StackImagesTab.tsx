import React from 'react';
import { useStackImages } from '../../hooks/useStackImages';
import { ContainerImageCard } from './ContainerImageCard';
import { ArrowPathIcon, ExclamationTriangleIcon, CubeIcon } from '@heroicons/react/24/outline';
import { cn } from '../../utils/cn';
import { theme } from '../../theme';

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
    return (
      <div className="text-center py-16">
        <div className="relative">
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-32 h-32 bg-gradient-to-r from-blue-100 to-purple-100 dark:from-blue-900/20 dark:to-purple-900/20 rounded-full opacity-50" />
          </div>
          <div className="relative">
            <div
              className={cn(
                'mx-auto w-16 h-16 rounded-2xl flex items-center justify-center mb-6 animate-spin',
                theme.surface.muted
              )}
            >
              <ArrowPathIcon className={cn('w-8 h-8', theme.text.subtle)} />
            </div>
          </div>
        </div>
        <h3 className={cn('text-xl font-semibold mb-2', theme.text.strong)}>
          Loading image details...
        </h3>
        <p className={theme.text.muted}>Inspecting Docker images and build history.</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-16">
        <div className="relative">
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-32 h-32 bg-gradient-to-r from-red-100 to-orange-100 dark:from-red-900/20 dark:to-orange-900/20 rounded-full opacity-50" />
          </div>
          <div className="relative">
            <div
              className={cn(
                'mx-auto w-16 h-16 rounded-2xl flex items-center justify-center mb-6',
                theme.intent.danger.surface
              )}
            >
              <ExclamationTriangleIcon className={cn('w-8 h-8', theme.intent.danger.icon)} />
            </div>
          </div>
        </div>
        <h3 className={cn('text-xl font-semibold mb-2', theme.text.strong)}>
          Error loading image details
        </h3>
        <p className={cn('mb-6', theme.text.muted)}>
          {error?.message || 'Unable to fetch container image information.'}
        </p>
        <button
          onClick={() => refetch()}
          disabled={isFetching}
          className={cn(
            'inline-flex items-center px-6 py-3 rounded-xl shadow-lg hover:shadow-xl transition-all duration-200',
            theme.buttons.primary
          )}
        >
          <ArrowPathIcon className={`w-4 h-4 mr-2 ${isFetching ? 'animate-spin' : ''}`} />
          Try Again
        </button>
      </div>
    );
  }

  if (!imageDetails || imageDetails.length === 0) {
    return (
      <div className="text-center py-16">
        <div className="relative">
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-32 h-32 bg-gradient-to-r from-slate-100 to-slate-200 dark:from-slate-800/20 dark:to-slate-700/20 rounded-full opacity-50" />
          </div>
          <div className="relative">
            <div
              className={cn(
                'mx-auto w-16 h-16 rounded-2xl flex items-center justify-center mb-6',
                theme.surface.muted
              )}
            >
              <CubeIcon className={cn('w-8 h-8', theme.text.subtle)} />
            </div>
          </div>
        </div>
        <h3 className={cn('text-xl font-semibold mb-2', theme.text.strong)}>No images found</h3>
        <p className={theme.text.muted}>
          This stack doesn't have any running containers with image information.
        </p>
      </div>
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
