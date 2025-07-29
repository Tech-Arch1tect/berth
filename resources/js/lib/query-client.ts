import { QueryClient } from '@tanstack/react-query';

export const queryClient = new QueryClient({
    defaultOptions: {
        queries: {
            staleTime: 10 * 1000,
            gcTime: 5 * 60 * 1000,
            retry: 3,
            retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
            refetchOnWindowFocus: true,
            refetchOnReconnect: true,
            refetchInterval: (query) => {
                if (query.queryKey.some((key) => typeof key === 'string' && (key.includes('status') || key.includes('stats')))) {
                    return 10000;
                }
                return false;
            },
        },
        mutations: {
            retry: 1,
            onError: (error) => {
                console.error('Mutation error:', error);
            },
        },
    },
});
