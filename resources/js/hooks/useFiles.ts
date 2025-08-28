import { useState, useCallback } from 'react';
import axios from 'axios';
import { usePage } from '@inertiajs/react';
import {
  DirectoryListing,
  FileContent,
  WriteFileRequest,
  CreateDirectoryRequest,
  DeleteRequest,
  RenameRequest,
  CopyRequest,
} from '../types/files';

interface UseFilesOptions {
  serverId: number;
  stackName: string;
  onError?: (error: string) => void;
}

export const useFiles = ({ serverId, stackName, onError }: UseFilesOptions) => {
  const [loading, setLoading] = useState(false);
  const { props } = usePage();
  const csrfToken = props.csrfToken as string | undefined;

  const baseUrl = `/api/servers/${serverId}/stacks/${stackName}/files`;

  const getHeaders = useCallback(() => {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'X-Requested-With': 'XMLHttpRequest',
    };
    if (csrfToken) {
      headers['X-CSRF-Token'] = csrfToken;
    }
    return headers;
  }, [csrfToken]);

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
        const params = path ? { path } : {};
        const response = await axios.get<DirectoryListing>(baseUrl, { params });
        return response.data;
      } catch (error) {
        handleError(error);
        throw error;
      } finally {
        setLoading(false);
      }
    },
    [baseUrl, handleError]
  );

  const readFile = useCallback(
    async (path: string): Promise<FileContent> => {
      try {
        setLoading(true);
        const response = await axios.get<FileContent>(`${baseUrl}/read`, {
          params: { path },
        });
        return response.data;
      } catch (error) {
        handleError(error);
        throw error;
      } finally {
        setLoading(false);
      }
    },
    [baseUrl, handleError]
  );

  const writeFile = useCallback(
    async (request: WriteFileRequest): Promise<void> => {
      try {
        setLoading(true);
        await axios.post(`${baseUrl}/write`, request, { headers: getHeaders() });
      } catch (error) {
        handleError(error);
      } finally {
        setLoading(false);
      }
    },
    [baseUrl, handleError, getHeaders]
  );

  const createDirectory = useCallback(
    async (request: CreateDirectoryRequest): Promise<void> => {
      try {
        setLoading(true);
        await axios.post(`${baseUrl}/mkdir`, request, { headers: getHeaders() });
      } catch (error) {
        handleError(error);
      } finally {
        setLoading(false);
      }
    },
    [baseUrl, handleError, getHeaders]
  );

  const deleteFile = useCallback(
    async (request: DeleteRequest): Promise<void> => {
      try {
        setLoading(true);
        await axios.delete(`${baseUrl}/delete`, { data: request, headers: getHeaders() });
      } catch (error) {
        handleError(error);
      } finally {
        setLoading(false);
      }
    },
    [baseUrl, handleError, getHeaders]
  );

  const renameFile = useCallback(
    async (request: RenameRequest): Promise<void> => {
      try {
        setLoading(true);
        await axios.post(`${baseUrl}/rename`, request, { headers: getHeaders() });
      } catch (error) {
        handleError(error);
      } finally {
        setLoading(false);
      }
    },
    [baseUrl, handleError, getHeaders]
  );

  const copyFile = useCallback(
    async (request: CopyRequest): Promise<void> => {
      try {
        setLoading(true);
        await axios.post(`${baseUrl}/copy`, request, { headers: getHeaders() });
      } catch (error) {
        handleError(error);
      } finally {
        setLoading(false);
      }
    },
    [baseUrl, handleError, getHeaders]
  );

  const downloadFile = useCallback(
    async (path: string, filename?: string): Promise<void> => {
      try {
        setLoading(true);
        const params = filename ? { path, filename } : { path };
        const response = await axios.get(`${baseUrl}/download`, {
          params,
          responseType: 'blob',
        });

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
    [baseUrl, handleError]
  );

  return {
    loading,
    listDirectory,
    readFile,
    writeFile,
    createDirectory,
    deleteFile,
    renameFile,
    copyFile,
    downloadFile,
  };
};
