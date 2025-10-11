import React, { useState } from 'react';
import { FileEntry, FileOperation } from '../../types/files';
import { FileIcon } from './FileIcon';
import { cn } from '../../utils/cn';
import { theme } from '../../theme';

interface FileListProps {
  entries: FileEntry[];
  onNavigate: (path: string) => void;
  onFileSelect: (entry: FileEntry) => void;
  onFileOperation: (operation: FileOperation, entry?: FileEntry) => void;
  onDownload?: (entry: FileEntry) => void;
  currentPath: string;
  canWrite: boolean;
}

export const FileList: React.FC<FileListProps> = ({
  entries,
  onNavigate,
  onFileSelect,
  onFileOperation,
  onDownload,
  currentPath,
  canWrite,
}) => {
  const [_selectedEntry, setSelectedEntry] = useState<FileEntry | null>(null);
  const [hoveredEntry, setHoveredEntry] = useState<string | null>(null);

  const formatSize = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-GB', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getRelativeTime = (dateString: string) => {
    const now = new Date();
    const date = new Date(dateString);
    const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);

    if (diffInSeconds < 60) return 'Just now';
    if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)} min ago`;
    if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)} hr ago`;
    if (diffInSeconds < 604800) return `${Math.floor(diffInSeconds / 86400)} days ago`;
    return formatDate(dateString);
  };

  const handleEntryClick = (entry: FileEntry) => {
    if (entry.is_directory) {
      onNavigate(entry.path);
    } else {
      onFileSelect(entry);
    }
  };

  const handleContextMenu = (e: React.MouseEvent, entry: FileEntry) => {
    e.preventDefault();
    setSelectedEntry(entry);
  };

  return (
    <div className="h-full bg-transparent overflow-hidden">
      {/* Header */}
      <div
        className={cn(
          'px-4 py-3 border-b',
          theme.surface.panel,
          'border-slate-200/20 dark:border-slate-700/20'
        )}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div
              className={cn(
                'w-8 h-8 rounded-lg flex items-center justify-center',
                theme.brand.accent
              )}
            >
              <svg
                className="w-4 h-4 text-white"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2H5a2 2 0 00-2-2z"
                />
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M8 1v4M16 1v4"
                />
              </svg>
            </div>
            <div>
              <h3 className={cn('text-lg font-semibold', theme.text.strong)}>Files</h3>
              <p className={cn('text-xs', theme.text.subtle)}>{entries?.length || 0} items</p>
            </div>
          </div>

          {/* Create Archive Button */}
          {canWrite && entries && entries.length > 0 && (
            <button
              onClick={() => onFileOperation('create_archive')}
              className={cn(
                'px-3 py-1.5 text-sm font-medium rounded-lg transition-all duration-200 flex items-center space-x-2',
                theme.toolbar.buttonWarning
              )}
              title="Create Archive"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8M5 8l7-7 7 7M5 8h14"
                />
              </svg>
              <span className="hidden sm:inline">Create Archive</span>
            </button>
          )}
        </div>

        {/* Modern Breadcrumb */}
        {currentPath && (
          <div className="flex items-center mt-4 text-sm">
            <div
              className={cn(
                'flex items-center rounded-lg px-3 py-2 space-x-2',
                theme.intent.neutral.surfaceSoft
              )}
            >
              <svg
                className={cn('w-4 h-4', theme.text.subtle)}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2H5a2 2 0 00-2-2z"
                />
              </svg>
              <button
                onClick={() => onNavigate('')}
                className={cn(
                  'px-2 py-1 rounded transition-all duration-200',
                  theme.text.muted,
                  'hover:' + theme.text.info,
                  'hover:' + theme.intent.info.surface
                )}
              >
                Root
              </button>
              {currentPath
                .split('/')
                .filter(Boolean)
                .map((segment, index, array) => {
                  const segmentPath = array.slice(0, index + 1).join('/');
                  return (
                    <React.Fragment key={segmentPath}>
                      <svg
                        className={cn('w-3 h-3', theme.text.subtle)}
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M9 5l7 7-7 7"
                        />
                      </svg>
                      <button
                        onClick={() => onNavigate(segmentPath)}
                        className={cn(
                          'px-2 py-1 rounded transition-all duration-200 max-w-32 truncate',
                          theme.text.muted,
                          'hover:' + theme.text.info,
                          'hover:' + theme.intent.info.surface
                        )}
                      >
                        {segment}
                      </button>
                    </React.Fragment>
                  );
                })}
            </div>
          </div>
        )}
      </div>

      {!entries || entries.length === 0 ? (
        <div className="flex-1 flex items-center justify-center p-12">
          <div className="text-center">
            <div className="relative mb-6">
              <div className="absolute inset-0 flex items-center justify-center">
                <div className={cn('w-32 h-32 rounded-full opacity-50', theme.effects.emptyAura)} />
              </div>
              <div className="relative">
                <div
                  className={cn(
                    'w-20 h-20 rounded-2xl flex items-center justify-center mx-auto',
                    'bg-gradient-to-br from-slate-100 to-slate-200 dark:from-slate-800 dark:to-slate-700'
                  )}
                >
                  <svg
                    className={theme.text.subtle}
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2H5a2 2 0 00-2-2z"
                    />
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M8 1v4M16 1v4"
                    />
                  </svg>
                </div>
              </div>
            </div>
            <h3 className={cn('text-xl font-semibold mb-3', theme.text.strong)}>
              Directory is empty
            </h3>
            <p className={cn('mb-6 max-w-sm', theme.text.muted)}>
              {canWrite
                ? 'Create your first file or folder to get started with this directory.'
                : 'No files or folders found in this directory.'}
            </p>
            {canWrite && (
              <div className="flex flex-col sm:flex-row gap-3 justify-center">
                <button
                  onClick={() => onFileOperation('create')}
                  className={cn(
                    'px-4 py-2 text-sm font-medium rounded-lg shadow-sm hover:shadow-md transition-all duration-200 flex items-center justify-center space-x-2',
                    theme.brand.accent
                  )}
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M9 12h6m-3-3v6m5 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                    />
                  </svg>
                  <span>Create File</span>
                </button>
                <button
                  onClick={() => onFileOperation('mkdir')}
                  className={cn(
                    'px-4 py-2 text-sm font-medium rounded-lg transition-all duration-200 flex items-center justify-center space-x-2',
                    theme.buttons.secondary
                  )}
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M12 6v6m0 0v6m0-6h6m-6 0H6"
                    />
                  </svg>
                  <span>Create Folder</span>
                </button>
                <button
                  onClick={() => onFileOperation('create_archive')}
                  className={cn(
                    'px-4 py-2 text-sm font-medium rounded-lg transition-all duration-200 flex items-center justify-center space-x-2',
                    theme.toolbar.buttonWarning
                  )}
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8M5 8l7-7 7 7M5 8h14"
                    />
                  </svg>
                  <span>Create Archive</span>
                </button>
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="flex-1 overflow-hidden">
          <div className="h-full overflow-y-auto">
            <div className="p-3 space-y-2">
              {/* Parent directory link */}
              {currentPath && (
                <div
                  className={cn(
                    'group rounded-lg p-3 transition-all duration-200 border cursor-pointer',
                    'bg-white dark:bg-zinc-800',
                    'border-zinc-200 dark:border-zinc-700',
                    'hover:shadow-md hover:border-teal-300 dark:hover:border-teal-600',
                    'hover:bg-teal-50 dark:hover:bg-teal-900/20'
                  )}
                >
                  <button
                    onClick={() => {
                      const parentPath = currentPath.split('/').slice(0, -1).join('/');
                      onNavigate(parentPath);
                    }}
                    className={cn(
                      'flex items-center w-full text-left transition-colors',
                      'group-hover:' + theme.text.info
                    )}
                  >
                    <div
                      className={cn(
                        'flex items-center justify-center w-10 h-10 rounded-lg mr-4 transition-all',
                        theme.iconBackground.neutral,
                        'group-hover:' + theme.iconBackground.info.replace('rounded-lg ', '')
                      )}
                    >
                      <svg
                        className={cn('w-5 h-5', theme.text.muted, 'group-hover:text-white')}
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M15 19l-7-7 7-7"
                        />
                      </svg>
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center space-x-2">
                        <span
                          className={cn(
                            'font-medium',
                            theme.text.standard,
                            'group-hover:' + theme.text.info
                          )}
                        >
                          ..
                        </span>
                        <span
                          className={cn(
                            'text-sm',
                            theme.text.subtle,
                            'group-hover:' + theme.text.info
                          )}
                        >
                          (Parent Directory)
                        </span>
                      </div>
                    </div>
                  </button>
                </div>
              )}

              {entries &&
                entries.map((entry) => (
                  <div
                    key={entry.path}
                    className={cn(
                      'group rounded-lg p-3 transition-all duration-200 cursor-pointer border',
                      'bg-white dark:bg-zinc-800',
                      'border-zinc-200 dark:border-zinc-700',
                      'hover:shadow-md hover:border-teal-300 dark:hover:border-teal-600',
                      'hover:bg-teal-50 dark:hover:bg-teal-900/20',
                      hoveredEntry === entry.path
                        ? 'shadow-md scale-[1.005]'
                        : 'hover:scale-[1.002]'
                    )}
                    onClick={() => handleEntryClick(entry)}
                    onContextMenu={(e) => handleContextMenu(e, entry)}
                    onMouseEnter={() => setHoveredEntry(entry.path)}
                    onMouseLeave={() => setHoveredEntry(null)}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-4 flex-1 min-w-0">
                        {/* Modern File Icon */}
                        <div className="flex-shrink-0">
                          <div
                            className={cn(
                              'w-12 h-12 rounded-xl flex items-center justify-center transition-all duration-200',
                              entry.is_directory
                                ? theme.iconBackground.info
                                : theme.iconBackground.neutral
                            )}
                          >
                            <FileIcon
                              fileName={entry.name}
                              isDirectory={entry.is_directory}
                              className="w-6 h-6 text-white"
                            />
                          </div>
                        </div>

                        {/* File Info */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center space-x-2 mb-1">
                            <h4
                              className={cn(
                                'font-semibold transition-colors truncate',
                                theme.text.strong
                              )}
                            >
                              {entry.name}
                            </h4>
                            {entry.extension && (
                              <span
                                className={cn(
                                  'px-2 py-0.5 text-xs font-medium rounded-md uppercase',
                                  theme.badges.tag.base,
                                  theme.badges.tag.neutral
                                )}
                              >
                                {entry.extension}
                              </span>
                            )}
                          </div>

                          <div
                            className={cn('flex items-center space-x-4 text-sm', theme.text.subtle)}
                          >
                            <div className="flex items-center space-x-1">
                              <svg
                                className="w-3 h-3"
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                              >
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  strokeWidth={2}
                                  d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7c0-2.21-3.582-4-8-4s-8 1.79-8 4z"
                                />
                              </svg>
                              <span>{entry.is_directory ? '—' : formatSize(entry.size)}</span>
                            </div>

                            <div className="flex items-center space-x-1">
                              <svg
                                className="w-3 h-3"
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                              >
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  strokeWidth={2}
                                  d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                                />
                              </svg>
                              <span className="hidden sm:inline">
                                {getRelativeTime(entry.mod_time)}
                              </span>
                              <span className="sm:hidden">{formatDate(entry.mod_time)}</span>
                            </div>

                            <div className="flex items-center space-x-1 font-mono text-xs">
                              <svg
                                className="w-3 h-3"
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                              >
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  strokeWidth={2}
                                  d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
                                />
                              </svg>
                              <span>{entry.mode}</span>
                            </div>

                            <div className="flex items-center space-x-1 font-mono text-xs">
                              <svg
                                className="w-3 h-3"
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                              >
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  strokeWidth={2}
                                  d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                                />
                              </svg>
                              <span>
                                {entry.owner
                                  ? `${entry.owner}:${entry.group || entry.group_id}`
                                  : `${entry.owner_id}:${entry.group_id}`}
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Action Buttons */}
                      {canWrite && (
                        <div
                          className={cn(
                            'flex items-center space-x-1 transition-all duration-200',
                            hoveredEntry === entry.path
                              ? 'opacity-100 translate-x-0'
                              : 'opacity-0 translate-x-2 group-hover:opacity-100 group-hover:translate-x-0'
                          )}
                        >
                          <div
                            className={cn(
                              'flex items-center rounded-lg p-1 space-x-0.5 shadow-sm',
                              'bg-white/80 dark:bg-slate-800/80'
                            )}
                          >
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                onFileOperation('rename', entry);
                              }}
                              className={cn(
                                'p-2 rounded-md transition-all duration-200',
                                theme.text.subtle,
                                'hover:' + theme.text.info,
                                'hover:' + theme.intent.info.surface
                              )}
                              title="Rename"
                            >
                              <svg
                                className="w-4 h-4"
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                              >
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  strokeWidth={2}
                                  d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"
                                />
                              </svg>
                            </button>

                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                onFileOperation('copy', entry);
                              }}
                              className={cn(
                                'p-2 rounded-md transition-all duration-200',
                                theme.text.subtle,
                                'hover:' + theme.text.success,
                                'hover:' + theme.intent.success.surface
                              )}
                              title="Copy"
                            >
                              <svg
                                className="w-4 h-4"
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                              >
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  strokeWidth={2}
                                  d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
                                />
                              </svg>
                            </button>

                            {!entry.is_directory && onDownload && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onDownload(entry);
                                }}
                                className={cn(
                                  'p-2 rounded-md transition-all duration-200',
                                  theme.text.subtle,
                                  'hover:' + theme.text.info,
                                  'hover:' + theme.intent.info.surface
                                )}
                                title="Download"
                              >
                                <svg
                                  className="w-4 h-4"
                                  fill="none"
                                  stroke="currentColor"
                                  viewBox="0 0 24 24"
                                >
                                  <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth={2}
                                    d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                                  />
                                </svg>
                              </button>
                            )}

                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                onFileOperation('chmod', entry);
                              }}
                              className={cn(
                                'p-2 rounded-md transition-all duration-200',
                                theme.text.subtle,
                                'hover:' + theme.text.warning,
                                'hover:' + theme.intent.warning.surface
                              )}
                              title="Change Permissions"
                            >
                              <svg
                                className="w-4 h-4"
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                              >
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  strokeWidth={2}
                                  d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
                                />
                              </svg>
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                onFileOperation('chown', entry);
                              }}
                              className={cn(
                                'p-2 rounded-md transition-all duration-200',
                                theme.text.subtle,
                                'hover:' + theme.text.success,
                                'hover:' + theme.intent.success.surface
                              )}
                              title="Change Ownership"
                            >
                              <svg
                                className="w-4 h-4"
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                              >
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  strokeWidth={2}
                                  d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                                />
                              </svg>
                            </button>

                            {/* Archive extraction button for archive files */}
                            {!entry.is_directory &&
                              (entry.extension === 'zip' ||
                                entry.extension === 'tar' ||
                                entry.name.endsWith('.tar.gz')) && (
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    onFileOperation('extract_archive', entry);
                                  }}
                                  className={cn(
                                    'p-2 rounded-md transition-all duration-200',
                                    theme.text.subtle,
                                    'hover:' + theme.text.warning,
                                    'hover:' + theme.intent.warning.surface
                                  )}
                                  title="Extract Archive"
                                >
                                  <svg
                                    className="w-4 h-4"
                                    fill="none"
                                    stroke="currentColor"
                                    viewBox="0 0 24 24"
                                  >
                                    <path
                                      strokeLinecap="round"
                                      strokeLinejoin="round"
                                      strokeWidth={2}
                                      d="M5 19a2 2 0 01-2-2V7a2 2 0 012-2h4l2 2h4a2 2 0 012 2v1M5 19h14a2 2 0 002-2v-5a2 2 0 00-2-2H9a2 2 0 00-2 2v5a2 2 0 01-2 2z"
                                    />
                                  </svg>
                                </button>
                              )}

                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                onFileOperation('delete', entry);
                              }}
                              className={cn(
                                'p-2 rounded-md transition-all duration-200',
                                theme.text.subtle,
                                'hover:' + theme.text.danger,
                                'hover:' + theme.intent.danger.surface
                              )}
                              title="Delete"
                            >
                              <svg
                                className="w-4 h-4"
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                              >
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  strokeWidth={2}
                                  d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1-1H8a1 1 0 00-1 1v3M4 7h16"
                                />
                              </svg>
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
