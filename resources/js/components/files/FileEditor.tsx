import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { FileContent, WriteFileRequest } from '../../types/files';
import { FileViewer } from './FileViewer';

interface FileEditorProps {
  file: FileContent | null;
  isOpen: boolean;
  onClose: () => void;
  onSave: (request: WriteFileRequest) => Promise<void>;
  canWrite: boolean;
}

export const FileEditor: React.FC<FileEditorProps> = ({
  file,
  isOpen,
  onClose,
  onSave,
  canWrite,
}) => {
  const [content, setContent] = useState('');
  const [saving, setSaving] = useState(false);
  const [isDirty, setIsDirty] = useState(false);
  const [viewMode, setViewMode] = useState<'view' | 'edit'>('view');

  useEffect(() => {
    if (file) {
      setContent(file.content);
      setIsDirty(false);
      setViewMode(file.encoding === 'base64' ? 'view' : 'view');
    }
  }, [file]);

  const handleSave = async () => {
    if (!file || !canWrite) return;

    try {
      setSaving(true);
      await onSave({
        path: file.path,
        content,
        encoding: file.encoding,
      });
      setIsDirty(false);
    } finally {
      setSaving(false);
    }
  };

  const handleContentChange = (value: string) => {
    setContent(value);
    setIsDirty(value !== file?.content);
  };

  const handleClose = () => {
    if (isDirty) {
      if (confirm('You have unsaved changes. Are you sure you want to close?')) {
        onClose();
      }
    } else {
      onClose();
    }
  };

  const handleBackdropClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget) {
      handleClose();
    }
  };

  const isTextFile = file?.encoding === 'utf-8';

  if (!isOpen || !file) return null;

  const modalContent = (
    <div className="fixed inset-0 z-50 overflow-hidden">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-slate-900/40 backdrop-blur-md"
        onClick={handleBackdropClick}
      />

      {/* Modal with padding and rounded corners */}
      <div className="relative w-full h-full p-4 sm:p-6 lg:p-8">
        <div className="w-full h-full bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl rounded-2xl shadow-2xl border border-slate-200/50 dark:border-slate-700/50 flex flex-col overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200/50 dark:border-slate-700/50 bg-white/90 dark:bg-slate-900/90 backdrop-blur-xl">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-gradient-to-r from-blue-500 to-purple-500 rounded-xl flex items-center justify-center">
                <svg
                  className="w-5 h-5 text-white"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                  />
                </svg>
              </div>
              <div>
                <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
                  {file.path}
                </h2>
                <div className="flex items-center space-x-2 text-sm text-slate-600 dark:text-slate-400">
                  <span>{(file.size / 1024).toFixed(2)} KB</span>
                  <span>•</span>
                  <span className="capitalize">{file.encoding}</span>
                  {isDirty && (
                    <>
                      <span>•</span>
                      <span className="text-orange-600 dark:text-orange-400 font-medium">
                        Modified
                      </span>
                    </>
                  )}
                </div>
              </div>
            </div>
            <div className="flex items-center space-x-3">
              {isTextFile && (
                <div className="flex items-center bg-slate-100 dark:bg-slate-800 rounded-lg p-1">
                  <button
                    onClick={() => setViewMode('view')}
                    className={`px-3 py-1.5 text-sm font-medium rounded-md transition-all duration-200 ${
                      viewMode === 'view'
                        ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm'
                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                    }`}
                  >
                    View
                  </button>
                  <button
                    onClick={() => setViewMode('edit')}
                    disabled={!canWrite}
                    className={`px-3 py-1.5 text-sm font-medium rounded-md transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed ${
                      viewMode === 'edit'
                        ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm'
                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                    }`}
                  >
                    Edit
                  </button>
                </div>
              )}

              {canWrite && isTextFile && viewMode === 'edit' && (
                <button
                  onClick={handleSave}
                  disabled={saving || !isDirty}
                  className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {saving ? (
                    <>
                      <svg
                        className="animate-spin -ml-1 mr-2 h-4 w-4"
                        fill="none"
                        viewBox="0 0 24 24"
                      >
                        <circle
                          className="opacity-25"
                          cx="12"
                          cy="12"
                          r="10"
                          stroke="currentColor"
                          strokeWidth="4"
                        />
                        <path
                          className="opacity-75"
                          fill="currentColor"
                          d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                        />
                      </svg>
                      Saving...
                    </>
                  ) : (
                    <>
                      <svg
                        className="w-4 h-4 mr-2"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
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
              <button
                onClick={handleClose}
                className="inline-flex items-center px-4 py-2 border border-gray-300 dark:border-gray-600 text-sm font-medium rounded-md text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
              >
                Close
              </button>
            </div>
          </div>

          {/* Content Area */}
          <div className="flex-1 flex flex-col p-6 min-h-0">
            {viewMode === 'view' ? (
              <div className="flex-1 bg-slate-50/50 dark:bg-slate-800/50 rounded-xl border border-slate-200/50 dark:border-slate-700/50 overflow-hidden">
                <FileViewer file={file} />
              </div>
            ) : (
              <div className="flex-1 bg-slate-50/50 dark:bg-slate-800/50 rounded-xl border border-slate-200/50 dark:border-slate-700/50 overflow-hidden flex flex-col">
                <textarea
                  value={content}
                  onChange={(e) => handleContentChange(e.target.value)}
                  className="flex-1 w-full p-6 font-mono text-sm bg-transparent text-slate-900 dark:text-slate-100 border-0 resize-none focus:ring-0 focus:outline-none placeholder-slate-400 dark:placeholder-slate-500"
                  readOnly={!canWrite}
                  placeholder={canWrite ? 'Enter file content...' : 'File content (read-only)'}
                  style={{ minHeight: '400px' }}
                />
                {!canWrite && (
                  <div className="p-4 bg-amber-50/50 dark:bg-amber-900/20 border-t border-amber-200/50 dark:border-amber-800/50 backdrop-blur-sm">
                    <p className="text-sm text-amber-800 dark:text-amber-200 flex items-center">
                      <svg
                        className="w-4 h-4 mr-2 flex-shrink-0"
                        fill="currentColor"
                        viewBox="0 0 20 20"
                      >
                        <path
                          fillRule="evenodd"
                          d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
                          clipRule="evenodd"
                        />
                      </svg>
                      Read-only: You don't have write permissions for this file.
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
};
