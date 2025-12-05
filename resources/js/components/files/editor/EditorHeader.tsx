import React from 'react';
import { OpenTab } from '../../../types/files';
import { cn } from '../../../utils/cn';
import { theme } from '../../../theme';

interface EditorHeaderProps {
  tab: OpenTab;
  canWrite: boolean;
  isSaving: boolean;
  onSave: () => void;
}

export const EditorHeader: React.FC<EditorHeaderProps> = ({ tab, canWrite, isSaving, onSave }) => {
  const formatSize = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  return (
    <div
      className={cn(
        'flex-shrink-0 flex items-center justify-between px-4 py-2',
        theme.surface.muted,
        'border-b border-zinc-200 dark:border-zinc-800'
      )}
    >
      <div className="flex items-center gap-3 min-w-0">
        <span className={cn('text-sm font-medium truncate', theme.text.standard)} title={tab.path}>
          {tab.path}
        </span>

        <div className="flex items-center gap-2">
          <span className={cn('text-xs', theme.text.subtle)}>{formatSize(tab.size)}</span>
          <span className={cn('text-xs capitalize', theme.text.subtle)}>{tab.encoding}</span>
          {tab.isDirty && (
            <span className={cn('text-xs font-medium', theme.text.warning)}>Modified</span>
          )}
          {!canWrite && (
            <span className={cn(theme.badges.tag.base, theme.badges.tag.neutral)}>Read-only</span>
          )}
        </div>
      </div>

      <div className="flex items-center gap-2">
        {canWrite && (
          <button
            onClick={onSave}
            disabled={!tab.isDirty || isSaving}
            className={cn(
              'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-semibold',
              'transition-all shadow-sm',
              tab.isDirty && !isSaving
                ? 'bg-teal-600 text-white hover:bg-teal-700 hover:shadow-md'
                : 'bg-zinc-200 text-zinc-400 dark:bg-zinc-700 dark:text-zinc-500 cursor-not-allowed'
            )}
          >
            {isSaving ? (
              <>
                <span className={theme.effects.spinnerSm} />
                Saving...
              </>
            ) : (
              <>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4"
                  />
                </svg>
                Save
              </>
            )}
          </button>
        )}
      </div>
    </div>
  );
};
