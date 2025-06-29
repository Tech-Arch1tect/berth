import { useState } from 'react';
import { Head, useForm, router } from '@inertiajs/react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Eye, EyeOff } from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';
import AppLayout from '@/layouts/app-layout';

interface Server {
    id: number;
    display_name: string;
    hostname: string;
    port: number;
    https: boolean;
    created_at: string;
    updated_at: string;
}

interface Props {
    servers: Server[];
}

export default function ServersIndex({ servers }: Props) {
    const [editingServer, setEditingServer] = useState<Server | null>(null);
    const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
    const [showSecret, setShowSecret] = useState<Record<number, boolean>>({});
    const [serverSecrets, setServerSecrets] = useState<Record<number, string>>({});

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
                                        </CardTitle>
                                        <p className="text-sm text-gray-600 mt-1">
                                            {server.https ? "https" : "http"}://{server.hostname}:{server.port}
                                        </p>
                                    </div>
                                    <div className="space-x-2">
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
                                <div className="space-y-2">
                                    <div className="flex items-center space-x-2">
                                        <span className="text-sm font-medium">Access Secret:</span>
                                        <div className="flex items-center space-x-2">
                                            {showSecret[server.id] ? (
                                                <code className="text-sm bg-gray-100 px-2 py-1 rounded">
                                                    {serverSecrets[server.id] || '***'}
                                                </code>
                                            ) : (
                                                <span className="text-sm text-gray-500">********</span>
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
                                    <div className="text-xs text-gray-500">
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