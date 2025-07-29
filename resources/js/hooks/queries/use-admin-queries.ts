import type { HealthStatus, Server } from '@/types/entities';
import { useQuery } from '@tanstack/react-query';

export function useAdminServer(serverId: number, enabled = true) {
    return useQuery({
        queryKey: ['admin', 'servers', serverId],
        queryFn: async () => {
            const response = await fetch(`/admin/servers/${serverId}`, {
                headers: {
                    Accept: 'application/json',
                    'X-Requested-With': 'XMLHttpRequest',
                },
            });

            if (!response.ok) {
                throw new Error(`Failed to fetch server: ${response.statusText}`);
            }

            return response.json() as Promise<Server & { access_secret?: string }>;
        },
        enabled,
        staleTime: 10 * 1000,
    });
}

export function useAdminServerHealth(serverId: number, enabled = true) {
    return useQuery({
        queryKey: ['admin', 'servers', serverId, 'health'],
        queryFn: async () => {
            const response = await fetch(`/admin/servers/${serverId}/health`, {
                headers: {
                    Accept: 'application/json',
                    'X-Requested-With': 'XMLHttpRequest',
                },
            });

            if (!response.ok) {
                return {
                    status: 'error' as const,
                    health_status: 'unreachable' as const,
                    message: `Health check failed: ${response.statusText}`,
                    checked_at: new Date().toISOString(),
                };
            }

            return response.json() as Promise<HealthStatus>;
        },
        enabled,
        staleTime: 10 * 1000,
        refetchInterval: 10 * 1000,
        retry: 2,
        retryDelay: 1000,
    });
}
