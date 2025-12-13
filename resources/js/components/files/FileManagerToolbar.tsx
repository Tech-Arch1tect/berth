import React from 'react';
import { cn } from '../../utils/cn';
import { theme } from '../../theme';

interface FileManagerToolbarProps {
  canRead: boolean;
  canWrite: boolean;
  onCreateFolder: () => void;
  onCreateFile: () => void;
  onUpload: () => void;
}

export const FileManagerToolbar: React.FC<FileManagerToolbarProps> = ({
  canRead,
  canWrite,
  onCreateFolder,
  onCreateFile,
  onUpload,
}) => {
  return (
    <div className={cn('backdrop-blur-xl border-b px-6 py-4', theme.surface.panel)}>
      <div className="flex items-center justify-between">
        {/* Header */}
        <div className="flex items-center space-x-2 flex-1 min-w-0">
          <div className={cn('flex items-center space-x-1 text-sm', theme.text.muted)}>
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2H5a2 2 0 00-2-2z"
              />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 1v4" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 1v4" />
            </svg>
            <span className="font-medium">Stack Files</span>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center space-x-2">
          {/* Permissions Badge */}
          <div
            className={cn(
              'flex items-center space-x-2 px-3 py-1.5 rounded-lg text-xs font-medium',
              theme.intent.neutral.surfaceSoft,
              theme.text.muted
            )}
          >
            <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
              <path
                fillRule="evenodd"
                d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z"
                clipRule="evenodd"
              />
            </svg>
            <span>
              {canRead && 'Read'}
              {canRead && canWrite && ' + Write'}
              {!canRead && 'No Access'}
            </span>
          </div>

          {canWrite && (
            <div className="flex items-center space-x-1">
              <div
                className={cn(
                  'flex items-center rounded-lg p-1 space-x-1',
                  theme.intent.neutral.surfaceSoft
                )}
              >
                <button
                  onClick={onCreateFolder}
                  className={cn(
                    'px-3 py-2 text-sm font-medium rounded-md transition-all duration-200 flex items-center space-x-1.5',
                    theme.text.standard,
                    'hover:bg-white/80 dark:hover:bg-slate-700/80'
                  )}
                  title="New Folder"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M12 6v6m0 0v6m0-6h6m-6 0H6"
                    />
                  </svg>
                  <span>Folder</span>
                </button>
                <button
                  onClick={onCreateFile}
                  className={cn(
                    'px-3 py-2 text-sm font-medium rounded-md transition-all duration-200 flex items-center space-x-1.5',
                    theme.text.standard,
                    'hover:bg-white/80 dark:hover:bg-slate-700/80'
                  )}
                  title="New File"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M9 12h6m-3-3v6m5 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                    />
                  </svg>
                  <span>File</span>
                </button>
              </div>
              <button
                onClick={onUpload}
                className={cn(
                  'px-3 py-2 text-sm font-medium rounded-lg shadow-sm hover:shadow-md transition-all duration-200 flex items-center space-x-2',
                  theme.brand.accent
                )}
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
                  />
                </svg>
                <span>Upload</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
