import { useState, useCallback } from 'react';
import {
  getApiV1ServersServeridStacksStacknameFiles,
  getApiV1ServersServeridStacksStacknameFilesRead,
  postApiV1ServersServeridStacksStacknameFilesWrite,
  postApiV1ServersServeridStacksStacknameFilesMkdir,
  deleteApiV1ServersServeridStacksStacknameFilesDelete,
  postApiV1ServersServeridStacksStacknameFilesRename,
  postApiV1ServersServeridStacksStacknameFilesCopy,
  postApiV1ServersServeridStacksStacknameFilesChmod,
  postApiV1ServersServeridStacksStacknameFilesChown,
  postApiV1ServersServeridStacksStacknameFilesUpload,
  getApiV1ServersServeridStacksStacknameFilesDownload,
  getApiV1ServersServeridStacksStacknameFilesStats,
} from '../api/generated/files/files';
import type {
  DirectoryListing,
  FileContent,
  DirectoryStats,
  WriteFileRequest,
  CreateDirectoryRequest,
  DeleteRequest2,
  RenameRequest,
  CopyRequest,
  ChmodRequest,
  ChownRequest,
} from '../api/generated/models';

interface UseFilesOptions {
  serverid: number;
  stackname: string;
  onError?: (error: string) => void;
}

export const useFiles = ({ serverid, stackname, onError }: UseFilesOptions) => {
  const [loading, setLoading] = useState(false);

  const handleError = useCallback(
    (error: unknown) => {
      const message =
        (error as { response?: { data?: { error?: string } }; message?: string })?.response?.data
          ?.error ||
        (error as { message?: string })?.message ||
        'An unknown error occurred';
      if (onError) {
        onError(message);
      }
      throw new Error(message);
    },
    [onError]
  );

  const listDirectory = useCallback(
    async (path?: string): Promise<DirectoryListing> => {
      try {
        setLoading(true);
        const response = await getApiV1ServersServeridStacksStacknameFiles(
          serverid,
          stackname,
          path ? { filePath: path } : undefined
        );
        return response.data;
      } catch (error) {
        handleError(error);
        throw error;
      } finally {
        setLoading(false);
      }
    },
    [serverid, stackname, handleError]
  );

  const readFile = useCallback(
    async (path: string): Promise<FileContent> => {
      try {
        setLoading(true);
        const response = await getApiV1ServersServeridStacksStacknameFilesRead(
          serverid,
          stackname,
          { filePath: path }
        );
        return response.data;
      } catch (error) {
        handleError(error);
        throw error;
      } finally {
        setLoading(false);
      }
    },
    [serverid, stackname, handleError]
  );

  const writeFile = useCallback(
    async (request: WriteFileRequest): Promise<void> => {
      try {
        setLoading(true);
        await postApiV1ServersServeridStacksStacknameFilesWrite(serverid, stackname, request);
      } catch (error) {
        handleError(error);
      } finally {
        setLoading(false);
      }
    },
    [serverid, stackname, handleError]
  );

  const createDirectory = useCallback(
    async (request: CreateDirectoryRequest): Promise<void> => {
      try {
        setLoading(true);
        await postApiV1ServersServeridStacksStacknameFilesMkdir(serverid, stackname, request);
      } catch (error) {
        handleError(error);
      } finally {
        setLoading(false);
      }
    },
    [serverid, stackname, handleError]
  );

  const deleteFile = useCallback(
    async (request: DeleteRequest2): Promise<void> => {
      try {
        setLoading(true);
        await deleteApiV1ServersServeridStacksStacknameFilesDelete(serverid, stackname, request);
      } catch (error) {
        handleError(error);
      } finally {
        setLoading(false);
      }
    },
    [serverid, stackname, handleError]
  );

  const renameFile = useCallback(
    async (request: RenameRequest): Promise<void> => {
      try {
        setLoading(true);
        await postApiV1ServersServeridStacksStacknameFilesRename(serverid, stackname, request);
      } catch (error) {
        handleError(error);
      } finally {
        setLoading(false);
      }
    },
    [serverid, stackname, handleError]
  );

  const copyFile = useCallback(
    async (request: CopyRequest): Promise<void> => {
      try {
        setLoading(true);
        await postApiV1ServersServeridStacksStacknameFilesCopy(serverid, stackname, request);
      } catch (error) {
        handleError(error);
      } finally {
        setLoading(false);
      }
    },
    [serverid, stackname, handleError]
  );

  const uploadFile = useCallback(
    async (file: File, path: string): Promise<void> => {
      try {
        setLoading(true);
        await postApiV1ServersServeridStacksStacknameFilesUpload(serverid, stackname, {
          file,
          filePath: path,
        });
      } catch (error) {
        handleError(error);
      } finally {
        setLoading(false);
      }
    },
    [serverid, stackname, handleError]
  );

  const downloadFile = useCallback(
    async (path: string, filename?: string): Promise<void> => {
      try {
        setLoading(true);
        const response = await getApiV1ServersServeridStacksStacknameFilesDownload(
          serverid,
          stackname,
          { filePath: path, filename }
        );

        const blob = new Blob([response.data]);
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = filename || path.split('/').pop() || 'download';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        window.URL.revokeObjectURL(url);
      } catch (error) {
        handleError(error);
      } finally {
        setLoading(false);
      }
    },
    [serverid, stackname, handleError]
  );

  const chmodFile = useCallback(
    async (request: ChmodRequest): Promise<void> => {
      try {
        setLoading(true);
        await postApiV1ServersServeridStacksStacknameFilesChmod(serverid, stackname, request);
      } catch (error) {
        handleError(error);
      } finally {
        setLoading(false);
      }
    },
    [serverid, stackname, handleError]
  );

  const chownFile = useCallback(
    async (request: ChownRequest): Promise<void> => {
      try {
        setLoading(true);
        await postApiV1ServersServeridStacksStacknameFilesChown(serverid, stackname, request);
      } catch (error) {
        handleError(error);
      } finally {
        setLoading(false);
      }
    },
    [serverid, stackname, handleError]
  );

  const getDirectoryStats = useCallback(
    async (path?: string): Promise<DirectoryStats> => {
      try {
        setLoading(true);
        const response = await getApiV1ServersServeridStacksStacknameFilesStats(
          serverid,
          stackname,
          path ? { filePath: path } : undefined
        );
        return response.data;
      } catch (error) {
        handleError(error);
        throw error;
      } finally {
        setLoading(false);
      }
    },
    [serverid, stackname, handleError]
  );

  return {
    loading,
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
  };
};
