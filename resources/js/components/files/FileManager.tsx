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
import { FileManagerToolbar } from './FileManagerToolbar';
import { FileOperationModal } from './FileOperationModal';
import { FileUploadModal } from './FileUploadModal';
import { ChmodModal } from './ChmodModal';
import { ChownModal } from './ChownModal';
import { ArchiveOperationModal } from './ArchiveOperationModal';
import { LoadingSpinner } from '../common/LoadingSpinner';
import { EmptyState } from '../common/EmptyState';
import { useFiles } from '../../hooks/useFiles';
import { useOperations } from '../../hooks/useOperations';
import { showToast } from '../../utils/toast';
import { cn } from '../../utils/cn';
import { theme } from '../../theme';
import { ExclamationTriangleIcon, LockClosedIcon } from '@heroicons/react/24/outline';

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
      <EmptyState
        icon={LockClosedIcon}
        title="Access Denied"
        description="You don't have permission to access files in this stack."
        variant="error"
        size="md"
      />
    );
  }

  return (
    <div className={cn('h-full flex flex-col', theme.surface.subtle)}>
      {/* Toolbar */}
      <FileManagerToolbar
        currentPath={currentPath}
        canRead={canRead}
        canWrite={canWrite}
        onCreateFolder={() => {
          setCurrentOperation('mkdir');
          setIsOperationModalOpen(true);
        }}
        onCreateFile={() => {
          setCurrentOperation('create');
          setIsOperationModalOpen(true);
        }}
        onUpload={() => setIsUploadModalOpen(true)}
      />

      {/* Content Area */}
      <div className="flex-1 overflow-hidden">
        {loading && !directoryListing ? (
          <LoadingSpinner size="lg" text="Loading files..." fullScreen />
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
          <EmptyState
            icon={ExclamationTriangleIcon}
            title="Failed to load directory"
            description="There was an error loading the file listing."
            variant="error"
            size="md"
            action={{
              label: 'Try Again',
              onClick: () => loadDirectory(currentPath),
            }}
          />
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
