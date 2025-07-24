import { Badge } from '@/components/ui/badge';
import { Activity, AlertTriangle, Loader2, Square } from 'lucide-react';

interface ServiceStatusBadgeProps {
    status: string | null;
    isLoading?: boolean;
    size?: 'sm' | 'default';
}

export default function ServiceStatusBadge({ status, isLoading, size = 'default' }: ServiceStatusBadgeProps) {
    const iconSize = size === 'sm' ? 'h-2.5 w-2.5' : 'h-3 w-3';
    const className = size === 'sm' ? 'text-xs' : '';

    if (isLoading) {
        return (
            <Badge variant="outline" className={`bg-muted/50 ${className}`}>
                <Loader2 className={`${iconSize} mr-1 animate-spin`} />
                Loading...
            </Badge>
        );
    }

    switch (status) {
        case 'running':
            return (
                <Badge variant="default" className={`border-green-500/30 bg-green-500/10 text-green-700 dark:text-green-400 ${className}`}>
                    <Activity className={`${iconSize} mr-1`} />
                    Running
                </Badge>
            );
        case 'stopped':
        case null:
            return (
                <Badge variant="outline" className={`border-red-500/30 bg-red-500/10 text-red-700 dark:text-red-400 ${className}`}>
                    <Square className={`${iconSize} mr-1`} />
                    Stopped
                </Badge>
            );
        default:
            return (
                <Badge variant="outline" className={`border-yellow-500/30 bg-yellow-500/10 text-yellow-700 dark:text-yellow-400 ${className}`}>
                    <AlertTriangle className={`${iconSize} mr-1`} />
                    {status}
                </Badge>
            );
    }
}
