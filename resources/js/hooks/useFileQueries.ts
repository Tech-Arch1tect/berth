import { useMutation, useQueryClient } from '@tanstack/react-query';
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
  postApiV1ServersServeridStacksStacknameFilesUpload,
} from '../api/generated/files/files';
import type {
  WriteFileRequest,
  CreateDirectoryRequest,
  DeleteRequest2,
  RenameRequest,
  CopyRequest,
  ChmodRequest,
  ChownRequest,
} from '../api/generated/models';

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
    mutationFn: async (request: CreateDirectoryRequest) => {
      await postApiV1ServersServeridStacksStacknameFilesMkdir(serverid, stackname, request);
    },
    onSuccess: (_, variables) => {
      const parentPath = variables.path.split('/').slice(0, -1).join('/');
      invalidateDirectory(parentPath);
    },
  });

  const deleteFile = useMutation({
    mutationFn: async (request: DeleteRequest2) => {
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
    mutationFn: async (request: RenameRequest) => {
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
    mutationFn: async (request: CopyRequest) => {
      await postApiV1ServersServeridStacksStacknameFilesCopy(serverid, stackname, request);
    },
    onSuccess: (_, variables) => {
      const targetParent = variables.target_path.split('/').slice(0, -1).join('/');
      invalidateDirectory(targetParent);
    },
  });

  const chmodFile = useMutation({
    mutationFn: async (request: ChmodRequest) => {
      await postApiV1ServersServeridStacksStacknameFilesChmod(serverid, stackname, request);
    },
    onSuccess: (_, variables) => {
      const parentPath = variables.path.split('/').slice(0, -1).join('/');
      invalidateDirectory(parentPath);
    },
  });

  const chownFile = useMutation({
    mutationFn: async (request: ChownRequest) => {
      await postApiV1ServersServeridStacksStacknameFilesChown(serverid, stackname, request);
    },
    onSuccess: (_, variables) => {
      const parentPath = variables.path.split('/').slice(0, -1).join('/');
      invalidateDirectory(parentPath);
    },
  });

  const uploadFile = useMutation({
    mutationFn: async ({ file, path }: { file: File; path: string }) => {
      await postApiV1ServersServeridStacksStacknameFilesUpload(serverid, stackname, {
        file,
        path,
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
