import EnhancedStackServices from '@/components/EnhancedStackServices';
import type { Stack, UserPermissions } from '@/types/entities';

interface StackServicesTabProps {
    stack: Stack;
    userPermissions: UserPermissions;
    isOperating: boolean;
    isRefreshing: boolean;
    onStartService: (services?: string[], build?: boolean) => void;
    onStopService: (services?: string[]) => void;
    onPullService: (services?: string[]) => void;
}

export default function StackServicesTab({
    stack,
    userPermissions,
    isOperating,
    isRefreshing,
    onStartService,
    onStopService,
    onPullService,
}: StackServicesTabProps) {
    return (
        <EnhancedStackServices
            stack={stack}
            userPermissions={userPermissions}
            isOperating={isOperating}
            isRefreshing={isRefreshing}
            onStartService={onStartService}
            onStopService={onStopService}
            onPullService={onPullService}
        />
    );
}
