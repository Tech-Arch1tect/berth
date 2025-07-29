import type { Stack } from '@/types/entities';
import { apiGet } from '@/utils/api';
import { useQuery } from '@tanstack/react-query';

export function useServerStack(serverId: number, stackName: string, enabled = true) {
    return useQuery({
        queryKey: ['servers', serverId, 'stacks', stackName],
        queryFn: async () => {
            const response = await apiGet<{ stacks: Stack[] }>(`/api/servers/${serverId}/stacks`);
            if (!response.success) {
                throw new Error(response.error || 'Failed to fetch stacks');
            }

            const stack = response.data!.stacks.find((s) => s.name === stackName);
            if (!stack) {
                throw new Error('Stack not found');
            }

            return stack;
        },
        enabled: enabled && !!stackName,
        staleTime: 10 * 1000,
        refetchInterval: 10 * 1000,
    });
}
