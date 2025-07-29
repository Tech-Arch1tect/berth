import { apiGet } from '@/utils/api';
import { useQuery } from '@tanstack/react-query';

interface LogEntry {
    timestamp: string;
    service: string;
    message: string;
    level?: string;
}

export function useStackLogs(serverId: number, stackName: string, serviceName?: string, lines = 100, enabled = true) {
    return useQuery({
        queryKey: ['servers', serverId, 'stacks', stackName, 'logs', serviceName, lines],
        queryFn: async () => {
            const params = new URLSearchParams({
                lines: lines.toString(),
            });

            if (serviceName) {
                params.set('service', serviceName);
            }

            const response = await apiGet<LogEntry[]>(`/api/servers/${serverId}/stacks/${stackName}/logs?${params}`);

            if (!response.success) {
                throw new Error(response.error || 'Failed to fetch logs');
            }
            return response.data!;
        },
        enabled,
    });
}
