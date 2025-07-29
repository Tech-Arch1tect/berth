import { useQuery } from '@tanstack/react-query';

interface AppConfig {
    agent_timeout: number;
}

export function useAppConfig() {
    return useQuery({
        queryKey: ['config'],
        queryFn: async (): Promise<AppConfig> => {
            const response = await fetch('/api/config', {
                credentials: 'include',
            });

            if (!response.ok) {
                throw new Error(`Failed to fetch config: ${response.statusText}`);
            }

            return response.json();
        },
        staleTime: 10 * 1000,
        gcTime: 5 * 60 * 1000,
        retry: 2,
    });
}
