import type { Stack } from '@/types/entities';
import { apiPost } from '@/utils/api';
import { useMutation, useQueryClient } from '@tanstack/react-query';

export function useRefreshStacks(serverId: number) {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async () => {
            const response = await apiPost(`/api/servers/${serverId}/stacks/refresh`);
            if (!response.success) {
                throw new Error(response.error || 'Failed to refresh stacks');
            }
            return response.data;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({
                queryKey: ['servers', serverId, 'stacks'],
            });

            queryClient.invalidateQueries({
                queryKey: ['dashboard', 'stats'],
            });
        },
    });
}

export function useRefreshStackStatus(serverId: number, stackName: string) {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async () => {
            return Promise.resolve();
        },
        onSuccess: () => {
            queryClient.invalidateQueries({
                queryKey: ['servers', serverId, 'stacks', stackName, 'status'],
            });

            queryClient.invalidateQueries({
                queryKey: ['servers', serverId, 'stacks'],
            });
        },
    });
}

export function useOptimisticStackUpdate(serverId: number) {
    const queryClient = useQueryClient();

    const updateStackOptimistically = (stackName: string, updates: Partial<Stack>) => {
        queryClient.setQueryData<Stack[]>(['servers', serverId, 'stacks'], (oldData) => {
            if (!oldData) return oldData;

            return oldData.map((stack) => (stack.name === stackName ? { ...stack, ...updates } : stack));
        });
    };

    const revertStackUpdate = () => {
        queryClient.invalidateQueries({
            queryKey: ['servers', serverId, 'stacks'],
        });
    };

    return {
        updateStackOptimistically,
        revertStackUpdate,
    };
}
