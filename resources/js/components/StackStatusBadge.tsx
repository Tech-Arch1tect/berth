import { Badge } from '@/components/ui/badge';
import { AlertTriangle, Square, Pause, Activity, Loader2 } from 'lucide-react';
import type { Stack } from '@/types/entities';

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
            <Badge variant="outline" className={`bg-muted/50 ${className}`}>
                <Loader2 className={`${iconSize} mr-1 animate-spin`} />
                Loading...
            </Badge>
        );
    }

    if (!stack.parsed_successfully) {
        return (
            <Badge variant="destructive" className={`bg-red-500/10 text-red-700 border-red-500/30 dark:text-red-400 ${className}`}>
                <AlertTriangle className={`${iconSize} mr-1`} />
                Parse Error
            </Badge>
        );
    }
    
    if (stack.service_count === 0) {
        return (
            <Badge variant="secondary" className={`bg-muted/50 ${className}`}>
                <Square className={`${iconSize} mr-1`} />
                No Services
            </Badge>
        );
    }
    
    // Show service status if available
    if (stack.overall_status) {
        switch (stack.overall_status) {
            case 'running':
                return (
                    <Badge variant="default" className={`bg-green-500/10 text-green-700 border-green-500/30 dark:text-green-400 ${className}`}>
                        <Activity className={`${iconSize} mr-1`} />
                        Running
                    </Badge>
                );
            case 'stopped':
                return (
                    <Badge variant="outline" className={`bg-red-500/10 text-red-700 border-red-500/30 dark:text-red-400 ${className}`}>
                        <Square className={`${iconSize} mr-1`} />
                        Stopped
                    </Badge>
                );
            case 'partial':
                return (
                    <Badge variant="secondary" className={`bg-yellow-500/10 text-yellow-700 border-yellow-500/30 dark:text-yellow-400 ${className}`}>
                        <Pause className={`${iconSize} mr-1`} />
                        Partial
                    </Badge>
                );
            case 'unknown':
            default:
                return (
                    <Badge variant="outline" className={`bg-muted/50 ${className}`}>
                        <AlertTriangle className={`${iconSize} mr-1`} />
                        Unknown
                    </Badge>
                );
        }
    }
    
    return null;
}