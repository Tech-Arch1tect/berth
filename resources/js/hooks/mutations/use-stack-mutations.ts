import type { Stack } from '@/types/entities';
import { useMutation, useQueryClient } from '@tanstack/react-query';

export function useRefreshStacks(serverId: number) {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async () => {
            await queryClient.invalidateQueries({
                queryKey: ['servers', serverId, 'stacks'],
            });
            return { success: true };
        },
        onSuccess: () => {
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

export function useStackOperationSuccess(serverId: number, stackName?: string) {
    const queryClient = useQueryClient();

    const invalidateStackData = () => {
        queryClient.invalidateQueries({
            queryKey: ['servers', serverId, 'stacks'],
        });

        if (stackName) {
            queryClient.invalidateQueries({
                queryKey: ['servers', serverId, 'stacks', stackName],
            });

            queryClient.invalidateQueries({
                queryKey: ['servers', serverId, 'stacks', stackName, 'status'],
            });
        }

        queryClient.invalidateQueries({
            queryKey: ['dashboard', 'stats'],
        });

        queryClient.invalidateQueries({
            queryKey: ['servers', serverId, 'docker', 'system'],
        });

        queryClient.invalidateQueries({
            queryKey: ['servers', serverId, 'docker', 'system', 'df'],
        });

        queryClient.invalidateQueries({
            queryKey: ['servers', serverId, 'docker', 'system', 'info'],
        });

        if (stackName) {
            queryClient.invalidateQueries({
                queryKey: ['servers', serverId, 'stacks', stackName, 'logs'],
            });
        }
    };

    return { invalidateStackData };
}

export function useServerHealthRefresh(serverId: number) {
    const queryClient = useQueryClient();

    const invalidateServerHealth = () => {
        queryClient.invalidateQueries({
            queryKey: ['admin', 'servers', serverId, 'health'],
        });

        queryClient.invalidateQueries({
            queryKey: ['dashboard', 'stats'],
        });
    };

    return { invalidateServerHealth };
}
