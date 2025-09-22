import React from 'react';
import { useStackImages } from '../../hooks/useStackImages';
import { ContainerImageCard } from './ContainerImageCard';
import { ArrowPathIcon, ExclamationTriangleIcon, CubeIcon } from '@heroicons/react/24/outline';

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
            <div className="mx-auto w-16 h-16 bg-gradient-to-br from-slate-100 to-slate-200 dark:from-slate-800 dark:to-slate-700 rounded-2xl flex items-center justify-center mb-6 animate-spin">
              <ArrowPathIcon className="w-8 h-8 text-slate-400 dark:text-slate-500" />
            </div>
          </div>
        </div>
        <h3 className="text-xl font-semibold text-slate-900 dark:text-white mb-2">
          Loading image details...
        </h3>
        <p className="text-slate-600 dark:text-slate-400">
          Inspecting Docker images and build history.
        </p>
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
            <div className="mx-auto w-16 h-16 bg-gradient-to-br from-red-100 to-red-200 dark:from-red-800 dark:to-red-700 rounded-2xl flex items-center justify-center mb-6">
              <ExclamationTriangleIcon className="w-8 h-8 text-red-500" />
            </div>
          </div>
        </div>
        <h3 className="text-xl font-semibold text-slate-900 dark:text-white mb-2">
          Error loading image details
        </h3>
        <p className="text-slate-600 dark:text-slate-400 mb-6">
          {error?.message || 'Unable to fetch container image information.'}
        </p>
        <button
          onClick={() => refetch()}
          disabled={isFetching}
          className="inline-flex items-center px-6 py-3 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 disabled:opacity-50 text-white rounded-xl shadow-lg hover:shadow-xl transition-all duration-200"
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
            <div className="mx-auto w-16 h-16 bg-gradient-to-br from-slate-100 to-slate-200 dark:from-slate-800 dark:to-slate-700 rounded-2xl flex items-center justify-center mb-6">
              <CubeIcon className="w-8 h-8 text-slate-400 dark:text-slate-500" />
            </div>
          </div>
        </div>
        <h3 className="text-xl font-semibold text-slate-900 dark:text-white mb-2">
          No images found
        </h3>
        <p className="text-slate-600 dark:text-slate-400">
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
      <div className="bg-white/70 dark:bg-slate-800/70 backdrop-blur-sm rounded-2xl border border-slate-200/50 dark:border-slate-700/50 p-6">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold text-slate-900 dark:text-white">
              Container Images
            </h3>
            <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
              {totalImages} container{totalImages !== 1 ? 's' : ''} using {uniqueImages} unique
              image{uniqueImages !== 1 ? 's' : ''}
            </p>
          </div>

          <button
            onClick={() => refetch()}
            disabled={isFetching}
            className="flex items-center space-x-2 px-3 py-2 text-sm font-medium text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white border border-slate-200 dark:border-slate-700 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
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
