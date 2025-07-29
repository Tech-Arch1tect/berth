import type { Stack, StackLike } from '@/types/entities';

export function calculateServiceStatusSummary(
    stack: Stack,
    serviceStatus: {
        stack: string;
        services: Array<{
            name: string;
            command: string;
            state: string;
            ports: string;
        }> | null;
    } | null,
): {
    statusSummary: { running: number; stopped: number; total: number };
    overallStatus: 'running' | 'stopped' | 'partial' | 'unknown';
} {
    let statusSummary = { running: 0, stopped: 0, total: 0 };
    let overallStatus: 'running' | 'stopped' | 'partial' | 'unknown' = 'unknown';

    if (serviceStatus && serviceStatus.services && Array.isArray(serviceStatus.services)) {
        const running = serviceStatus.services.filter((s) => s.state === 'running').length;
        const total = stack.service_count;
        const stopped = total - running;

        statusSummary = { running, stopped, total };

        if (running === 0) {
            overallStatus = 'stopped';
        } else if (running === total) {
            overallStatus = 'running';
        } else {
            overallStatus = 'partial';
        }
    } else if (serviceStatus && serviceStatus.services === null) {
        statusSummary = { running: 0, stopped: stack.service_count, total: stack.service_count };
        overallStatus = 'stopped';
    }

    return { statusSummary, overallStatus };
}

export function getServiceDisplayState(stack: StackLike, serviceName: string) {
    const serviceStatus = stack.service_status?.services?.find((s) => {
        const containerName = s.name.toLowerCase();
        const searchService = serviceName.toLowerCase();

        if (containerName === searchService) {
            return true;
        }

        const dockerComposePattern = new RegExp(`[^_]*_${searchService}_\\d+$`);
        if (dockerComposePattern.test(containerName)) {
            return true;
        }

        
        const dashPattern = new RegExp(`[^-]*-${searchService}-\\d+$`);
        if (dashPattern.test(containerName)) {
            return true;
        }

        
        if (containerName.endsWith(`_${searchService}`) || containerName.endsWith(`-${searchService}`)) {
            return true;
        }

        return false;
    });

    
    const isRunning = serviceStatus?.state === 'running';

    return {
        isRunning,
        displayState: isRunning ? 'running' : 'stopped',
        serviceStatus,
    };
}
