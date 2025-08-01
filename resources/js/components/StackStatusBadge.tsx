import { Badge } from '@/components/ui/badge';
import type { Stack } from '@/types/entities';
import { Activity, AlertTriangle, Loader2, Pause, Square } from 'lucide-react';

interface StackStatusBadgeProps {
    stack: Stack & { isLoadingStatus?: boolean };
    size?: 'sm' | 'default';
}

export default function StackStatusBadge({ stack, size = 'default' }: StackStatusBadgeProps) {
    const iconSize = size === 'sm' ? 'h-2.5 w-2.5' : 'h-3 w-3';
    const className = size === 'sm' ? 'text-xs' : '';

    // Show loading state while fetching status
    if (stack.isLoadingStatus) {
        return (
            <Badge variant="outline" className={`bg-muted/50 ${className} gap-1`}>
                <Loader2 className={`${iconSize} animate-spin`} />
                Loading
            </Badge>
        );
    }

    if (!stack.parsed_successfully) {
        return (
            <Badge variant="destructive" className={`border-red-500/30 bg-red-500/10 text-red-700 dark:text-red-400 ${className} gap-1`}>
                <AlertTriangle className={iconSize} />
                Parse Error
            </Badge>
        );
    }

    if (stack.service_count === 0) {
        return (
            <Badge variant="secondary" className={`bg-muted/50 ${className} gap-1`}>
                <Square className={iconSize} />
                No Services
            </Badge>
        );
    }

    // Show service status if available
    if (stack.overall_status) {
        switch (stack.overall_status) {
            case 'running':
                return (
                    <Badge variant="default" className={`border-green-500/30 bg-green-500/10 text-green-700 dark:text-green-400 ${className} gap-1`}>
                        <Activity className={iconSize} />
                        Running
                    </Badge>
                );
            case 'stopped':
                return (
                    <Badge variant="outline" className={`border-red-500/30 bg-red-500/10 text-red-700 dark:text-red-400 ${className} gap-1`}>
                        <Square className={iconSize} />
                        Stopped
                    </Badge>
                );
            case 'partial':
                return (
                    <Badge
                        variant="secondary"
                        className={`border-yellow-500/30 bg-yellow-500/10 text-yellow-700 dark:text-yellow-400 ${className} gap-1`}
                    >
                        <Pause className={iconSize} />
                        Partial
                    </Badge>
                );
            case 'unknown':
            default:
                return (
                    <Badge variant="outline" className={`bg-muted/50 ${className} gap-1`}>
                        <AlertTriangle className={iconSize} />
                        Unknown
                    </Badge>
                );
        }
    }

    return null;
}
