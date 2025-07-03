import AppLayout from '@/layouts/app-layout';
import { type BreadcrumbItem } from '@/types';
import { Head, Link, usePage } from '@inertiajs/react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Server, Container, Shield, Activity, Layers3, ChevronRight, Plus, Settings } from 'lucide-react';
import type { Server as ServerType } from '@/types/entities';

const breadcrumbs: BreadcrumbItem[] = [
    {
        title: 'Dashboard',
        href: '/dashboard',
    },
];

interface Props {
    isAdmin: boolean;
}

export default function Dashboard({ isAdmin }: Props) {
    const { servers } = usePage().props as unknown as { servers: ServerType[] };
    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Dashboard" />
            
            <div className="space-y-8">
                {/* Header Section */}
                <div className="space-y-4">
                    <div className="flex items-center gap-3">
                        <div className="w-12 h-12 bg-gradient-to-br from-primary/20 to-accent/20 rounded-xl flex items-center justify-center">
                            <Layers3 className="h-6 w-6 text-primary" />
                        </div>
                        <div>
                            <h1 className="text-3xl font-bold tracking-tight">
                                Dashboard
                            </h1>
                            <p className="text-muted-foreground">
                                Manage your Docker Compose infrastructure
                            </p>
                        </div>
                    </div>

                    {/* Stats Bar */}
                    <div className="flex items-center gap-6 text-sm text-muted-foreground">
                        <div className="flex items-center gap-2">
                            <Activity className="h-4 w-4 text-green-500" />
                            <span>{servers.length} server{servers.length !== 1 ? 's' : ''} available</span>
                        </div>
                    </div>
                </div>

                {/* Main Content */}
                {servers.length === 0 ? (
                    <Card className="p-12 text-center">
                        <div className="mx-auto w-24 h-24 bg-gradient-to-br from-primary/10 to-accent/10 rounded-full flex items-center justify-center mb-6">
                            <Server className="h-12 w-12 text-muted-foreground" />
                        </div>
                        <h3 className="text-xl font-semibold mb-3">No Servers Available</h3>
                    </Card>
                ) : (
                    <div className="space-y-6">
                        <div className="flex items-center justify-between">
                            <div>
                                <h2 className="text-xl font-semibold">Your Servers</h2>
                                <p className="text-sm text-muted-foreground">
                                    Access and manage your containerized applications
                                </p>
                            </div>
                            {isAdmin && (
                                <Button variant="outline" asChild>
                                    <Link href="/admin/servers">
                                        <Settings className="mr-2 h-4 w-4" />
                                        Manage Servers
                                    </Link>
                                </Button>
                            )}
                        </div>
                        
                        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                            {servers.map((server) => (
                                <Card 
                                    key={server.id} 
                                    className="group hover:shadow-md transition-all duration-200 hover:scale-[1.02]" 
                                >
                                    <Link href={`/servers/${server.id}/stacks`} className="block">
                                        <CardHeader className="pb-3">
                                            <div className="flex items-start justify-between">
                                                <div className="flex items-center gap-3">
                                                    <div className="w-10 h-10 bg-gradient-to-br from-primary/20 to-accent/20 rounded-lg flex items-center justify-center">
                                                        <Server className="h-5 w-5 text-primary" />
                                                    </div>
                                                    <div className="min-w-0">
                                                        <CardTitle className="text-base group-hover:text-primary transition-colors truncate">
                                                            {server.display_name}
                                                        </CardTitle>
                                                    </div>
                                                </div>
                                                <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-primary group-hover:translate-x-1 transition-all flex-shrink-0" />
                                            </div>
                                        </CardHeader>
                                        <CardContent className="pt-0">
                                            <div className="flex items-center justify-between p-3 bg-muted/30 rounded-lg">
                                                <div className="flex items-center gap-2">
                                                    <Container className="h-4 w-4 text-muted-foreground" />
                                                    <span className="text-sm font-medium">Manage</span>
                                                </div>
                                            </div>
                                            
                                            {isAdmin && (
                                                <div className="mt-3 pt-3 border-t">
                                                    <Link 
                                                        href={`/admin/servers/${server.id}/permissions`}
                                                        onClick={(e) => e.stopPropagation()}
                                                        className="inline-flex items-center gap-2 text-xs text-muted-foreground hover:text-primary transition-colors"
                                                    >
                                                        <Shield className="h-3 w-3" />
                                                        Permissions
                                                    </Link>
                                                </div>
                                            )}
                                        </CardContent>
                                    </Link>
                                </Card>
                            ))}
                        </div>
                    </div>
                )}
            </div>
        </AppLayout>
    );
}
