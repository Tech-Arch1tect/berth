import { useState } from 'react';

interface UseStackOperationsProps {
    serverId: number;
    stackName: string;
    onProgress?: (title: string, url: string) => void;
    onRefresh?: () => void;
}

export function useStackOperations({ serverId, stackName, onProgress, onRefresh }: UseStackOperationsProps) {
    const [isOperating, setIsOperating] = useState(false);

    const startServices = async (services: string[] = [], build = false) => {
        if (isOperating) return;

        const params = new URLSearchParams({
            services: services.join(','),
        });

        if (build) {
            params.set('build', 'true');
        }

        const streamUrl = `/api/servers/${serverId}/stacks/${stackName}/up/stream?${params}`;
        const title = `Starting Stack: ${stackName}${build ? ' (with --build)' : ''}`;

        setIsOperating(true);
        onProgress?.(title, streamUrl);
    };

    const stopServices = async (services: string[] = []) => {
        if (isOperating) return;

        const params = new URLSearchParams({
            services: services.join(','),
        });

        const streamUrl = `/api/servers/${serverId}/stacks/${stackName}/down/stream?${params}`;
        const title = `Stopping Stack: ${stackName}`;

        setIsOperating(true);
        onProgress?.(title, streamUrl);
    };

    const handleOperationComplete = (success: boolean) => {
        setIsOperating(false);
        if (success) {
            onRefresh?.();
        }
    };

    return {
        isOperating,
        startServices,
        stopServices,
        handleOperationComplete,
    };
}
