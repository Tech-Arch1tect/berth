import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAdminServer, useAdminServerHealth } from '@/hooks/queries/use-admin-queries';
import AppLayout from '@/layouts/app-layout';
import { type BreadcrumbItem } from '@/types';
import type { Server } from '@/types/entities';
import { Head, router, useForm } from '@inertiajs/react';
import { Activity, AlertCircle, CheckCircle, Clock, Edit, Eye, EyeOff, Plus, Server as ServerIcon, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';

const breadcrumbs: BreadcrumbItem[] = [
    { title: 'Dashboard', href: '/dashboard' },
    { title: 'Administration', href: '/admin' },
    { title: 'Servers', href: '/admin/servers' },
];

interface Props {
    servers: Server[];
}

function ServerItem({
    server,
    showSecret,
    onToggleSecret,
    onEdit,
    onDelete,
}: {
    server: Server;
    showSecret: boolean;
    onToggleSecret: () => void;
    onEdit: (server: Server) => void;
    onDelete: (server: Server) => void;
}) {
    const [healthCheckEnabled, setHealthCheckEnabled] = useState(false);

    const { data: serverWithSecret, isLoading: isLoadingSecret } = useAdminServer(server.id, showSecret);
    const { data: healthData, isLoading: isLoadingHealth, refetch: refetchHealth } = useAdminServerHealth(server.id, healthCheckEnabled);

    const handleHealthCheck = () => {
        setHealthCheckEnabled(true);
        refetchHealth();
    };

    const getHealthStatusIcon = (status?: string) => {
        switch (status) {
            case 'healthy':
                return <CheckCircle className="h-4 w-4 text-green-500" />;
            case 'unhealthy':
                return <AlertCircle className="h-4 w-4 text-red-500" />;
            default:
                return <Clock className="h-4 w-4 text-muted-foreground" />;
        }
    };

    const getHealthStatusText = (status?: string) => {
        switch (status) {
            case 'healthy':
                return 'Healthy';
            case 'unhealthy':
                return 'Unhealthy';
            default:
                return 'Unknown';
        }
    };

    const getHealthStatusVariant = (status?: string): 'default' | 'destructive' | 'secondary' | 'outline' => {
        switch (status) {
            case 'healthy':
                return 'default';
            case 'unhealthy':
                return 'destructive';
            default:
                return 'secondary';
        }
    };

    return (
        <Card key={server.id}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="flex items-center gap-2">
                    <ServerIcon className="h-5 w-5" />
                    {server.display_name}
                </CardTitle>
                <div className="flex items-center gap-2">
                    <Badge variant={getHealthStatusVariant(healthData?.status)}>
                        {getHealthStatusIcon(healthData?.status)}
                        <span className="ml-1">{getHealthStatusText(healthData?.status)}</span>
                    </Badge>
                    <Button variant="outline" size="sm" onClick={handleHealthCheck} disabled={isLoadingHealth}>
                        <Activity className={`mr-1 h-4 w-4 ${isLoadingHealth ? 'animate-spin' : ''}`} />
                        {isLoadingHealth ? 'Checking...' : 'Check Health'}
                    </Button>
                </div>
            </CardHeader>
            <CardContent>
                <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <Label className="text-sm font-medium text-muted-foreground">Hostname</Label>
                            <p className="font-mono text-sm">{server.hostname}</p>
                        </div>
                        <div>
                            <Label className="text-sm font-medium text-muted-foreground">Port</Label>
                            <p className="font-mono text-sm">{server.port}</p>
                        </div>
                        <div>
                            <Label className="text-sm font-medium text-muted-foreground">Protocol</Label>
                            <p className="text-sm">{server.https ? 'HTTPS' : 'HTTP'}</p>
                        </div>
                        <div>
                            <Label className="text-sm font-medium text-muted-foreground">Full URL</Label>
                            <p className="font-mono text-sm break-all">
                                {server.https ? 'https' : 'http'}://{server.hostname}:{server.port}
                            </p>
                        </div>
                    </div>

                    <div>
                        <div className="mb-2 flex items-center justify-between">
                            <Label className="text-sm font-medium text-muted-foreground">Access Secret</Label>
                            <Button variant="ghost" size="sm" onClick={onToggleSecret} disabled={isLoadingSecret}>
                                {showSecret ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                            </Button>
                        </div>
                        <div className="rounded bg-muted p-2 font-mono text-sm break-all">
                            {isLoadingSecret ? 'Loading...' : showSecret && serverWithSecret ? serverWithSecret.access_secret : '••••••••••••••••'}
                        </div>
                    </div>

                    {healthData && (
                        <div className="rounded-lg border bg-muted/30 p-3">
                            <div className="mb-2 flex items-center justify-between">
                                <span className="text-sm font-medium">Health Status</span>
                                <span className="text-xs text-muted-foreground">{new Date(healthData.checked_at).toLocaleString()}</span>
                            </div>
                            <div className="grid grid-cols-2 gap-2 text-sm">
                                {healthData.service && (
                                    <div>
                                        <span className="text-muted-foreground">Service:</span>
                                        <span className="ml-1 font-mono">{healthData.service}</span>
                                    </div>
                                )}
                                {healthData.docker_compose && (
                                    <div>
                                        <span className="text-muted-foreground">Docker Compose:</span>
                                        <span className="ml-1 font-mono">{healthData.docker_compose.version}</span>
                                    </div>
                                )}
                                {healthData.response_time && (
                                    <div>
                                        <span className="text-muted-foreground">Response Time:</span>
                                        <span className="ml-1">{Math.round(healthData.response_time * 1000)}ms</span>
                                    </div>
                                )}
                            </div>
                            {healthData.message && <div className="mt-2 text-sm text-destructive">{healthData.message}</div>}
                        </div>
                    )}

                    <div className="flex gap-2">
                        <Button variant="outline" size="sm" onClick={() => onEdit(server)}>
                            <Edit className="mr-1 h-4 w-4" />
                            Edit
                        </Button>
                        <Button variant="destructive" size="sm" onClick={() => onDelete(server)}>
                            <Trash2 className="mr-1 h-4 w-4" />
                            Delete
                        </Button>
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}

export default function ServersIndex({ servers }: Props) {
    const [editingServer, setEditingServer] = useState<Server | null>(null);
    const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
    const [showSecret, setShowSecret] = useState<Record<number, boolean>>({});

    const createForm = useForm({
        display_name: '',
        hostname: '',
        port: '',
        https: true as boolean,
        access_secret: '',
    });

    const editForm = useForm({
        display_name: '',
        hostname: '',
        port: '',
        https: true as boolean,
        access_secret: '',
    });

    const handleCreateServer = (e: React.FormEvent) => {
        e.preventDefault();
        createForm.post('/admin/servers', {
            onSuccess: () => {
                createForm.reset();
                setIsCreateDialogOpen(false);
            },
        });
    };

    const handleEditServer = (e: React.FormEvent) => {
        e.preventDefault();
        if (editingServer) {
            editForm.put(`/admin/servers/${editingServer.id}`, {
                onSuccess: () => {
                    editForm.reset();
                    setEditingServer(null);
                },
            });
        }
    };

    const handleDeleteServer = (server: Server) => {
        if (confirm(`Are you sure you want to delete server "${server.display_name}"?`)) {
            router.delete(`/admin/servers/${server.id}`, {
                onSuccess: () => {
                    toast.success('Server deleted successfully');
                },
                onError: () => {
                    toast.error('Failed to delete server');
                },
            });
        }
    };

    const toggleShowSecret = (serverId: number) => {
        setShowSecret((prev) => ({
            ...prev,
            [serverId]: !prev[serverId],
        }));
    };

    const openEditDialog = (server: Server) => {
        setEditingServer(server);
        editForm.setData({
            display_name: server.display_name,
            hostname: server.hostname,
            port: server.port.toString(),
            https: server.https,
            access_secret: '',
        });
    };

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Servers" />

            <div className="space-y-6">
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-3xl font-bold tracking-tight">Servers</h1>
                        <p className="text-muted-foreground">Manage your Docker Compose servers</p>
                    </div>
                    <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
                        <DialogTrigger asChild>
                            <Button>
                                <Plus className="mr-2 h-4 w-4" />
                                Add Server
                            </Button>
                        </DialogTrigger>
                        <DialogContent className="sm:max-w-[425px]">
                            <DialogHeader>
                                <DialogTitle>Add New Server</DialogTitle>
                            </DialogHeader>
                            <form onSubmit={handleCreateServer} className="space-y-4">
                                <div>
                                    <Label htmlFor="create_display_name">Display Name</Label>
                                    <Input
                                        id="create_display_name"
                                        value={createForm.data.display_name}
                                        onChange={(e) => createForm.setData('display_name', e.target.value)}
                                        required
                                    />
                                    {createForm.errors.display_name && <p className="text-sm text-destructive">{createForm.errors.display_name}</p>}
                                </div>
                                <div>
                                    <Label htmlFor="create_hostname">Hostname</Label>
                                    <Input
                                        id="create_hostname"
                                        value={createForm.data.hostname}
                                        onChange={(e) => createForm.setData('hostname', e.target.value)}
                                        required
                                    />
                                    {createForm.errors.hostname && <p className="text-sm text-destructive">{createForm.errors.hostname}</p>}
                                </div>
                                <div>
                                    <Label htmlFor="create_port">Port</Label>
                                    <Input
                                        id="create_port"
                                        type="number"
                                        value={createForm.data.port}
                                        onChange={(e) => createForm.setData('port', e.target.value)}
                                        required
                                    />
                                    {createForm.errors.port && <p className="text-sm text-destructive">{createForm.errors.port}</p>}
                                </div>
                                <div className="flex items-center space-x-2">
                                    <Checkbox
                                        id="create_https"
                                        checked={createForm.data.https}
                                        onCheckedChange={(checked) => createForm.setData('https', checked as boolean)}
                                    />
                                    <Label htmlFor="create_https">Use HTTPS</Label>
                                </div>
                                <div>
                                    <Label htmlFor="create_access_secret">Access Secret</Label>
                                    <Input
                                        id="create_access_secret"
                                        type="password"
                                        value={createForm.data.access_secret}
                                        onChange={(e) => createForm.setData('access_secret', e.target.value)}
                                        required
                                    />
                                    {createForm.errors.access_secret && <p className="text-sm text-destructive">{createForm.errors.access_secret}</p>}
                                </div>
                                <div className="flex justify-end gap-2">
                                    <Button type="button" variant="outline" onClick={() => setIsCreateDialogOpen(false)}>
                                        Cancel
                                    </Button>
                                    <Button type="submit" disabled={createForm.processing}>
                                        {createForm.processing ? 'Creating...' : 'Create Server'}
                                    </Button>
                                </div>
                            </form>
                        </DialogContent>
                    </Dialog>
                </div>

                <div className="grid gap-6 md:grid-cols-2">
                    {servers.map((server) => (
                        <ServerItem
                            key={server.id}
                            server={server}
                            showSecret={showSecret[server.id] || false}
                            onToggleSecret={() => toggleShowSecret(server.id)}
                            onEdit={openEditDialog}
                            onDelete={handleDeleteServer}
                        />
                    ))}
                </div>
            </div>

            <Dialog open={!!editingServer} onOpenChange={() => setEditingServer(null)}>
                <DialogContent className="sm:max-w-[425px]">
                    <DialogHeader>
                        <DialogTitle>Edit Server</DialogTitle>
                    </DialogHeader>
                    <form onSubmit={handleEditServer} className="space-y-4">
                        <div>
                            <Label htmlFor="edit_display_name">Display Name</Label>
                            <Input
                                id="edit_display_name"
                                value={editForm.data.display_name}
                                onChange={(e) => editForm.setData('display_name', e.target.value)}
                                required
                            />
                            {editForm.errors.display_name && <p className="text-sm text-destructive">{editForm.errors.display_name}</p>}
                        </div>
                        <div>
                            <Label htmlFor="edit_hostname">Hostname</Label>
                            <Input
                                id="edit_hostname"
                                value={editForm.data.hostname}
                                onChange={(e) => editForm.setData('hostname', e.target.value)}
                                required
                            />
                            {editForm.errors.hostname && <p className="text-sm text-destructive">{editForm.errors.hostname}</p>}
                        </div>
                        <div>
                            <Label htmlFor="edit_port">Port</Label>
                            <Input
                                id="edit_port"
                                type="number"
                                value={editForm.data.port}
                                onChange={(e) => editForm.setData('port', e.target.value)}
                                required
                            />
                            {editForm.errors.port && <p className="text-sm text-destructive">{editForm.errors.port}</p>}
                        </div>
                        <div className="flex items-center space-x-2">
                            <Checkbox
                                id="edit_https"
                                checked={editForm.data.https}
                                onCheckedChange={(checked) => editForm.setData('https', checked as boolean)}
                            />
                            <Label htmlFor="edit_https">Use HTTPS</Label>
                        </div>
                        <div>
                            <Label htmlFor="edit_access_secret">Access Secret (leave blank to keep current)</Label>
                            <Input
                                id="edit_access_secret"
                                type="password"
                                value={editForm.data.access_secret}
                                onChange={(e) => editForm.setData('access_secret', e.target.value)}
                                placeholder="Enter new secret or leave blank"
                            />
                            {editForm.errors.access_secret && <p className="text-sm text-destructive">{editForm.errors.access_secret}</p>}
                        </div>
                        <div className="flex justify-end gap-2">
                            <Button type="button" variant="outline" onClick={() => setEditingServer(null)}>
                                Cancel
                            </Button>
                            <Button type="submit" disabled={editForm.processing}>
                                {editForm.processing ? 'Updating...' : 'Update Server'}
                            </Button>
                        </div>
                    </form>
                </DialogContent>
            </Dialog>
        </AppLayout>
    );
}
