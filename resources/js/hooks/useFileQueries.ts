import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
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
  ChmodRequest,
  ChownRequest,
} from '../types/files';

interface UseFileQueriesOptions {
  serverid: number;
  stackname: string;
}

const fileQueryKeys = {
  all: (serverid: number, stackname: string) => ['files', serverid, stackname] as const,
  directory: (serverid: number, stackname: string, path: string) =>
    [...fileQueryKeys.all(serverid, stackname), 'directory', path] as const,
  content: (serverid: number, stackname: string, path: string) =>
    [...fileQueryKeys.all(serverid, stackname), 'content', path] as const,
};

export function useDirectoryQuery(
  serverid: number,
  stackname: string,
  path: string,
  enabled = true
) {
  const baseUrl = `/api/servers/${serverid}/stacks/${stackname}/files`;

  return useQuery({
    queryKey: fileQueryKeys.directory(serverid, stackname, path),
    queryFn: async (): Promise<DirectoryListing> => {
      const params = path ? { path } : {};
      const response = await axios.get<DirectoryListing>(baseUrl, { params });
      return response.data;
    },
    enabled,
    staleTime: 0,
    gcTime: 5 * 60 * 1000,
    refetchOnWindowFocus: true,
    refetchOnMount: true,
    retry: 1,
  });
}

export function useFileContentQuery(
  serverid: number,
  stackname: string,
  path: string,
  enabled = true
) {
  const baseUrl = `/api/servers/${serverid}/stacks/${stackname}/files`;

  return useQuery({
    queryKey: fileQueryKeys.content(serverid, stackname, path),
    queryFn: async (): Promise<FileContent> => {
      const response = await axios.get<FileContent>(`${baseUrl}/read`, {
        params: { path },
      });
      return response.data;
    },
    enabled: enabled && !!path,
    staleTime: 0,
    gcTime: 5 * 60 * 1000,
    refetchOnWindowFocus: true,
    refetchOnMount: true,
    retry: 1,
  });
}

export function useFileMutations({ serverid, stackname }: UseFileQueriesOptions) {
  const queryClient = useQueryClient();
  const { props } = usePage();
  const csrfToken = props.csrfToken as string | undefined;
  const baseUrl = `/api/servers/${serverid}/stacks/${stackname}/files`;

  const getHeaders = () => {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'X-Requested-With': 'XMLHttpRequest',
    };
    if (csrfToken) {
      headers['X-CSRF-Token'] = csrfToken;
    }
    return headers;
  };

  const invalidateAll = () => {
    queryClient.invalidateQueries({
      queryKey: fileQueryKeys.all(serverid, stackname),
    });
  };

  const invalidateDirectory = (path: string) => {
    queryClient.invalidateQueries({
      queryKey: fileQueryKeys.directory(serverid, stackname, path),
    });
    const parentPath = path.split('/').slice(0, -1).join('/');
    if (parentPath !== path) {
      queryClient.invalidateQueries({
        queryKey: fileQueryKeys.directory(serverid, stackname, parentPath),
      });
    }
  };

  const writeFile = useMutation({
    mutationFn: async (request: WriteFileRequest) => {
      await axios.post(`${baseUrl}/write`, request, { headers: getHeaders() });
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: fileQueryKeys.content(serverid, stackname, variables.path),
      });
      const parentPath = variables.path.split('/').slice(0, -1).join('/');
      invalidateDirectory(parentPath);
    },
  });

  const createDirectory = useMutation({
    mutationFn: async (request: CreateDirectoryRequest) => {
      await axios.post(`${baseUrl}/mkdir`, request, { headers: getHeaders() });
    },
    onSuccess: (_, variables) => {
      const parentPath = variables.path.split('/').slice(0, -1).join('/');
      invalidateDirectory(parentPath);
    },
  });

  const deleteFile = useMutation({
    mutationFn: async (request: DeleteRequest) => {
      await axios.delete(`${baseUrl}/delete`, { data: request, headers: getHeaders() });
    },
    onSuccess: (_, variables) => {
      const parentPath = variables.path.split('/').slice(0, -1).join('/');
      invalidateDirectory(parentPath);
      queryClient.removeQueries({
        queryKey: fileQueryKeys.content(serverid, stackname, variables.path),
      });
    },
  });

  const renameFile = useMutation({
    mutationFn: async (request: RenameRequest) => {
      await axios.post(`${baseUrl}/rename`, request, { headers: getHeaders() });
    },
    onSuccess: (_, variables) => {
      const oldParent = variables.old_path.split('/').slice(0, -1).join('/');
      const newParent = variables.new_path.split('/').slice(0, -1).join('/');
      invalidateDirectory(oldParent);
      if (oldParent !== newParent) {
        invalidateDirectory(newParent);
      }
      queryClient.removeQueries({
        queryKey: fileQueryKeys.content(serverid, stackname, variables.old_path),
      });
    },
  });

  const copyFile = useMutation({
    mutationFn: async (request: CopyRequest) => {
      await axios.post(`${baseUrl}/copy`, request, { headers: getHeaders() });
    },
    onSuccess: (_, variables) => {
      const targetParent = variables.target_path.split('/').slice(0, -1).join('/');
      invalidateDirectory(targetParent);
    },
  });

  const chmodFile = useMutation({
    mutationFn: async (request: ChmodRequest) => {
      await axios.post(`${baseUrl}/chmod`, request, { headers: getHeaders() });
    },
    onSuccess: (_, variables) => {
      const parentPath = variables.path.split('/').slice(0, -1).join('/');
      invalidateDirectory(parentPath);
    },
  });

  const chownFile = useMutation({
    mutationFn: async (request: ChownRequest) => {
      await axios.post(`${baseUrl}/chown`, request, { headers: getHeaders() });
    },
    onSuccess: (_, variables) => {
      const parentPath = variables.path.split('/').slice(0, -1).join('/');
      invalidateDirectory(parentPath);
    },
  });

  const uploadFile = useMutation({
    mutationFn: async ({ file, path }: { file: File; path: string }) => {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('path', path);

      const headers: Record<string, string> = {
        'X-Requested-With': 'XMLHttpRequest',
      };
      if (csrfToken) {
        headers['X-CSRF-Token'] = csrfToken;
      }

      await axios.post(`${baseUrl}/upload`, formData, { headers });
    },
    onSuccess: (_, variables) => {
      const parentPath = variables.path.split('/').slice(0, -1).join('/');
      invalidateDirectory(parentPath);
    },
  });

  return {
    writeFile,
    createDirectory,
    deleteFile,
    renameFile,
    copyFile,
    chmodFile,
    chownFile,
    uploadFile,
    invalidateAll,
    invalidateDirectory,
    queryKeys: fileQueryKeys,
  };
}

export { fileQueryKeys };
