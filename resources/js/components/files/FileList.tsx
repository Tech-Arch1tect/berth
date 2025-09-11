import React, { useState } from 'react';
import { FileEntry, FileOperation } from '../../types/files';
import { FileIcon } from './FileIcon';

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
      <div className="px-4 py-3 bg-gradient-to-r from-slate-50/50 to-blue-50/50 dark:from-slate-800/30 dark:to-blue-900/20 border-b border-slate-200/20 dark:border-slate-700/20">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 bg-gradient-to-r from-blue-500 to-purple-500 rounded-lg flex items-center justify-center">
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
              <h3 className="text-lg font-semibold text-slate-900 dark:text-white">Files</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {entries?.length || 0} items
              </p>
            </div>
          </div>

          {/* Create Archive Button */}
          {canWrite && entries && entries.length > 0 && (
            <button
              onClick={() => onFileOperation('create_archive')}
              className="px-3 py-1.5 bg-orange-100/70 dark:bg-orange-900/30 hover:bg-orange-200/70 dark:hover:bg-orange-800/40 text-orange-700 dark:text-orange-300 text-sm font-medium rounded-lg transition-all duration-200 flex items-center space-x-2"
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
            <div className="flex items-center bg-slate-100/50 dark:bg-slate-800/50 rounded-lg px-3 py-2 space-x-2">
              <svg
                className="w-4 h-4 text-slate-500"
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
                className="px-2 py-1 text-slate-600 dark:text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-blue-50/50 dark:hover:bg-blue-900/30 rounded transition-all duration-200"
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
                        className="w-3 h-3 text-slate-400"
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
                        className="px-2 py-1 text-slate-600 dark:text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-blue-50/50 dark:hover:bg-blue-900/30 rounded transition-all duration-200 max-w-32 truncate"
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
                <div className="w-32 h-32 bg-gradient-to-r from-blue-100 to-purple-100 dark:from-blue-900/20 dark:to-purple-900/20 rounded-full opacity-50" />
              </div>
              <div className="relative">
                <div className="w-20 h-20 bg-gradient-to-br from-slate-100 to-slate-200 dark:from-slate-800 dark:to-slate-700 rounded-2xl flex items-center justify-center mx-auto">
                  <svg
                    className="w-10 h-10 text-slate-400 dark:text-slate-500"
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
            <h3 className="text-xl font-semibold text-slate-900 dark:text-white mb-3">
              Directory is empty
            </h3>
            <p className="text-slate-600 dark:text-slate-400 mb-6 max-w-sm">
              {canWrite
                ? 'Create your first file or folder to get started with this directory.'
                : 'No files or folders found in this directory.'}
            </p>
            {canWrite && (
              <div className="flex flex-col sm:flex-row gap-3 justify-center">
                <button
                  onClick={() => onFileOperation('create')}
                  className="px-4 py-2 bg-gradient-to-r from-blue-500 to-purple-500 hover:from-blue-600 hover:to-purple-600 text-white text-sm font-medium rounded-lg shadow-sm hover:shadow-md transition-all duration-200 flex items-center justify-center space-x-2"
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
                  className="px-4 py-2 bg-slate-100/70 dark:bg-slate-800/70 hover:bg-slate-200/70 dark:hover:bg-slate-700/70 text-slate-700 dark:text-slate-300 text-sm font-medium rounded-lg transition-all duration-200 flex items-center justify-center space-x-2"
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
                  className="px-4 py-2 bg-orange-100/70 dark:bg-orange-900/30 hover:bg-orange-200/70 dark:hover:bg-orange-800/40 text-orange-700 dark:text-orange-300 text-sm font-medium rounded-lg transition-all duration-200 flex items-center justify-center space-x-2"
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
                <div className="group bg-slate-50/30 dark:bg-slate-800/30 hover:bg-blue-50/40 dark:hover:bg-blue-900/20 rounded-lg p-3 transition-all duration-200 border border-slate-200/30 dark:border-slate-700/30 hover:border-blue-200/40 dark:hover:border-blue-800/40">
                  <button
                    onClick={() => {
                      const parentPath = currentPath.split('/').slice(0, -1).join('/');
                      onNavigate(parentPath);
                    }}
                    className="flex items-center w-full text-left group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors"
                  >
                    <div className="flex items-center justify-center w-10 h-10 bg-gradient-to-br from-slate-200 to-slate-300 dark:from-slate-700 dark:to-slate-600 rounded-lg mr-4 group-hover:from-blue-200 group-hover:to-blue-300 dark:group-hover:from-blue-800 dark:group-hover:to-blue-700 transition-all">
                      <svg
                        className="w-5 h-5 text-slate-600 dark:text-slate-400 group-hover:text-blue-600 dark:group-hover:text-blue-400"
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
                        <span className="font-medium text-slate-700 dark:text-slate-300 group-hover:text-blue-600 dark:group-hover:text-blue-400">
                          ..
                        </span>
                        <span className="text-sm text-slate-500 dark:text-slate-400 group-hover:text-blue-500 dark:group-hover:text-blue-400">
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
                    className={`group bg-white/40 dark:bg-slate-800/40 hover:bg-blue-50/60 dark:hover:bg-blue-900/25 rounded-lg p-3 transition-all duration-200 cursor-pointer border border-slate-200/20 dark:border-slate-700/20 hover:border-blue-200/40 dark:hover:border-blue-700/40 hover:shadow-md ${
                      hoveredEntry === entry.path
                        ? 'shadow-md scale-[1.005]'
                        : 'hover:scale-[1.002]'
                    }`}
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
                            className={`w-12 h-12 rounded-xl flex items-center justify-center transition-all duration-200 ${
                              entry.is_directory
                                ? 'bg-gradient-to-br from-blue-100 to-blue-200 dark:from-blue-900/50 dark:to-blue-800/50 group-hover:from-blue-200 group-hover:to-blue-300 dark:group-hover:from-blue-800/70 dark:group-hover:to-blue-700/70'
                                : 'bg-gradient-to-br from-slate-100 to-slate-200 dark:from-slate-700 dark:to-slate-600 group-hover:from-purple-100 group-hover:to-purple-200 dark:group-hover:from-purple-900/50 dark:group-hover:to-purple-800/50'
                            }`}
                          >
                            <FileIcon
                              fileName={entry.name}
                              isDirectory={entry.is_directory}
                              className={`w-6 h-6 transition-colors ${
                                entry.is_directory
                                  ? 'text-blue-600 dark:text-blue-400 group-hover:text-blue-700 dark:group-hover:text-blue-300'
                                  : 'text-slate-600 dark:text-slate-400 group-hover:text-purple-600 dark:group-hover:text-purple-400'
                              }`}
                            />
                          </div>
                        </div>

                        {/* File Info */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center space-x-2 mb-1">
                            <h4 className="font-semibold text-slate-900 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors truncate">
                              {entry.name}
                            </h4>
                            {entry.extension && (
                              <span className="px-2 py-0.5 text-xs font-medium bg-slate-100/70 dark:bg-slate-700/70 text-slate-600 dark:text-slate-400 rounded-md uppercase">
                                {entry.extension}
                              </span>
                            )}
                          </div>

                          <div className="flex items-center space-x-4 text-sm text-slate-500 dark:text-slate-400">
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
                          className={`flex items-center space-x-1 transition-all duration-200 ${hoveredEntry === entry.path ? 'opacity-100 translate-x-0' : 'opacity-0 translate-x-2 group-hover:opacity-100 group-hover:translate-x-0'}`}
                        >
                          <div className="flex items-center bg-white/80 dark:bg-slate-800/80 rounded-lg p-1 space-x-0.5 shadow-sm">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                onFileOperation('rename', entry);
                              }}
                              className="p-2 text-slate-500 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-blue-50/80 dark:hover:bg-blue-900/30 rounded-md transition-all duration-200"
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
                              className="p-2 text-slate-500 hover:text-green-600 dark:hover:text-green-400 hover:bg-green-50/80 dark:hover:bg-green-900/30 rounded-md transition-all duration-200"
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
                                className="p-2 text-slate-500 hover:text-purple-600 dark:hover:text-purple-400 hover:bg-purple-50/80 dark:hover:bg-purple-900/30 rounded-md transition-all duration-200"
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
                              className="p-2 text-slate-500 hover:text-orange-600 dark:hover:text-orange-400 hover:bg-orange-50/80 dark:hover:bg-orange-900/30 rounded-md transition-all duration-200"
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
                              className="p-2 text-slate-500 hover:text-green-600 dark:hover:text-green-400 hover:bg-green-50/80 dark:hover:bg-green-900/30 rounded-md transition-all duration-200"
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
                                  className="p-2 text-slate-500 hover:text-orange-600 dark:hover:text-orange-400 hover:bg-orange-50/80 dark:hover:bg-orange-900/30 rounded-md transition-all duration-200"
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
                              className="p-2 text-slate-500 hover:text-red-500 dark:hover:text-red-400 hover:bg-red-50/80 dark:hover:bg-red-900/30 rounded-md transition-all duration-200"
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
