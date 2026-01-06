import React from 'react';
import { cn } from '../../../utils/cn';
import { theme } from '../../../theme';

interface ImageFieldProps {
  image: string | undefined;
  onChange: (image: string | undefined) => void;
  disabled?: boolean;
}

export const ImageField: React.FC<ImageFieldProps> = ({ image, onChange, disabled }) => {
  const parseImage = (img: string | undefined) => {
    if (!img) return { registry: '', name: '', tag: '' };

    let registry = '';
    let name = img;
    let tag = 'latest';

    const tagIndex = name.lastIndexOf(':');
    if (tagIndex !== -1 && !name.substring(tagIndex).includes('/')) {
      tag = name.substring(tagIndex + 1);
      name = name.substring(0, tagIndex);
    }

    const firstSlash = name.indexOf('/');
    if (firstSlash !== -1) {
      const potential = name.substring(0, firstSlash);
      if (potential.includes('.') || potential.includes(':') || potential === 'localhost') {
        registry = potential;
        name = name.substring(firstSlash + 1);
      }
    }

    return { registry, name, tag };
  };

  const parsed = parseImage(image);

  return (
    <div className="space-y-2">
      <label className={cn('block text-sm font-medium', theme.text.muted)}>Image</label>
      <input
        type="text"
        value={image || ''}
        onChange={(e) => onChange(e.target.value || undefined)}
        disabled={disabled}
        placeholder="nginx:latest"
        className={cn(
          'w-full px-3 py-2 text-sm rounded-lg border font-mono',
          'bg-white text-zinc-900 placeholder:text-zinc-400',
          'dark:bg-zinc-900 dark:text-white dark:placeholder:text-zinc-500',
          'border-zinc-200 dark:border-zinc-700',
          'focus:border-teal-500 focus:ring-1 focus:ring-teal-500',
          'disabled:opacity-50 disabled:cursor-not-allowed'
        )}
      />
      {image && (
        <div className={cn('flex items-center gap-2 text-xs', theme.text.subtle)}>
          {parsed.registry && (
            <>
              <span className="px-1.5 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800">
                {parsed.registry}
              </span>
              <span>/</span>
            </>
          )}
          <span className="font-medium">{parsed.name}</span>
          <span>:</span>
          <span className="px-1.5 py-0.5 rounded bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-400">
            {parsed.tag}
          </span>
        </div>
      )}
    </div>
  );
};
