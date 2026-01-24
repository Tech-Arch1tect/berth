import { useMutation, useQueryClient } from '@tanstack/react-query';
import { usePage } from '@inertiajs/react';
import {
  useGetApiV1ServersServeridStacksStacknameFiles,
  useGetApiV1ServersServeridStacksStacknameFilesRead,
  getGetApiV1ServersServeridStacksStacknameFilesQueryKey,
  getGetApiV1ServersServeridStacksStacknameFilesReadQueryKey,
  postApiV1ServersServeridStacksStacknameFilesWrite,
  postApiV1ServersServeridStacksStacknameFilesMkdir,
  deleteApiV1ServersServeridStacksStacknameFilesDelete,
  postApiV1ServersServeridStacksStacknameFilesRename,
  postApiV1ServersServeridStacksStacknameFilesCopy,
  postApiV1ServersServeridStacksStacknameFilesChmod,
  postApiV1ServersServeridStacksStacknameFilesChown,
} from '../api/generated/files/files';
import type {
  PostApiV1ServersServeridStacksStacknameFilesWriteBody,
  PostApiV1ServersServeridStacksStacknameFilesMkdirBody,
  DeleteApiV1ServersServeridStacksStacknameFilesDeleteBody,
  PostApiV1ServersServeridStacksStacknameFilesRenameBody,
  PostApiV1ServersServeridStacksStacknameFilesCopyBody,
  PostApiV1ServersServeridStacksStacknameFilesChmodBody,
  PostApiV1ServersServeridStacksStacknameFilesChownBody,
} from '../api/generated/models';
import { apiClient } from '../lib/api';

interface UseFileQueriesOptions {
  serverid: number;
  stackname: string;
}

const fileQueryKeys = {
  all: (serverid: number, stackname: string) => ['files', serverid, stackname] as const,
  directory: (serverid: number, stackname: string, path: string) =>
    getGetApiV1ServersServeridStacksStacknameFilesQueryKey(
      serverid,
      stackname,
      path ? { path } : undefined
    ),
  content: (serverid: number, stackname: string, path: string) =>
    getGetApiV1ServersServeridStacksStacknameFilesReadQueryKey(serverid, stackname, { path }),
};

export function useDirectoryQuery(
  serverid: number,
  stackname: string,
  path: string,
  enabled = true
) {
  return useGetApiV1ServersServeridStacksStacknameFiles(
    serverid,
    stackname,
    path ? { path } : undefined,
    {
      query: {
        enabled,
        staleTime: 0,
        gcTime: 5 * 60 * 1000,
        refetchOnWindowFocus: true,
        refetchOnMount: true,
        retry: 1,
        select: (response) => response.data,
      },
    }
  );
}

export function useFileContentQuery(
  serverid: number,
  stackname: string,
  path: string,
  enabled = true
) {
  return useGetApiV1ServersServeridStacksStacknameFilesRead(
    serverid,
    stackname,
    { path },
    {
      query: {
        enabled: enabled && !!path,
        staleTime: 0,
        gcTime: 5 * 60 * 1000,
        refetchOnWindowFocus: true,
        refetchOnMount: true,
        retry: 1,
        select: (response) => response.data,
      },
    }
  );
}

export function useFileMutations({ serverid, stackname }: UseFileQueriesOptions) {
  const queryClient = useQueryClient();
  const { props } = usePage();
  const csrfToken = props.csrfToken as string | undefined;

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
    mutationFn: async (request: PostApiV1ServersServeridStacksStacknameFilesWriteBody) => {
      await postApiV1ServersServeridStacksStacknameFilesWrite(serverid, stackname, request);
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
    mutationFn: async (request: PostApiV1ServersServeridStacksStacknameFilesMkdirBody) => {
      await postApiV1ServersServeridStacksStacknameFilesMkdir(serverid, stackname, request);
    },
    onSuccess: (_, variables) => {
      const parentPath = variables.path.split('/').slice(0, -1).join('/');
      invalidateDirectory(parentPath);
    },
  });

  const deleteFile = useMutation({
    mutationFn: async (request: DeleteApiV1ServersServeridStacksStacknameFilesDeleteBody) => {
      await deleteApiV1ServersServeridStacksStacknameFilesDelete(serverid, stackname, request);
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
    mutationFn: async (request: PostApiV1ServersServeridStacksStacknameFilesRenameBody) => {
      await postApiV1ServersServeridStacksStacknameFilesRename(serverid, stackname, request);
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
    mutationFn: async (request: PostApiV1ServersServeridStacksStacknameFilesCopyBody) => {
      await postApiV1ServersServeridStacksStacknameFilesCopy(serverid, stackname, request);
    },
    onSuccess: (_, variables) => {
      const targetParent = variables.target_path.split('/').slice(0, -1).join('/');
      invalidateDirectory(targetParent);
    },
  });

  const chmodFile = useMutation({
    mutationFn: async (request: PostApiV1ServersServeridStacksStacknameFilesChmodBody) => {
      await postApiV1ServersServeridStacksStacknameFilesChmod(serverid, stackname, request);
    },
    onSuccess: (_, variables) => {
      const parentPath = variables.path.split('/').slice(0, -1).join('/');
      invalidateDirectory(parentPath);
    },
  });

  const chownFile = useMutation({
    mutationFn: async (request: PostApiV1ServersServeridStacksStacknameFilesChownBody) => {
      await postApiV1ServersServeridStacksStacknameFilesChown(serverid, stackname, request);
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

      await apiClient({
        url: `/api/v1/servers/${serverid}/stacks/${stackname}/files/upload`,
        method: 'POST',
        data: formData,
        headers: {
          'Content-Type': 'multipart/form-data',
          ...(csrfToken ? { 'X-CSRF-Token': csrfToken } : {}),
        },
      });
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
