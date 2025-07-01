import { useState } from 'react';
import { Head, useForm, router } from '@inertiajs/react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Eye, EyeOff, Activity, AlertCircle, CheckCircle, Clock, Shield, Container } from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';
import AppLayout from '@/layouts/app-layout';
import type { Server, HealthStatus } from '@/types/entities';

interface Props {
    servers: Server[];
}

export default function ServersIndex({ servers }: Props) {
    const [editingServer, setEditingServer] = useState<Server | null>(null);
    const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
    const [showSecret, setShowSecret] = useState<Record<number, boolean>>({});
    const [serverSecrets, setServerSecrets] = useState<Record<number, string>>({});
    const [healthStatus, setHealthStatus] = useState<Record<number, HealthStatus>>({});
    const [checkingHealth, setCheckingHealth] = useState<Record<number, boolean>>({});

    const createForm = useForm({
        display_name: '',
        hostname: '',
        port: '',
        https: true,
        access_secret: '',
    });

    const editForm = useForm({
        display_name: '',
        hostname: '',
        port: '',
        https: true,
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
        if (!editingServer) return;
        
        editForm.put(`/admin/servers/${editingServer.id}`, {
            onSuccess: () => {
                editForm.reset();
                setEditingServer(null);
            },
        });
    };

    const handleDeleteServer = (server: Server) => {
        if (confirm(`Are you sure you want to delete server "${server.display_name}"?`)) {
            router.delete(`/admin/servers/${server.id}`);
        }
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

    const toggleSecretVisibility = async (serverId: number) => {
        if (showSecret[serverId]) {
            setShowSecret(prev => ({ ...prev, [serverId]: false }));
            return;
        }

        try {
            const response = await fetch(`/admin/servers/${serverId}`);
            const serverData = await response.json();
            setServerSecrets(prev => ({ ...prev, [serverId]: serverData.access_secret }));
            setShowSecret(prev => ({ ...prev, [serverId]: true }));
        } catch (error) {
            console.error('Failed to fetch server details:', error);
        }
    };

    const checkServerHealth = async (serverId: number) => {
        setCheckingHealth(prev => ({ ...prev, [serverId]: true }));
        
        try {
            const response = await fetch(`/admin/servers/${serverId}/health`);
            const healthData = await response.json();
            setHealthStatus(prev => ({ ...prev, [serverId]: healthData }));
        } catch (error) {
            console.error('Failed to check server health:', error);
            setHealthStatus(prev => ({ 
                ...prev, 
                [serverId]: {
                    status: 'error',
                    health_status: 'unreachable',
                    message: 'Failed to connect',
                    checked_at: new Date().toISOString(),
                }
            }));
        } finally {
            setCheckingHealth(prev => ({ ...prev, [serverId]: false }));
        }
    };

    const getHealthIcon = (health: HealthStatus | undefined) => {
        if (!health) return <Activity className="text-gray-400" size={16} />;
        
        switch (health.health_status) {
            case 'healthy':
                return <CheckCircle className="text-green-500" size={16} />;
            case 'unhealthy':
                return <AlertCircle className="text-yellow-500" size={16} />;
            case 'unreachable':
                return <AlertCircle className="text-red-500" size={16} />;
            default:
                return <Activity className="text-gray-400" size={16} />;
        }
    };

    const getHealthBadgeVariant = (health: HealthStatus | undefined) => {
        if (!health) return 'outline' as const;
        
        switch (health.health_status) {
            case 'healthy':
                return 'default' as const;
            case 'unhealthy':
                return 'secondary' as const;
            case 'unreachable':
                return 'destructive' as const;
            default:
                return 'outline' as const;
        }
    };

    return (
        <AppLayout>
            <Head title="Server Management" />
            
            <div className="space-y-6">
                <div className="flex justify-between items-center">
                    <h1 className="text-2xl font-bold">Server Management</h1>
                    <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
                        <DialogTrigger asChild>
                            <Button>Add Server</Button>
                        </DialogTrigger>
                        <DialogContent>
                            <DialogHeader>
                                <DialogTitle>Add New Server</DialogTitle>
                            </DialogHeader>
                            <form onSubmit={handleCreateServer} className="space-y-4">
                                <div>
                                    <Label htmlFor="display_name">Display Name</Label>
                                    <Input
                                        id="display_name"
                                        value={createForm.data.display_name}
                                        onChange={(e) => createForm.setData('display_name', e.target.value)}
                                        required
                                    />
                                    {createForm.errors.display_name && (
                                        <p className="text-red-500 text-sm mt-1">{createForm.errors.display_name}</p>
                                    )}
                                </div>
                                <div>
                                    <Label htmlFor="hostname">Hostname/IP</Label>
                                    <Input
                                        id="hostname"
                                        value={createForm.data.hostname}
                                        onChange={(e) => createForm.setData('hostname', e.target.value)}
                                        placeholder="example.com or 192.168.1.100"
                                        required
                                    />
                                    {createForm.errors.hostname && (
                                        <p className="text-red-500 text-sm mt-1">{createForm.errors.hostname}</p>
                                    )}
                                </div>
                                <div>
                                    <Label htmlFor="port">Port</Label>
                                    <Input
                                        id="port"
                                        type="number"
                                        min="1"
                                        max="65535"
                                        value={createForm.data.port}
                                        onChange={(e) => createForm.setData('port', e.target.value)}
                                        required
                                    />
                                    {createForm.errors.port && (
                                        <p className="text-red-500 text-sm mt-1">{createForm.errors.port}</p>
                                    )}
                                </div>
                                <div className="flex items-center space-x-2">
                                    <Checkbox
                                        id="https"
                                        checked={createForm.data.https}
                                        onCheckedChange={(checked) => createForm.setData('https', checked as boolean)}
                                    />
                                    <Label htmlFor="https">Use HTTPS</Label>
                                </div>
                                <div>
                                    <Label htmlFor="access_secret">Access Secret</Label>
                                    <Input
                                        id="access_secret"
                                        type="password"
                                        value={createForm.data.access_secret}
                                        onChange={(e) => createForm.setData('access_secret', e.target.value)}
                                        required
                                    />
                                    {createForm.errors.access_secret && (
                                        <p className="text-red-500 text-sm mt-1">{createForm.errors.access_secret}</p>
                                    )}
                                </div>
                                <div className="flex justify-end space-x-2">
                                    <Button
                                        type="button"
                                        variant="outline"
                                        onClick={() => setIsCreateDialogOpen(false)}
                                    >
                                        Cancel
                                    </Button>
                                    <Button type="submit" disabled={createForm.processing}>
                                        Add Server
                                    </Button>
                                </div>
                            </form>
                        </DialogContent>
                    </Dialog>
                </div>

                <div className="grid gap-4">
                    {servers.map((server) => (
                        <Card key={server.id}>
                            <CardHeader>
                                <div className="flex justify-between items-start">
                                    <div>
                                        <CardTitle className="flex items-center gap-2">
                                            {server.display_name}
                                            <Badge variant={server.https ? "default" : "secondary"}>
                                                {server.https ? "HTTPS" : "HTTP"}
                                            </Badge>
                                            {healthStatus[server.id] && (
                                                <Badge variant={getHealthBadgeVariant(healthStatus[server.id])}>
                                                    {getHealthIcon(healthStatus[server.id])}
                                                    <span className="ml-1 capitalize">
                                                        {healthStatus[server.id].health_status}
                                                    </span>
                                                </Badge>
                                            )}
                                        </CardTitle>
                                        <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                                            {server.https ? "https" : "http"}://{server.hostname}:{server.port}
                                        </p>
                                    </div>
                                    <div className="space-x-2">
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            onClick={() => checkServerHealth(server.id)}
                                            disabled={checkingHealth[server.id]}
                                            title="Check Health"
                                        >
                                            {checkingHealth[server.id] ? (
                                                <Clock className="animate-spin" size={16} />
                                            ) : (
                                                <Activity size={16} />
                                            )}
                                        </Button>
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={() => window.location.href = `/servers/${server.id}/stacks`}
                                            title="View Stacks"
                                        >
                                            <Container size={16} />
                                        </Button>
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={() => window.location.href = `/admin/servers/${server.id}/permissions`}
                                            title="Manage Permissions"
                                        >
                                            <Shield size={16} />
                                        </Button>
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={() => openEditDialog(server)}
                                        >
                                            Edit
                                        </Button>
                                        <Button
                                            variant="destructive"
                                            size="sm"
                                            onClick={() => handleDeleteServer(server)}
                                        >
                                            Delete
                                        </Button>
                                    </div>
                                </div>
                            </CardHeader>
                            <CardContent>
                                <div className="space-y-3">
                                    {/* Health Status Details */}
                                    {healthStatus[server.id] && (
                                        <div className="border rounded-lg p-3 bg-gray-50 dark:bg-gray-800 dark:border-gray-700">
                                            <div className="flex items-center justify-between mb-2">
                                                <span className="text-sm font-medium text-gray-900 dark:text-gray-100">Health Status</span>
                                                <span className="text-xs text-gray-500 dark:text-gray-400">
                                                    {new Date(healthStatus[server.id].checked_at).toLocaleString()}
                                                </span>
                                            </div>
                                            <div className="grid grid-cols-2 gap-2 text-sm">
                                                {healthStatus[server.id].service && (
                                                    <div>
                                                        <span className="text-gray-600 dark:text-gray-400">Service:</span>
                                                        <span className="ml-1 font-mono text-gray-900 dark:text-gray-100">{healthStatus[server.id].service}</span>
                                                    </div>
                                                )}
                                                {healthStatus[server.id].docker_compose && (
                                                    <div>
                                                        <span className="text-gray-600 dark:text-gray-400">Docker Compose:</span>
                                                        <span className="ml-1 font-mono text-gray-900 dark:text-gray-100">
                                                            {healthStatus[server.id].docker_compose?.version}
                                                        </span>
                                                    </div>
                                                )}
                                                {healthStatus[server.id].response_time && (
                                                    <div>
                                                        <span className="text-gray-600 dark:text-gray-400">Response Time:</span>
                                                        <span className="ml-1 text-gray-900 dark:text-gray-100">{Math.round(healthStatus[server.id].response_time! * 1000)}ms</span>
                                                    </div>
                                                )}
                                            </div>
                                            {healthStatus[server.id].message && (
                                                <div className="text-sm text-red-600 dark:text-red-400 mt-2">
                                                    {healthStatus[server.id].message}
                                                </div>
                                            )}
                                        </div>
                                    )}
                                    
                                    {/* Access Secret */}
                                    <div className="flex items-center space-x-2">
                                        <span className="text-sm font-medium text-gray-900 dark:text-gray-100">Access Secret:</span>
                                        <div className="flex items-center space-x-2">
                                            {showSecret[server.id] ? (
                                                <code className="text-sm bg-gray-100 dark:bg-gray-800 px-2 py-1 rounded text-gray-900 dark:text-gray-100">
                                                    {serverSecrets[server.id] || '***'}
                                                </code>
                                            ) : (
                                                <span className="text-sm text-gray-500 dark:text-gray-400">********</span>
                                            )}
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                onClick={() => toggleSecretVisibility(server.id)}
                                            >
                                                {showSecret[server.id] ? <EyeOff size={16} /> : <Eye size={16} />}
                                            </Button>
                                        </div>
                                    </div>
                                    
                                    <div className="text-xs text-gray-500 dark:text-gray-400">
                                        Created: {new Date(server.created_at).toLocaleString()}
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    ))}
                </div>

                {/* Edit Server Dialog */}
                <Dialog open={!!editingServer} onOpenChange={() => setEditingServer(null)}>
                    <DialogContent>
                        <DialogHeader>
                            <DialogTitle>Edit Server</DialogTitle>
                        </DialogHeader>
                        <form onSubmit={handleEditServer} className="space-y-4">
                            <div>
                                <Label htmlFor="edit-display_name">Display Name</Label>
                                <Input
                                    id="edit-display_name"
                                    value={editForm.data.display_name}
                                    onChange={(e) => editForm.setData('display_name', e.target.value)}
                                    required
                                />
                                {editForm.errors.display_name && (
                                    <p className="text-red-500 text-sm mt-1">{editForm.errors.display_name}</p>
                                )}
                            </div>
                            <div>
                                <Label htmlFor="edit-hostname">Hostname/IP</Label>
                                <Input
                                    id="edit-hostname"
                                    value={editForm.data.hostname}
                                    onChange={(e) => editForm.setData('hostname', e.target.value)}
                                    required
                                />
                                {editForm.errors.hostname && (
                                    <p className="text-red-500 text-sm mt-1">{editForm.errors.hostname}</p>
                                )}
                            </div>
                            <div>
                                <Label htmlFor="edit-port">Port</Label>
                                <Input
                                    id="edit-port"
                                    type="number"
                                    min="1"
                                    max="65535"
                                    value={editForm.data.port}
                                    onChange={(e) => editForm.setData('port', e.target.value)}
                                    required
                                />
                                {editForm.errors.port && (
                                    <p className="text-red-500 text-sm mt-1">{editForm.errors.port}</p>
                                )}
                            </div>
                            <div className="flex items-center space-x-2">
                                <Checkbox
                                    id="edit-https"
                                    checked={editForm.data.https}
                                    onCheckedChange={(checked) => editForm.setData('https', checked as boolean)}
                                />
                                <Label htmlFor="edit-https">Use HTTPS</Label>
                            </div>
                            <div>
                                <Label htmlFor="edit-access_secret">Access Secret</Label>
                                <Input
                                    id="edit-access_secret"
                                    type="password"
                                    value={editForm.data.access_secret}
                                    onChange={(e) => editForm.setData('access_secret', e.target.value)}
                                    placeholder="Leave empty to keep current secret"
                                />
                                {editForm.errors.access_secret && (
                                    <p className="text-red-500 text-sm mt-1">{editForm.errors.access_secret}</p>
                                )}
                            </div>
                            <div className="flex justify-end space-x-2">
                                <Button
                                    type="button"
                                    variant="outline"
                                    onClick={() => setEditingServer(null)}
                                >
                                    Cancel
                                </Button>
                                <Button type="submit" disabled={editForm.processing}>
                                    Update Server
                                </Button>
                            </div>
                        </form>
                    </DialogContent>
                </Dialog>
            </div>
        </AppLayout>
    );
}