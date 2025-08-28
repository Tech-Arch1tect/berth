import React, { useState, useEffect } from 'react';
import {
  FileEntry,
  FileOperation,
  CreateDirectoryRequest,
  WriteFileRequest,
  RenameRequest,
  CopyRequest,
  DeleteRequest,
} from '../../types/files';

interface FileOperationModalProps {
  isOpen: boolean;
  operation: FileOperation | null;
  selectedFile: FileEntry | null;
  currentPath: string;
  onClose: () => void;
  onConfirm: (
    data: CreateDirectoryRequest | WriteFileRequest | RenameRequest | CopyRequest | DeleteRequest
  ) => Promise<void>;
}

export const FileOperationModal: React.FC<FileOperationModalProps> = ({
  isOpen,
  operation,
  selectedFile,
  currentPath,
  onClose,
  onConfirm,
}) => {
  const [inputValue, setInputValue] = useState('');
  const [targetValue, setTargetValue] = useState('');
  const [selectedFiles, setSelectedFiles] = useState<FileList | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isOpen && operation) {
      switch (operation) {
        case 'mkdir':
          setInputValue('');
          setTargetValue('');
          break;
        case 'create':
          setInputValue('');
          setTargetValue('');
          break;
        case 'rename':
          setInputValue(selectedFile?.name || '');
          setTargetValue('');
          break;
        case 'copy':
          setInputValue(selectedFile?.path || '');
          setTargetValue('');
          break;
        default:
          setInputValue('');
          setTargetValue('');
      }
    }
  }, [isOpen, operation, selectedFile]);

  const handleConfirm = async () => {
    if (!operation) return;

    try {
      setLoading(true);

      switch (operation) {
        case 'mkdir': {
          const dirPath = currentPath ? `${currentPath}/${inputValue}` : inputValue;
          await onConfirm({ path: dirPath } as CreateDirectoryRequest);
          break;
        }

        case 'create': {
          const filePath = currentPath ? `${currentPath}/${inputValue}` : inputValue;
          await onConfirm({ path: filePath, content: '', encoding: 'utf-8' });
          break;
        }

        case 'rename': {
          if (!selectedFile) return;
          const newPath = selectedFile.path.replace(selectedFile.name, inputValue);
          await onConfirm({ old_path: selectedFile.path, new_path: newPath } as RenameRequest);
          break;
        }

        case 'copy': {
          if (!selectedFile) return;
          const copyTarget = targetValue || `${selectedFile.name}_copy`;
          const copyPath = currentPath ? `${currentPath}/${copyTarget}` : copyTarget;
          await onConfirm({ source_path: selectedFile.path, target_path: copyPath } as CopyRequest);
          break;
        }

        case 'delete':
          if (!selectedFile) return;
          await onConfirm({ path: selectedFile.path });
          break;
      }

      onClose();
    } finally {
      setLoading(false);
    }
  };

  const handleBackdropClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  const getModalTitle = () => {
    switch (operation) {
      case 'mkdir':
        return 'Create New Directory';
      case 'create':
        return 'Create New File';
      case 'rename':
        return `Rename ${selectedFile?.is_directory ? 'Directory' : 'File'}`;
      case 'copy':
        return `Copy ${selectedFile?.is_directory ? 'Directory' : 'File'}`;
      case 'delete':
        return `Delete ${selectedFile?.is_directory ? 'Directory' : 'File'}`;
      default:
        return 'File Operation';
    }
  };

  const getConfirmButtonText = () => {
    switch (operation) {
      case 'mkdir':
        return 'Create Directory';
      case 'create':
        return 'Create File';
      case 'rename':
        return 'Rename';
      case 'copy':
        return 'Copy';
      case 'delete':
        return 'Delete';
      default:
        return 'Confirm';
    }
  };

  const getConfirmButtonColor = () => {
    return operation === 'delete'
      ? 'bg-red-600 hover:bg-red-700 focus:ring-red-500'
      : 'bg-blue-600 hover:bg-blue-700 focus:ring-blue-500';
  };

  if (!isOpen || !operation) return null;

  return (
    <div
      className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50"
      onClick={handleBackdropClick}
    >
      <div className="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white dark:bg-gray-800">
        <div className="mt-3">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-medium text-gray-900 dark:text-white">{getModalTitle()}</h3>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          </div>

          <div className="space-y-4">
            {operation === 'delete' ? (
              <div>
                <p className="text-gray-700 dark:text-gray-300 mb-4">
                  Are you sure you want to delete <strong>{selectedFile?.name}</strong>?
                  {selectedFile?.is_directory && (
                    <span className="block text-sm text-red-600 dark:text-red-400 mt-2">
                      This will permanently delete the directory and all its contents.
                    </span>
                  )}
                </p>
              </div>
            ) : (
              <>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    {operation === 'mkdir'
                      ? 'Directory Name'
                      : operation === 'create'
                        ? 'File Name'
                        : operation === 'rename'
                          ? 'New Name'
                          : 'Source'}
                  </label>
                  <input
                    type="text"
                    value={inputValue}
                    onChange={(e) => setInputValue(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
                    placeholder={
                      operation === 'mkdir'
                        ? 'my-directory'
                        : operation === 'create'
                          ? 'my-file.txt'
                          : 'New name'
                    }
                    disabled={operation === 'copy'}
                  />
                </div>

                {operation === 'copy' && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Target Name
                    </label>
                    <input
                      type="text"
                      value={targetValue}
                      onChange={(e) => setTargetValue(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
                      placeholder={selectedFile ? `${selectedFile.name}_copy` : 'copy-name'}
                    />
                  </div>
                )}

                {currentPath && (
                  <div className="text-sm text-gray-600 dark:text-gray-400">
                    <strong>Location:</strong> /{currentPath}
                  </div>
                )}
              </>
            )}
          </div>

          <div className="flex items-center justify-end space-x-3 mt-6">
            <button
              onClick={onClose}
              disabled={loading}
              className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              onClick={handleConfirm}
              disabled={loading || (operation !== 'delete' && !inputValue.trim())}
              className={`px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white ${getConfirmButtonColor()} focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed`}
            >
              {loading ? (
                <>
                  <svg className="animate-spin -ml-1 mr-2 h-4 w-4" fill="none" viewBox="0 0 24 24">
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
                  Processing...
                </>
              ) : (
                getConfirmButtonText()
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
