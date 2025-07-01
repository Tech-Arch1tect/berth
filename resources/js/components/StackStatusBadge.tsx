import { Badge } from '@/components/ui/badge';
import type { Stack } from '@/types/entities';

interface StackStatusBadgeProps {
    stack: Stack;
}

export default function StackStatusBadge({ stack }: StackStatusBadgeProps) {
    if (!stack.parsed_successfully) {
        return <Badge variant="destructive">Parse Error</Badge>;
    }
    
    if (stack.service_count === 0) {
        return <Badge variant="secondary">No Services</Badge>;
    }
    
    // Show service status if available
    if (stack.overall_status) {
        switch (stack.overall_status) {
            case 'running':
                return <Badge variant="default">Running</Badge>;
            case 'stopped':
                return <Badge variant="outline">Stopped</Badge>;
            case 'partial':
                return <Badge variant="secondary">Partial</Badge>;
            case 'unknown':
            default:
                return <Badge variant="outline">Unknown</Badge>;
        }
    }
    
    return null;
}