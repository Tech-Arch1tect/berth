import { apiGet } from '@/utils/api';
import { useQuery } from '@tanstack/react-query';

interface ServerStats {
    total_stacks: number;
    running_stacks: number;
    total_services: number;
    running_services: number;
    status: 'online' | 'offline';
    error?: string;
}

export function useDashboardStats() {
    return useQuery({
        queryKey: ['dashboard', 'stats'],
        queryFn: async () => {
            const response = await apiGet<Record<number, ServerStats>>('/api/dashboard/stats');
            if (!response.success) {
                throw new Error(response.error || 'Failed to fetch dashboard stats');
            }
            return response.data!;
        },
        staleTime: 10 * 1000,
        refetchInterval: 10 * 1000,
    });
}
