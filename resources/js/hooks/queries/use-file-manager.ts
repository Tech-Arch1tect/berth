import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

interface FileInfo {
    name: string;
    isDir: boolean;
    size: number;
    mimeType: string;
    isBinary: boolean;
    modTime: string;
}

interface FilesResponse {
    stack: string;
    path: string;
    files: FileInfo[];
}

interface CreateFileData {
    path: string;
    content: string;
    isBinary: boolean;
    isBase64: boolean;
}

interface RenameFileData {
    path: string;
    newName: string;
}

interface FileData {
    stack: string;
    path: string;
    content: string;
    size: number;
    mimeType: string;
    isBinary: boolean;
    isBase64: boolean;
    modTime: string;
}

interface UpdateFileData {
    path: string;
    content: string;
}

export function useStackFiles(serverId: number, stackName: string, path: string = '.', enabled = true) {
    return useQuery({
        queryKey: ['servers', serverId, 'stacks', stackName, 'file-manager', 'files', path],
        queryFn: async (): Promise<FilesResponse> => {
            const params = new URLSearchParams({ path });
            const response = await fetch(`/api/servers/${serverId}/stacks/${stackName}/files?${params}`);

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({ error: 'Failed to fetch files' }));
                throw new Error(errorData.error || 'Failed to fetch files');
            }

            return response.json();
        },
        enabled,
        staleTime: 10 * 1000,
        retry: 2,
    });
}

export function useStackFile(serverId: number, stackName: string, filePath: string, enabled = true) {
    return useQuery({
        queryKey: ['servers', serverId, 'stacks', stackName, 'file-manager', 'file', filePath],
        queryFn: async (): Promise<FileData> => {
            const params = new URLSearchParams({ path: filePath });
            const response = await fetch(`/api/servers/${serverId}/stacks/${stackName}/file?${params}`);

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({ error: 'Failed to fetch file' }));
                throw new Error(errorData.error || 'Failed to fetch file');
            }

            return response.json();
        },
        enabled,
        staleTime: 10 * 1000,
        retry: 2,
    });
}

export function useCreateFile(serverId: number, stackName: string) {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async (data: CreateFileData) => {
            const response = await fetch(`/api/servers/${serverId}/stacks/${stackName}/file`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRF-TOKEN': document.querySelector('meta[name="csrf-token"]')?.getAttribute('content') || '',
                },
                body: JSON.stringify(data),
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({ error: 'Failed to create file' }));
                throw new Error(errorData.error || 'Failed to create file');
            }

            return response.json();
        },
        onSuccess: (_, variables) => {
            const { path } = variables;
            const dirPath = path.includes('/') ? path.substring(0, path.lastIndexOf('/')) : '.';

            queryClient.invalidateQueries({
                queryKey: ['servers', serverId, 'stacks', stackName, 'file-manager', 'files', dirPath],
            });

            toast.success('File created successfully');
        },
        onError: (error) => {
            toast.error(`Failed to create file: ${error.message}`);
        },
    });
}

export function useUpdateFile(serverId: number, stackName: string) {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async (data: UpdateFileData) => {
            const response = await fetch(`/api/servers/${serverId}/stacks/${stackName}/file`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRF-TOKEN': document.querySelector('meta[name="csrf-token"]')?.getAttribute('content') || '',
                },
                body: JSON.stringify(data),
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({ error: 'Failed to update file' }));
                throw new Error(errorData.error || 'Failed to update file');
            }

            return response.json();
        },
        onMutate: async (variables) => {
            await queryClient.cancelQueries({
                queryKey: ['servers', serverId, 'stacks', stackName, 'file-manager', 'file', variables.path],
            });

            const previousFile = queryClient.getQueryData<FileData>([
                'servers',
                serverId,
                'stacks',
                stackName,
                'file-manager',
                'file',
                variables.path,
            ]);

            if (previousFile) {
                queryClient.setQueryData<FileData>(['servers', serverId, 'stacks', stackName, 'file-manager', 'file', variables.path], {
                    ...previousFile,
                    content: variables.content,
                    size: variables.content.length,
                });
            }

            return { previousFile };
        },
        onError: (err, variables, context) => {
            if (context?.previousFile) {
                queryClient.setQueryData(['servers', serverId, 'stacks', stackName, 'file-manager', 'file', variables.path], context.previousFile);
            }
            toast.error(`Failed to update file: ${err.message}`);
        },
        onSuccess: (_, variables) => {
            toast.success('File updated successfully');

            const dirPath = variables.path.includes('/') ? variables.path.substring(0, variables.path.lastIndexOf('/')) : '.';
            queryClient.invalidateQueries({
                queryKey: ['servers', serverId, 'stacks', stackName, 'file-manager', 'files', dirPath],
            });
        },
        onSettled: (_, __, variables) => {
            queryClient.invalidateQueries({
                queryKey: ['servers', serverId, 'stacks', stackName, 'file-manager', 'file', variables.path],
            });
        },
    });
}

export function useRenameFile(serverId: number, stackName: string) {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async ({ path, newName }: RenameFileData) => {
            const response = await fetch(`/api/servers/${serverId}/stacks/${stackName}/file?path=${encodeURIComponent(path)}`, {
                method: 'PATCH',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRF-TOKEN': document.querySelector('meta[name="csrf-token"]')?.getAttribute('content') || '',
                },
                body: JSON.stringify({ newName }),
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({ error: 'Failed to rename file' }));
                throw new Error(errorData.error || 'Failed to rename file');
            }

            return response.json();
        },
        onSuccess: (_, variables) => {
            const { path } = variables;
            const dirPath = path.includes('/') ? path.substring(0, path.lastIndexOf('/')) : '.';

            queryClient.invalidateQueries({
                queryKey: ['servers', serverId, 'stacks', stackName, 'file-manager', 'files', dirPath],
            });

            toast.success('File renamed successfully');
        },
        onError: (error) => {
            toast.error(`Failed to rename file: ${error.message}`);
        },
    });
}

export function useDeleteFile(serverId: number, stackName: string) {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async ({ path, isDir }: { path: string; isDir: boolean }) => {
            const params = new URLSearchParams({ path });
            if (isDir) {
                params.append('recursive', 'true');
            }

            const response = await fetch(`/api/servers/${serverId}/stacks/${stackName}/file?${params}`, {
                method: 'DELETE',
                headers: {
                    'X-CSRF-TOKEN': document.querySelector('meta[name="csrf-token"]')?.getAttribute('content') || '',
                },
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({ error: 'Failed to delete file' }));
                throw new Error(errorData.error || 'Failed to delete file');
            }

            return response.json();
        },
        onSuccess: (_, variables) => {
            const { path } = variables;
            const dirPath = path.includes('/') ? path.substring(0, path.lastIndexOf('/')) : '.';

            queryClient.invalidateQueries({
                queryKey: ['servers', serverId, 'stacks', stackName, 'file-manager', 'files', dirPath],
            });

            toast.success('File deleted successfully');
        },
        onError: (error) => {
            toast.error(`Failed to delete file: ${error.message}`);
        },
    });
}
