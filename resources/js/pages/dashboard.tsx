import { PlaceholderPattern } from '@/components/ui/placeholder-pattern';
import AppLayout from '@/layouts/app-layout';
import { type BreadcrumbItem } from '@/types';
import { Head, Link } from '@inertiajs/react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Server, Container, Settings, Globe, Lock, Shield } from 'lucide-react';

const breadcrumbs: BreadcrumbItem[] = [
    {
        title: 'Dashboard',
        href: '/dashboard',
    },
];

interface ServerType {
    id: number;
    display_name: string;
    hostname: string;
    port: number;
    https: boolean;
    created_at: string;
    updated_at: string;
}

interface Props {
    servers: ServerType[];
    isAdmin: boolean;
}

export default function Dashboard({ servers, isAdmin }: Props) {
    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Dashboard" />
            <div className="space-y-6">
                <div className="flex justify-between items-center">
                    <h1 className="text-2xl font-bold">Dashboard</h1>
                    {isAdmin && (
                        <Link href="/admin/servers">
                            <Button variant="outline">
                                <Settings className="mr-2" size={16} />
                                Admin Panel
                            </Button>
                        </Link>
                    )}
                </div>

                {servers.length === 0 ? (
                    <Card>
                        <CardContent className="pt-6 text-center">
                            <Server className="mx-auto mb-4 text-gray-400" size={48} />
                            <h3 className="text-lg font-semibold mb-2">No Servers Available</h3>
                            <p className="text-gray-600 dark:text-gray-400 mb-4">
                                {isAdmin 
                                    ? "You haven't added any servers yet." 
                                    : "You don't have access to any servers. Contact your administrator to get access."
                                }
                            </p>
                            {isAdmin && (
                                <Link href="/admin/servers">
                                    <Button>Add Your First Server</Button>
                                </Link>
                            )}
                        </CardContent>
                    </Card>
                ) : (
                    <div className="grid gap-4">
                        <h2 className="text-lg font-semibold">Your Servers</h2>
                        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                            {servers.map((server) => (
                                <Card key={server.id} className="hover:shadow-md transition-shadow">
                                    <CardHeader>
                                        <CardTitle className="flex items-center gap-2">
                                            <Server size={20} />
                                            {server.display_name}
                                            <Badge variant={server.https ? "default" : "secondary"}>
                                                {server.https ? "HTTPS" : "HTTP"}
                                            </Badge>
                                        </CardTitle>
                                        <p className="text-sm text-gray-600 dark:text-gray-400">
                                            {server.https ? "https" : "http"}://{server.hostname}:{server.port}
                                        </p>
                                    </CardHeader>
                                    <CardContent>
                                        <div className="flex gap-2">
                                            <Link href={`/servers/${server.id}/stacks`}>
                                                <Button variant="outline" size="sm">
                                                    <Container size={16} className="mr-1" />
                                                    View Stacks
                                                </Button>
                                            </Link>
                                            {isAdmin && (
                                                <Link href={`/admin/servers/${server.id}/permissions`}>
                                                    <Button variant="ghost" size="sm">
                                                        <Shield size={16} />
                                                    </Button>
                                                </Link>
                                            )}
                                        </div>
                                    </CardContent>
                                </Card>
                            ))}
                        </div>
                    </div>
                )}
            </div>
        </AppLayout>
    );
}
