import React, { useState, useEffect, useCallback } from 'react';
import {
  DirectoryListing,
  FileEntry,
  FileContent,
  FileOperation,
  CreateDirectoryRequest,
  WriteFileRequest,
  RenameRequest,
  CopyRequest,
  DeleteRequest,
} from '../../types/files';
import { FileList } from './FileList';
import { FileEditor } from './FileEditor';
import { FileOperationModal } from './FileOperationModal';
import { FileUploadModal } from './FileUploadModal';
import { useFiles } from '../../hooks/useFiles';
import { showToast } from '../../utils/toast';

interface FileManagerProps {
  serverId: number;
  stackName: string;
  canRead: boolean;
  canWrite: boolean;
}

export const FileManager: React.FC<FileManagerProps> = ({
  serverId,
  stackName,
  canRead,
  canWrite,
}) => {
  const [currentPath, setCurrentPath] = useState('');
  const [directoryListing, setDirectoryListing] = useState<DirectoryListing | null>(null);
  const [loading, setLoading] = useState(false);
  const [selectedFile, setSelectedFile] = useState<FileEntry | null>(null);
  const [fileContent, setFileContent] = useState<FileContent | null>(null);
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [isOperationModalOpen, setIsOperationModalOpen] = useState(false);
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [currentOperation, setCurrentOperation] = useState<FileOperation | null>(null);

  const handleError = useCallback((error: string) => {
    showToast.error(error);
  }, []);

  const {
    listDirectory,
    readFile,
    writeFile,
    uploadFile,
    createDirectory,
    deleteFile,
    renameFile,
    copyFile,
    downloadFile,
  } = useFiles({
    serverId,
    stackName,
    onError: handleError,
  });

  const loadDirectory = useCallback(
    async (path: string) => {
      if (!canRead) {
        showToast.error('You do not have permission to read files in this stack');
        return;
      }

      try {
        setLoading(true);
        const listing = await listDirectory(path);
        setDirectoryListing(listing);
        setCurrentPath(path);
      } catch (error) {
        console.error('Failed to load directory:', error);
      } finally {
        setLoading(false);
      }
    },
    [canRead, listDirectory]
  );

  useEffect(() => {
    loadDirectory('');
  }, [loadDirectory]);

  const handleNavigate = useCallback(
    (path: string) => {
      loadDirectory(path);
    },
    [loadDirectory]
  );

  const handleFileSelect = useCallback(
    async (entry: FileEntry) => {
      if (!canRead) {
        showToast.error('You do not have permission to read this file');
        return;
      }

      try {
        setLoading(true);
        const content = await readFile(entry.path);
        setFileContent(content);
        setSelectedFile(entry);
        setIsEditorOpen(true);
      } catch (error) {
        console.error('Failed to read file:', error);
      } finally {
        setLoading(false);
      }
    },
    [canRead, readFile]
  );

  const handleFileOperation = useCallback(
    (operation: FileOperation, entry?: FileEntry) => {
      if (
        !canWrite &&
        ['create', 'mkdir', 'rename', 'copy', 'delete', 'upload'].includes(operation)
      ) {
        showToast.error('You do not have permission to modify files in this stack');
        return;
      }

      setCurrentOperation(operation);
      setSelectedFile(entry || null);

      if (operation === 'edit' && entry) {
        handleFileSelect(entry);
      } else if (operation === 'upload') {
        setIsUploadModalOpen(true);
      } else {
        setIsOperationModalOpen(true);
      }
    },
    [canWrite, handleFileSelect]
  );

  const handleOperationConfirm = useCallback(
    async (
      data: CreateDirectoryRequest | WriteFileRequest | RenameRequest | CopyRequest | DeleteRequest
    ) => {
      if (!currentOperation) return;

      try {
        switch (currentOperation) {
          case 'mkdir':
            await createDirectory(data as CreateDirectoryRequest);
            showToast.success('Directory created successfully');
            break;
          case 'create':
            await writeFile(data as WriteFileRequest);
            showToast.success('File created successfully');
            break;
          case 'rename':
            await renameFile(data as RenameRequest);
            showToast.success('File renamed successfully');
            break;
          case 'copy':
            await copyFile(data as CopyRequest);
            showToast.success('File copied successfully');
            break;
          case 'delete':
            await deleteFile(data as DeleteRequest);
            showToast.success('File deleted successfully');
            break;
        }

        await loadDirectory(currentPath);
      } catch (error) {
        console.error('Operation failed:', error);
        throw error;
      }
    },
    [
      currentOperation,
      createDirectory,
      writeFile,
      renameFile,
      copyFile,
      deleteFile,
      loadDirectory,
      currentPath,
    ]
  );

  const handleFileSave = useCallback(
    async (data: WriteFileRequest) => {
      try {
        await writeFile(data);
        showToast.success('File saved successfully');

        if (selectedFile) {
          const content = await readFile(selectedFile.path);
          setFileContent(content);
        }
      } catch (error) {
        console.error('Failed to save file:', error);
        throw error;
      }
    },
    [writeFile, readFile, selectedFile]
  );

  const handleDownload = useCallback(
    async (entry: FileEntry) => {
      if (!canRead) {
        showToast.error('You do not have permission to download files from this stack');
        return;
      }

      try {
        await downloadFile(entry.path, entry.name);
        showToast.success(`Downloaded ${entry.name} successfully`);
      } catch (error) {
        console.error('Failed to download file:', error);
        showToast.error(`Failed to download ${entry.name}`);
      }
    },
    [downloadFile, canRead]
  );

  const handleFileUpload = useCallback(
    async (file: File, path: string) => {
      try {
        await uploadFile(file, path);
        showToast.success(`Uploaded ${file.name} successfully`);
        await loadDirectory(currentPath);
      } catch (error) {
        console.error('Failed to upload file:', error);
        showToast.error(`Failed to upload ${file.name}`);
        throw error;
      }
    },
    [uploadFile, loadDirectory, currentPath]
  );

  if (!canRead) {
    return (
      <div className="bg-white dark:bg-gray-800 shadow-sm rounded-lg p-6">
        <div className="text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-red-100 dark:bg-red-900/20 rounded-full mb-4">
            <svg
              className="w-8 h-8 text-red-600 dark:text-red-400"
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
          </div>
          <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">Access Denied</h3>
          <p className="text-gray-600 dark:text-gray-400">
            You don't have permission to access files in this stack.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Permission indicator */}
      <div className="bg-blue-50 dark:bg-blue-900/20 border-l-4 border-blue-400 p-4">
        <div className="flex items-center">
          <div className="flex-shrink-0">
            <svg className="h-5 w-5 text-blue-400" fill="currentColor" viewBox="0 0 20 20">
              <path
                fillRule="evenodd"
                d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
                clipRule="evenodd"
              />
            </svg>
          </div>
          <div className="ml-3">
            <p className="text-sm text-blue-700 dark:text-blue-300">
              <strong>File Permissions:</strong> {canRead && 'Read'}
              {canRead && canWrite && ' • '}
              {canWrite && 'Write'}
              {!canWrite && (
                <span className="ml-2 text-blue-600 dark:text-blue-400">(Read-only access)</span>
              )}
            </p>
          </div>
        </div>
      </div>

      {loading && !directoryListing ? (
        <div className="text-center py-12">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-gray-100 dark:bg-gray-800 rounded-full mb-4 animate-spin">
            <svg
              className="w-8 h-8 text-gray-400 dark:text-gray-600"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
              />
            </svg>
          </div>
          <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
            Loading files...
          </h3>
        </div>
      ) : directoryListing ? (
        <FileList
          entries={directoryListing.entries || []}
          onNavigate={handleNavigate}
          onFileSelect={handleFileSelect}
          onFileOperation={handleFileOperation}
          onDownload={handleDownload}
          currentPath={currentPath}
          canWrite={canWrite}
        />
      ) : (
        <div className="text-center py-12">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-red-100 dark:bg-red-900/20 rounded-full mb-4">
            <svg
              className="w-8 h-8 text-red-600 dark:text-red-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
          </div>
          <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
            Failed to load directory
          </h3>
          <p className="text-gray-600 dark:text-gray-400 mb-4">
            There was an error loading the file listing.
          </p>
          <button
            onClick={() => loadDirectory(currentPath)}
            className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700"
          >
            Try Again
          </button>
        </div>
      )}

      {/* File Editor Modal */}
      <FileEditor
        file={fileContent}
        isOpen={isEditorOpen}
        onClose={() => {
          setIsEditorOpen(false);
          setFileContent(null);
          setSelectedFile(null);
        }}
        onSave={handleFileSave}
        canWrite={canWrite}
      />

      {/* File Operation Modal */}
      <FileOperationModal
        isOpen={isOperationModalOpen}
        operation={currentOperation}
        selectedFile={selectedFile}
        currentPath={currentPath}
        onClose={() => {
          setIsOperationModalOpen(false);
          setCurrentOperation(null);
          setSelectedFile(null);
        }}
        onConfirm={handleOperationConfirm}
      />

      {/* File Upload Modal */}
      <FileUploadModal
        isOpen={isUploadModalOpen}
        currentPath={currentPath}
        onClose={() => {
          setIsUploadModalOpen(false);
          setCurrentOperation(null);
        }}
        onUpload={handleFileUpload}
      />
    </div>
  );
};
