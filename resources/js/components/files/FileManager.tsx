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
  serverid: number;
  stackname: string;
  canRead: boolean;
  canWrite: boolean;
}

export const FileManager: React.FC<FileManagerProps> = ({
  serverid,
  stackname,
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
    serverid,
    stackname,
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
    <div className="h-full flex flex-col bg-slate-50/30 dark:bg-slate-900/30">
      {/* Modern Toolbar */}
      <div className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl border-b border-slate-200/50 dark:border-slate-700/50 px-6 py-4">
        <div className="flex items-center justify-between">
          {/* Breadcrumb Navigation */}
          <div className="flex items-center space-x-2 flex-1 min-w-0">
            <div className="flex items-center space-x-1 text-sm text-slate-600 dark:text-slate-400">
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
              {currentPath && (
                <>
                  <span className="text-slate-400">/</span>
                  <span className="truncate max-w-xs">{currentPath}</span>
                </>
              )}
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center space-x-2">
            {/* Permissions Badge */}
            <div className="flex items-center space-x-2 px-3 py-1.5 bg-slate-100/70 dark:bg-slate-800/70 rounded-lg text-xs font-medium text-slate-600 dark:text-slate-400">
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
                <div className="flex items-center bg-slate-100/70 dark:bg-slate-800/70 rounded-lg p-1 space-x-1">
                  <button
                    onClick={() => {
                      setCurrentOperation('mkdir');
                      setIsOperationModalOpen(true);
                    }}
                    className="px-3 py-2 text-sm font-medium text-slate-700 dark:text-slate-300 hover:bg-white/80 dark:hover:bg-slate-700/80 rounded-md transition-all duration-200 flex items-center space-x-1.5"
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
                    onClick={() => {
                      setCurrentOperation('create');
                      setIsOperationModalOpen(true);
                    }}
                    className="px-3 py-2 text-sm font-medium text-slate-700 dark:text-slate-300 hover:bg-white/80 dark:hover:bg-slate-700/80 rounded-md transition-all duration-200 flex items-center space-x-1.5"
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
                  onClick={() => setIsUploadModalOpen(true)}
                  className="px-3 py-2 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white text-sm font-medium rounded-lg shadow-sm hover:shadow-md transition-all duration-200 flex items-center space-x-2"
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

      {/* Content Area */}
      <div className="flex-1 overflow-hidden">
        {loading && !directoryListing ? (
          <div className="h-full flex items-center justify-center">
            <div className="text-center">
              <div className="relative">
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="w-32 h-32 bg-gradient-to-r from-blue-100 to-purple-100 dark:from-blue-900/20 dark:to-purple-900/20 rounded-full opacity-50" />
                </div>
                <div className="relative">
                  <div className="mx-auto w-16 h-16 bg-gradient-to-br from-slate-100 to-slate-200 dark:from-slate-800 dark:to-slate-700 rounded-2xl flex items-center justify-center mb-6 animate-spin">
                    <svg
                      className="w-8 h-8 text-slate-400 dark:text-slate-500"
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
                </div>
              </div>
              <h3 className="text-xl font-semibold text-slate-900 dark:text-white mb-2">
                Loading files...
              </h3>
              <p className="text-slate-600 dark:text-slate-400">
                Please wait while we fetch the directory contents.
              </p>
            </div>
          </div>
        ) : directoryListing ? (
          <div className="h-full overflow-hidden">
            <FileList
              entries={directoryListing.entries || []}
              onNavigate={handleNavigate}
              onFileSelect={handleFileSelect}
              onFileOperation={handleFileOperation}
              onDownload={handleDownload}
              currentPath={currentPath}
              canWrite={canWrite}
            />
          </div>
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
      </div>

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
