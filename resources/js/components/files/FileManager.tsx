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
  ChmodRequest,
  ChownRequest,
  CreateArchiveRequest,
  ExtractArchiveRequest,
} from '../../types/files';
import { FileList } from './FileList';
import { FileEditor } from './FileEditor';
import { FileOperationModal } from './FileOperationModal';
import { FileUploadModal } from './FileUploadModal';
import { ChmodModal } from './ChmodModal';
import { ChownModal } from './ChownModal';
import { ArchiveOperationModal } from './ArchiveOperationModal';
import { useFiles } from '../../hooks/useFiles';
import { useOperations } from '../../hooks/useOperations';
import { showToast } from '../../utils/toast';
import { cn } from '../../utils/cn';
import { theme } from '../../theme';

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
  const [isChmodModalOpen, setIsChmodModalOpen] = useState(false);
  const [isChownModalOpen, setIsChownModalOpen] = useState(false);
  const [isArchiveModalOpen, setIsArchiveModalOpen] = useState(false);
  const [archiveOperation, setArchiveOperation] = useState<'create' | 'extract'>('create');
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
    chmodFile,
    chownFile,
    getDirectoryStats,
  } = useFiles({
    serverid,
    stackname,
    onError: handleError,
  });

  const {
    startOperation,
    operationStatus,
    error: operationError,
    clearLogs,
  } = useOperations({
    serverid: String(serverid),
    stackname,
    onOperationComplete: (success, exitCode) => {
      if (success) {
        showToast.success('Archive operation completed successfully');
        loadDirectory(currentPath);
      } else {
        showToast.error(`Archive operation failed with exit code: ${exitCode}`);
      }
    },
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
        [
          'create',
          'mkdir',
          'rename',
          'copy',
          'delete',
          'upload',
          'chmod',
          'chown',
          'create_archive',
          'extract_archive',
        ].includes(operation)
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
      } else if (operation === 'chmod') {
        setIsChmodModalOpen(true);
      } else if (operation === 'chown') {
        setIsChownModalOpen(true);
      } else if (operation === 'create_archive') {
        setArchiveOperation('create');
        setIsArchiveModalOpen(true);
      } else if (operation === 'extract_archive') {
        setArchiveOperation('extract');
        setIsArchiveModalOpen(true);
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
    async (
      file: File,
      path: string,
      options?: { mode?: string; owner_id?: number; group_id?: number }
    ) => {
      try {
        if (options && (options.mode || options.owner_id || options.group_id)) {
          await uploadFile(file, path);

          if (options.mode) {
            await chmodFile({ path, mode: options.mode, recursive: false });
          }
          if (options.owner_id || options.group_id) {
            const chownRequest: any = { path, recursive: false };
            if (options.owner_id) chownRequest.owner_id = options.owner_id;
            if (options.group_id) chownRequest.group_id = options.group_id;
            await chownFile(chownRequest);
          }
        } else {
          await uploadFile(file, path);
        }

        showToast.success(`Uploaded ${file.name} successfully`);
        await loadDirectory(currentPath);
      } catch (error) {
        console.error('Failed to upload file:', error);
        showToast.error(`Failed to upload ${file.name}`);
        throw error;
      }
    },
    [uploadFile, chmodFile, chownFile, loadDirectory, currentPath]
  );

  const handleChmodConfirm = useCallback(
    async (request: ChmodRequest) => {
      try {
        await chmodFile(request);
        showToast.success('Permissions changed successfully');
        await loadDirectory(currentPath);
        setIsChmodModalOpen(false);
        setCurrentOperation(null);
        setSelectedFile(null);
      } catch (error) {
        console.error('Failed to change permissions:', error);
        throw error;
      }
    },
    [chmodFile, loadDirectory, currentPath]
  );

  const handleChownConfirm = useCallback(
    async (request: ChownRequest) => {
      try {
        await chownFile(request);
        showToast.success('Ownership changed successfully');
        await loadDirectory(currentPath);
        setIsChownModalOpen(false);
        setCurrentOperation(null);
        setSelectedFile(null);
      } catch (error) {
        console.error('Failed to change ownership:', error);
        throw error;
      }
    },
    [chownFile, loadDirectory, currentPath]
  );

  const handleCreateArchive = useCallback(
    async (request: CreateArchiveRequest) => {
      try {
        const options = ['--format', request.format, '--output', request.output_path];

        if (request.include_paths && request.include_paths.length > 0) {
          request.include_paths.forEach((path) => {
            options.push('--include', path);
          });
        } else {
          const includePath = currentPath || '.';
          options.push('--include', includePath);
        }

        if (request.exclude_patterns && request.exclude_patterns.length > 0) {
          request.exclude_patterns.forEach((pattern) => {
            options.push('--exclude', pattern);
          });
        }

        if (request.compression) {
          options.push('--compression', request.compression);
        }

        clearLogs();

        await startOperation({
          command: 'create-archive',
          options: options,
          services: [],
        });

        setIsArchiveModalOpen(false);
      } catch (error) {
        console.error('Failed to start archive creation:', error);
        showToast.error('Failed to start archive creation');
      }
    },
    [startOperation, currentPath, clearLogs]
  );

  const handleExtractArchive = useCallback(
    async (request: ExtractArchiveRequest) => {
      try {
        const options = ['--archive', request.archive_path];

        if (request.destination_path) {
          options.push('--destination', request.destination_path);
        }

        if (request.overwrite) {
          options.push('--overwrite');
        }

        if (request.create_dirs) {
          options.push('--create-dirs');
        }

        clearLogs();

        await startOperation({
          command: 'extract-archive',
          options: options,
          services: [],
        });

        setIsArchiveModalOpen(false);
      } catch (error) {
        console.error('Failed to start archive extraction:', error);
        showToast.error('Failed to start archive extraction');
      }
    },
    [startOperation, clearLogs]
  );

  if (!canRead) {
    return (
      <div className={cn(theme.containers.panel)}>
        <div className="text-center">
          <div
            className={cn(
              'inline-flex items-center justify-center w-16 h-16 rounded-full mb-4',
              theme.intent.danger.surface
            )}
          >
            <svg
              className={cn('w-8 h-8', theme.intent.danger.textStrong)}
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
          <h3 className={cn('text-lg font-medium mb-2', theme.text.strong)}>Access Denied</h3>
          <p className={theme.text.muted}>
            You don't have permission to access files in this stack.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className={cn('h-full flex flex-col', theme.surface.subtle)}>
      {/* Modern Toolbar */}
      <div className={cn('backdrop-blur-xl border-b px-6 py-4', theme.surface.panel)}>
        <div className="flex items-center justify-between">
          {/* Breadcrumb Navigation */}
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
              {currentPath && (
                <>
                  <span className={theme.text.subtle}>/</span>
                  <span className="truncate max-w-xs">{currentPath}</span>
                </>
              )}
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
                    onClick={() => {
                      setCurrentOperation('mkdir');
                      setIsOperationModalOpen(true);
                    }}
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
                    onClick={() => {
                      setCurrentOperation('create');
                      setIsOperationModalOpen(true);
                    }}
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
                  onClick={() => setIsUploadModalOpen(true)}
                  className={cn(
                    'px-3 py-2 text-sm font-medium rounded-lg shadow-sm hover:shadow-md transition-all duration-200 flex items-center space-x-2',
                    theme.brand.accent,
                    'hover:from-blue-700 hover:to-purple-700'
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

      {/* Content Area */}
      <div className="flex-1 overflow-hidden">
        {loading && !directoryListing ? (
          <div className="h-full flex items-center justify-center">
            <div className="text-center">
              <div className="relative">
                <div className="absolute inset-0 flex items-center justify-center">
                  <div
                    className={cn('w-32 h-32 rounded-full opacity-50', theme.effects.emptyAura)}
                  />
                </div>
                <div className="relative">
                  <div
                    className={cn(
                      'mx-auto w-16 h-16 rounded-2xl flex items-center justify-center mb-6 animate-spin',
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
                        d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                      />
                    </svg>
                  </div>
                </div>
              </div>
              <h3 className={cn('text-xl font-semibold mb-2', theme.text.strong)}>
                Loading files...
              </h3>
              <p className={theme.text.muted}>Please wait while we fetch the directory contents.</p>
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
            <div
              className={cn(
                'inline-flex items-center justify-center w-16 h-16 rounded-full mb-4',
                theme.intent.danger.surface
              )}
            >
              <svg
                className={cn('w-8 h-8', theme.intent.danger.textStrong)}
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
            <h3 className={cn('text-lg font-medium mb-2', theme.text.strong)}>
              Failed to load directory
            </h3>
            <p className={cn('mb-4', theme.text.muted)}>
              There was an error loading the file listing.
            </p>
            <button onClick={() => loadDirectory(currentPath)} className={theme.buttons.primary}>
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
        getDirectoryStats={getDirectoryStats}
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
        getDirectoryStats={getDirectoryStats}
      />

      {/* Chmod Modal */}
      <ChmodModal
        isOpen={isChmodModalOpen}
        entry={selectedFile}
        loading={loading}
        onClose={() => {
          setIsChmodModalOpen(false);
          setCurrentOperation(null);
          setSelectedFile(null);
        }}
        onConfirm={handleChmodConfirm}
      />

      {/* Chown Modal */}
      <ChownModal
        isOpen={isChownModalOpen}
        entry={selectedFile}
        loading={loading}
        onClose={() => {
          setIsChownModalOpen(false);
          setCurrentOperation(null);
          setSelectedFile(null);
        }}
        onConfirm={handleChownConfirm}
      />

      {/* Archive Operation Modal */}
      <ArchiveOperationModal
        isOpen={isArchiveModalOpen}
        operation={archiveOperation}
        currentPath={currentPath}
        selectedFile={selectedFile || undefined}
        onClose={() => {
          setIsArchiveModalOpen(false);
          setCurrentOperation(null);
          setSelectedFile(null);
        }}
        onCreateArchive={handleCreateArchive}
        onExtractArchive={handleExtractArchive}
      />
    </div>
  );
};
