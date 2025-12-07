import React, { useState } from 'react';
import { ComposeService } from '../../types/stack';
import { ArrowLeftIcon, CheckIcon, PhotoIcon } from '@heroicons/react/24/outline';
import { cn } from '../../utils/cn';
import { theme } from '../../theme';

interface ServiceImageEditorProps {
  service: ComposeService;
  onUpdate: (serviceName: string, imageTag?: string, fullImage?: string) => void;
  onBack: () => void;
}

const extractTagFromImage = (image: string | undefined): string => {
  if (image && image.includes(':')) {
    const parts = image.split(':');
    return parts[parts.length - 1];
  }
  return 'latest';
};

export const ServiceImageEditor: React.FC<ServiceImageEditorProps> = ({
  service,
  onUpdate,
  onBack,
}) => {
  const [editMode, setEditMode] = useState<'tag' | 'full'>('tag');
  const [imageTag, setImageTag] = useState(() => extractTagFromImage(service.image));
  const [fullImage, setFullImage] = useState(service.image || '');
  const [prevServiceImage, setPrevServiceImage] = useState(service.image);

  if (service.image !== prevServiceImage) {
    setPrevServiceImage(service.image);
    setImageTag(extractTagFromImage(service.image));
    setFullImage(service.image || '');
  }

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
          className={cn(
            'flex items-center gap-2 transition-colors mb-6',
            theme.text.muted,
            'hover:' + theme.text.strong
          )}
        >
          <ArrowLeftIcon className="h-5 w-5" />
          Back
        </button>

        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <div className={theme.iconBackground.primary}>
              <PhotoIcon className="h-6 w-6" />
            </div>
            <h3 className={cn('text-2xl font-bold', theme.text.strong)}>Edit Image</h3>
          </div>
          <p className={theme.text.muted}>
            Service: <span className="font-semibold">{service.name}</span>
          </p>
        </div>

        {/* Current Image */}
        <div
          className={cn(
            'mb-8 p-4 rounded-lg border',
            theme.surface.muted,
            'border-zinc-200 dark:border-zinc-800'
          )}
        >
          <label className={cn('block text-sm font-medium mb-2', theme.forms.label)}>
            Current Image
          </label>
          <div
            className={cn(
              'font-mono text-sm px-4 py-2 rounded-lg border-2',
              theme.surface.panel,
              theme.text.strong,
              'border-zinc-200 dark:border-zinc-700'
            )}
          >
            {service.image || 'No image specified'}
          </div>
        </div>

        {/* Edit Mode Selector */}
        <div className="mb-6">
          <label className={cn('block text-sm font-medium mb-3', theme.forms.label)}>
            Edit Mode
          </label>
          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={() => setEditMode('tag')}
              className={cn(
                theme.selection.tile.base,
                editMode === 'tag' ? theme.selection.tile.selected : theme.selection.tile.unselected
              )}
            >
              <div className={cn('font-semibold mb-1', theme.text.strong)}>Change Tag Only</div>
              <div className={cn('text-xs', theme.text.muted)}>Update image version/tag</div>
            </button>
            <button
              onClick={() => setEditMode('full')}
              className={cn(
                theme.selection.tile.base,
                editMode === 'full'
                  ? theme.selection.tile.selected
                  : theme.selection.tile.unselected
              )}
            >
              <div className={cn('font-semibold mb-1', theme.text.strong)}>Full Image</div>
              <div className={cn('text-xs', theme.text.muted)}>Change entire image reference</div>
            </button>
          </div>
        </div>

        {/* Tag Editor */}
        {editMode === 'tag' && (
          <div className="space-y-4">
            <div>
              <label className={cn('block text-sm font-medium mb-2', theme.forms.label)}>
                New Tag
              </label>
              <input
                type="text"
                value={imageTag}
                onChange={(e) => setImageTag(e.target.value)}
                placeholder="e.g., latest, stable, v1.2.3"
                className={cn('w-full px-4 py-3 rounded-lg transition-shadow', theme.forms.input)}
              />
            </div>

            {/* Common Tags */}
            <div>
              <label className={cn('block text-sm font-medium mb-2', theme.forms.label)}>
                Quick Select
              </label>
              <div className="flex flex-wrap gap-2">
                {commonTags.map((tag) => (
                  <button
                    key={tag}
                    onClick={() => setImageTag(tag)}
                    className={
                      imageTag === tag
                        ? cn(theme.buttons.primary, theme.buttons.sm)
                        : cn(theme.buttons.secondary, theme.buttons.sm)
                    }
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
            <label className={cn('block text-sm font-medium mb-2', theme.forms.label)}>
              Full Image Reference
            </label>
            <input
              type="text"
              value={fullImage}
              onChange={(e) => setFullImage(e.target.value)}
              placeholder="e.g., nginx:stable, registry.example.com/app:v1.0"
              className={cn(
                'w-full px-4 py-3 rounded-lg font-mono transition-shadow',
                theme.forms.input
              )}
            />
            <p className={cn('mt-2 text-sm', theme.text.muted)}>
              Include registry, repository, and tag
            </p>
          </div>
        )}

        {/* Preview */}
        <div className={cn('mt-8 p-6 rounded-xl', theme.brand.composePreview)}>
          <label className={cn('block text-sm font-semibold mb-3', theme.text.info)}>Preview</label>
          <div
            className={cn(
              'font-mono text-lg px-4 py-3 rounded-lg shadow-sm',
              theme.surface.panel,
              theme.text.strong
            )}
          >
            {getPreviewImage() || 'Enter an image...'}
          </div>
        </div>

        {/* Actions */}
        <div className="mt-8 flex items-center justify-end gap-3">
          <button onClick={onBack} className={theme.buttons.secondary}>
            Cancel
          </button>
          <button
            onClick={handleApply}
            disabled={!isValid()}
            className={cn(
              theme.brand.composeButton,
              'inline-flex items-center gap-2',
              'disabled:opacity-50 disabled:cursor-not-allowed'
            )}
          >
            <CheckIcon className="h-5 w-5" />
            Apply Changes
          </button>
        </div>
      </div>
    </div>
  );
};
