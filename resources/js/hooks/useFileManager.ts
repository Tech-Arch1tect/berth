import { useState, useEffect, useCallback } from 'react';
import { useFiles } from './useFiles';
import { useOperations } from './useOperations';
import { showToast } from '../utils/toast';
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
} from '../types/files';

export interface UseFileManagerOptions {
  serverid: number;
  stackname: string;
  canRead: boolean;
  canWrite: boolean;
}

export function useFileManager({ serverid, stackname, canRead, canWrite }: UseFileManagerOptions) {
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

  const files = useFiles({
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
        const listing = await files.listDirectory(path);
        setDirectoryListing(listing);
        setCurrentPath(path);
      } catch (error) {
        console.error('Failed to load directory:', error);
      } finally {
        setLoading(false);
      }
    },
    [canRead, files.listDirectory]
  );

  const operations = useOperations({
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

  useEffect(() => {
    if (!canRead) {
      return;
    }

    const initialLoad = async () => {
      try {
        setLoading(true);
        const listing = await files.listDirectory('');
        setDirectoryListing(listing);
        setCurrentPath('');
      } catch (error) {
        console.error('Failed to load directory:', error);
      } finally {
        setLoading(false);
      }
    };

    initialLoad();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
        const content = await files.readFile(entry.path);
        setFileContent(content);
        setSelectedFile(entry);
        setIsEditorOpen(true);
      } catch (error) {
        console.error('Failed to read file:', error);
      } finally {
        setLoading(false);
      }
    },
    [canRead, files.readFile]
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
            await files.createDirectory(data as CreateDirectoryRequest);
            showToast.success('Directory created successfully');
            break;
          case 'create':
            await files.writeFile(data as WriteFileRequest);
            showToast.success('File created successfully');
            break;
          case 'rename':
            await files.renameFile(data as RenameRequest);
            showToast.success('File renamed successfully');
            break;
          case 'copy':
            await files.copyFile(data as CopyRequest);
            showToast.success('File copied successfully');
            break;
          case 'delete':
            await files.deleteFile(data as DeleteRequest);
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
      files.createDirectory,
      files.writeFile,
      files.renameFile,
      files.copyFile,
      files.deleteFile,
      loadDirectory,
      currentPath,
    ]
  );

  const handleFileSave = useCallback(
    async (data: WriteFileRequest) => {
      try {
        await files.writeFile(data);
        showToast.success('File saved successfully');

        if (selectedFile) {
          const content = await files.readFile(selectedFile.path);
          setFileContent(content);
        }
      } catch (error) {
        console.error('Failed to save file:', error);
        throw error;
      }
    },
    [files.writeFile, files.readFile, selectedFile]
  );

  const handleDownload = useCallback(
    async (entry: FileEntry) => {
      if (!canRead) {
        showToast.error('You do not have permission to download files from this stack');
        return;
      }

      try {
        await files.downloadFile(entry.path, entry.name);
        showToast.success(`Downloaded ${entry.name} successfully`);
      } catch (error) {
        console.error('Failed to download file:', error);
        showToast.error(`Failed to download ${entry.name}`);
      }
    },
    [files.downloadFile, canRead]
  );

  const handleFileUpload = useCallback(
    async (
      file: File,
      path: string,
      options?: { mode?: string; owner_id?: number; group_id?: number }
    ) => {
      try {
        if (options && (options.mode || options.owner_id || options.group_id)) {
          await files.uploadFile(file, path);

          if (options.mode) {
            await files.chmodFile({ path, mode: options.mode, recursive: false });
          }
          if (options.owner_id || options.group_id) {
            const chownRequest: any = { path, recursive: false };
            if (options.owner_id) chownRequest.owner_id = options.owner_id;
            if (options.group_id) chownRequest.group_id = options.group_id;
            await files.chownFile(chownRequest);
          }
        } else {
          await files.uploadFile(file, path);
        }

        showToast.success(`Uploaded ${file.name} successfully`);
        await loadDirectory(currentPath);
      } catch (error) {
        console.error('Failed to upload file:', error);
        showToast.error(`Failed to upload ${file.name}`);
        throw error;
      }
    },
    [files.uploadFile, files.chmodFile, files.chownFile, loadDirectory, currentPath]
  );

  const handleChmodConfirm = useCallback(
    async (request: ChmodRequest) => {
      try {
        await files.chmodFile(request);
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
    [files.chmodFile, loadDirectory, currentPath]
  );

  const handleChownConfirm = useCallback(
    async (request: ChownRequest) => {
      try {
        await files.chownFile(request);
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
    [files.chownFile, loadDirectory, currentPath]
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

        operations.clearLogs();

        await operations.startOperation({
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
    [operations.clearLogs, operations.startOperation, currentPath]
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

        operations.clearLogs();

        await operations.startOperation({
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
    [operations.clearLogs, operations.startOperation]
  );

  const closeEditor = useCallback(() => {
    setIsEditorOpen(false);
    setFileContent(null);
    setSelectedFile(null);
  }, []);

  const closeOperationModal = useCallback(() => {
    setIsOperationModalOpen(false);
    setCurrentOperation(null);
    setSelectedFile(null);
  }, []);

  const closeUploadModal = useCallback(() => {
    setIsUploadModalOpen(false);
    setCurrentOperation(null);
  }, []);

  const closeChmodModal = useCallback(() => {
    setIsChmodModalOpen(false);
    setCurrentOperation(null);
    setSelectedFile(null);
  }, []);

  const closeChownModal = useCallback(() => {
    setIsChownModalOpen(false);
    setCurrentOperation(null);
    setSelectedFile(null);
  }, []);

  const closeArchiveModal = useCallback(() => {
    setIsArchiveModalOpen(false);
    setCurrentOperation(null);
    setSelectedFile(null);
  }, []);

  return {
    currentPath,
    directoryListing,
    loading,
    selectedFile,
    fileContent,
    currentOperation,
    archiveOperation,

    isEditorOpen,
    isOperationModalOpen,
    isUploadModalOpen,
    isChmodModalOpen,
    isChownModalOpen,
    isArchiveModalOpen,

    loadDirectory,
    handleNavigate,
    handleFileSelect,
    handleFileOperation,
    handleOperationConfirm,
    handleFileSave,
    handleDownload,
    handleFileUpload,
    handleChmodConfirm,
    handleChownConfirm,
    handleCreateArchive,
    handleExtractArchive,

    closeEditor,
    closeOperationModal,
    closeUploadModal,
    closeChmodModal,
    closeChownModal,
    closeArchiveModal,

    getDirectoryStats: files.getDirectoryStats,
  };
}
