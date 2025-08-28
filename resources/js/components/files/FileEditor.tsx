import React, { useState, useEffect } from 'react';
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

  return (
    <div
      className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50"
      onClick={handleBackdropClick}
    >
      <div className="relative top-20 mx-auto p-5 border w-11/12 max-w-6xl shadow-lg rounded-md bg-white dark:bg-gray-800">
        <div className="flex items-center justify-between pb-4 border-b border-gray-200 dark:border-gray-600">
          <div>
            <h3 className="text-lg font-medium text-gray-900 dark:text-white">{file.path}</h3>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
              Size: {(file.size / 1024).toFixed(2)} KB • Encoding: {file.encoding}
              {isDirty && (
                <span className="text-orange-600 dark:text-orange-400 ml-2">• Modified</span>
              )}
            </p>
          </div>
          <div className="flex items-center space-x-2">
            {isTextFile && (
              <div className="flex items-center border border-gray-300 dark:border-gray-600 rounded-md">
                <button
                  onClick={() => setViewMode('view')}
                  className={`px-3 py-1 text-sm font-medium rounded-l-md ${
                    viewMode === 'view'
                      ? 'bg-blue-600 text-white'
                      : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'
                  }`}
                >
                  View
                </button>
                <button
                  onClick={() => setViewMode('edit')}
                  disabled={!canWrite}
                  className={`px-3 py-1 text-sm font-medium rounded-r-md disabled:opacity-50 ${
                    viewMode === 'edit'
                      ? 'bg-blue-600 text-white'
                      : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'
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

        <div className="mt-4">
          {viewMode === 'view' ? (
            <FileViewer file={file} />
          ) : (
            <div className="border border-gray-200 dark:border-gray-600 rounded-md">
              <textarea
                value={content}
                onChange={(e) => handleContentChange(e.target.value)}
                className="w-full h-96 p-4 font-mono text-sm bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 border-0 resize-none focus:ring-0"
                readOnly={!canWrite}
                placeholder={canWrite ? 'Enter file content...' : 'File content (read-only)'}
                style={{
                  minHeight: '24rem',
                  maxHeight: '32rem',
                }}
              />
              {!canWrite && (
                <div className="px-4 py-2 bg-yellow-50 dark:bg-yellow-900/20 border-t border-yellow-200 dark:border-yellow-800">
                  <p className="text-sm text-yellow-800 dark:text-yellow-200">
                    <svg className="inline w-4 h-4 mr-1" fill="currentColor" viewBox="0 0 20 20">
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
  );
};
