import React, { useState, useEffect } from 'react';
import { ComposeService } from '../../types/stack';
import { ArrowLeftIcon, CheckIcon, XMarkIcon, PhotoIcon } from '@heroicons/react/24/outline';

interface ServiceImageEditorProps {
  service: ComposeService;
  onUpdate: (serviceName: string, imageTag?: string, fullImage?: string) => void;
  onBack: () => void;
}

export const ServiceImageEditor: React.FC<ServiceImageEditorProps> = ({
  service,
  onUpdate,
  onBack,
}) => {
  const [editMode, setEditMode] = useState<'tag' | 'full'>('tag');
  const [imageTag, setImageTag] = useState('');
  const [fullImage, setFullImage] = useState(service.image || '');

  // Parse current image to extract tag
  useEffect(() => {
    if (service.image && service.image.includes(':')) {
      const parts = service.image.split(':');
      setImageTag(parts[parts.length - 1]);
    } else {
      setImageTag('latest');
    }
  }, [service.image]);

  const getCurrentImageName = () => {
    if (!service.image) return '';
    return service.image.includes(':')
      ? service.image.substring(0, service.image.lastIndexOf(':'))
      : service.image;
  };

  const getPreviewImage = () => {
    if (editMode === 'tag') {
      const baseName = getCurrentImageName();
      return `${baseName}:${imageTag}`;
    }
    return fullImage;
  };

  const handleApply = () => {
    if (editMode === 'tag') {
      onUpdate(service.name, imageTag);
    } else {
      onUpdate(service.name, undefined, fullImage);
    }
    onBack();
  };

  const isValid = () => {
    if (editMode === 'tag') {
      return imageTag.trim().length > 0;
    }
    return fullImage.trim().length > 0;
  };

  const commonTags = ['latest', 'stable', 'alpine', 'lts', 'edge', 'mainline', '1', '2', '3'];

  return (
    <div className="p-8">
      <div className="max-w-3xl mx-auto">
        {/* Header */}
        <button
          onClick={onBack}
          className="flex items-center gap-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors mb-6"
        >
          <ArrowLeftIcon className="h-5 w-5" />
          Back
        </button>

        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <div className="rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 p-2 text-white">
              <PhotoIcon className="h-6 w-6" />
            </div>
            <h3 className="text-2xl font-bold text-gray-900 dark:text-white">Edit Image</h3>
          </div>
          <p className="text-gray-600 dark:text-gray-400">
            Service: <span className="font-semibold">{service.name}</span>
          </p>
        </div>

        {/* Current Image */}
        <div className="mb-8 p-4 rounded-lg bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Current Image
          </label>
          <div className="font-mono text-sm text-gray-900 dark:text-white bg-white dark:bg-gray-900 px-4 py-2 rounded border border-gray-300 dark:border-gray-600">
            {service.image || 'No image specified'}
          </div>
        </div>

        {/* Edit Mode Selector */}
        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
            Edit Mode
          </label>
          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={() => setEditMode('tag')}
              className={`p-4 rounded-lg border-2 text-left transition-all ${
                editMode === 'tag'
                  ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-900/20'
                  : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
              }`}
            >
              <div className="font-semibold text-gray-900 dark:text-white mb-1">
                Change Tag Only
              </div>
              <div className="text-xs text-gray-600 dark:text-gray-400">
                Update image version/tag
              </div>
            </button>
            <button
              onClick={() => setEditMode('full')}
              className={`p-4 rounded-lg border-2 text-left transition-all ${
                editMode === 'full'
                  ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-900/20'
                  : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
              }`}
            >
              <div className="font-semibold text-gray-900 dark:text-white mb-1">Full Image</div>
              <div className="text-xs text-gray-600 dark:text-gray-400">
                Change entire image reference
              </div>
            </button>
          </div>
        </div>

        {/* Tag Editor */}
        {editMode === 'tag' && (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                New Tag
              </label>
              <input
                type="text"
                value={imageTag}
                onChange={(e) => setImageTag(e.target.value)}
                placeholder="e.g., latest, stable, v1.2.3"
                className="w-full px-4 py-3 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-shadow"
              />
            </div>

            {/* Common Tags */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Quick Select
              </label>
              <div className="flex flex-wrap gap-2">
                {commonTags.map((tag) => (
                  <button
                    key={tag}
                    onClick={() => setImageTag(tag)}
                    className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                      imageTag === tag
                        ? 'bg-indigo-600 text-white'
                        : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                    }`}
                  >
                    {tag}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Full Image Editor */}
        {editMode === 'full' && (
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Full Image Reference
            </label>
            <input
              type="text"
              value={fullImage}
              onChange={(e) => setFullImage(e.target.value)}
              placeholder="e.g., nginx:stable, registry.example.com/app:v1.0"
              className="w-full px-4 py-3 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white font-mono focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-shadow"
            />
            <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
              Include registry, repository, and tag
            </p>
          </div>
        )}

        {/* Preview */}
        <div className="mt-8 p-6 rounded-xl bg-gradient-to-br from-indigo-50 to-purple-50 dark:from-indigo-900/20 dark:to-purple-900/20 border border-indigo-200 dark:border-indigo-800">
          <label className="block text-sm font-semibold text-indigo-900 dark:text-indigo-300 mb-3">
            Preview
          </label>
          <div className="font-mono text-lg text-indigo-900 dark:text-indigo-100 bg-white dark:bg-gray-900 px-4 py-3 rounded-lg shadow-sm">
            {getPreviewImage() || 'Enter an image...'}
          </div>
        </div>

        {/* Actions */}
        <div className="mt-8 flex items-center justify-end gap-3">
          <button
            onClick={onBack}
            className="px-6 py-2.5 text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleApply}
            disabled={!isValid()}
            className="inline-flex items-center gap-2 px-6 py-2.5 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-lg hover:from-indigo-700 hover:to-purple-700 transition-all shadow-md hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <CheckIcon className="h-5 w-5" />
            Apply Changes
          </button>
        </div>
      </div>
    </div>
  );
};
