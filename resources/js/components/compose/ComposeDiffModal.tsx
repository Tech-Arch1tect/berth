import React, { useMemo } from 'react';
import { XMarkIcon } from '@heroicons/react/24/outline';
import ReactDiffViewer from 'react-diff-viewer-continued';
import { cn } from '../../utils/cn';
import { theme } from '../../theme';
import { getDiffViewerTheme } from './diffViewerTheme';

interface ComposeDiffModalProps {
  original: string;
  preview: string;
  onConfirm: () => void;
  onCancel: () => void;
  isLoading?: boolean;
}

export const ComposeDiffModal: React.FC<ComposeDiffModalProps> = ({
  original,
  preview,
  onConfirm,
  onCancel,
  isLoading = false,
}) => {
  const hasChanges = original !== preview;

  const isDarkMode = useMemo(() => {
    return document.documentElement.classList.contains('dark');
  }, []);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className={cn('w-full max-w-6xl mx-4 rounded-lg shadow-xl', theme.surface.panel)}>
        <div
          className={cn(
            'flex items-center justify-between px-6 py-4 border-b border-zinc-200 dark:border-zinc-800'
          )}
        >
          <h2 className={cn('text-xl font-semibold', theme.text.strong)}>
            Preview Compose File Changes
          </h2>
          <button
            onClick={onCancel}
            className={cn('transition-colors', theme.text.muted, 'hover:' + theme.text.strong)}
          >
            <XMarkIcon className="h-6 w-6" />
          </button>
        </div>

        <div className="max-h-[70vh] overflow-auto">
          {!hasChanges ? (
            <div className={cn('text-center py-8', theme.text.muted)}>No changes detected</div>
          ) : (
            <ReactDiffViewer
              oldValue={original}
              newValue={preview}
              splitView={true}
              useDarkTheme={isDarkMode}
              leftTitle="Original"
              rightTitle="Preview"
              styles={getDiffViewerTheme(isDarkMode)}
            />
          )}
        </div>

        <div
          className={cn(
            'flex items-center justify-end gap-3 px-6 py-4 border-t border-zinc-200 dark:border-zinc-800'
          )}
        >
          <button onClick={onCancel} className={theme.buttons.secondary} disabled={isLoading}>
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={isLoading || !hasChanges}
            className={cn('px-6 py-2.5', theme.brand.composeButton)}
          >
            {isLoading ? 'Saving...' : 'Confirm & Save'}
          </button>
        </div>
      </div>
    </div>
  );
};
