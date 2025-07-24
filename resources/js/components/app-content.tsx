import { SidebarInset } from '@/components/ui/sidebar';
import * as React from 'react';

interface AppContentProps extends React.ComponentProps<'main'> {
    variant?: 'header' | 'sidebar';
}

export function AppContent({ variant = 'header', children, className, ...props }: AppContentProps) {
    if (variant === 'sidebar') {
        return (
            <SidebarInset className="flex flex-1 flex-col overflow-hidden" {...props}>
                <main className="flex flex-1 flex-col p-4 md:p-6">{children}</main>
            </SidebarInset>
        );
    }

    return (
        <main className={`mx-auto flex h-full w-full max-w-7xl flex-1 flex-col gap-4 p-4 md:p-6 ${className || ''}`} {...props}>
            {children}
        </main>
    );
}
