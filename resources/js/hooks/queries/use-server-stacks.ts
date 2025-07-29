import type { Stack } from '@/types/entities';
import { apiGet } from '@/utils/api';
import { useQuery } from '@tanstack/react-query';

export function useServerStacks(serverId: number, enabled = true) {
    return useQuery({
        queryKey: ['servers', serverId, 'stacks'],
        queryFn: async () => {
            const response = await apiGet<{ stacks: Stack[] }>(`/api/servers/${serverId}/stacks`);
            if (!response.success) {
                throw new Error(response.error || 'Failed to fetch stacks');
            }
            return response.data!.stacks;
        },
        enabled,
        staleTime: 10 * 1000,
        refetchInterval: 10 * 1000,
    });
}
