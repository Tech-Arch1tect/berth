import { useState } from 'react';
import { Head, useForm, router, Link } from '@inertiajs/react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ArrowLeft, Shield, Eye, Edit, Trash, Server } from 'lucide-react';
import AppLayout from '@/layouts/app-layout';

interface Server {
    id: number;
    display_name: string;
    hostname: string;
    port: number;
    https: boolean;
}

interface Role {
    id: number;
    name: string;
}

interface ServerRole {
    id: number;
    name: string;
    permissions: {
        access: boolean;
        filemanager_access: boolean;
        filemanager_write: boolean;
        'start-stop': boolean;
        exec: boolean;
    };
}

interface Props {
    server: Server;
    serverRoles: ServerRole[];
    allRoles: Role[];
}

export default function ServerPermissions({ server, serverRoles, allRoles }: Props) {
    const [isAssignDialogOpen, setIsAssignDialogOpen] = useState(false);
    const [editingRole, setEditingRole] = useState<ServerRole | null>(null);

    const assignForm = useForm({
        role_id: '',
        permissions: {
            access: false,
            filemanager_access: false,
            filemanager_write: false,
            'start-stop': false,
            exec: false,
        },
    });

    const editForm = useForm({
        permissions: {
            access: false,
            filemanager_access: false,
            filemanager_write: false,
            'start-stop': false,
            exec: false,
        },
    });

    const handleAssignRole = (e: React.FormEvent) => {
        e.preventDefault();
        assignForm.post(`/admin/servers/${server.id}/permissions/assign`, {
            onSuccess: () => {
                assignForm.reset();
                setIsAssignDialogOpen(false);
            },
        });
    };

    const handleEditPermissions = (e: React.FormEvent) => {
        e.preventDefault();
        if (!editingRole) return;

        editForm.put(`/admin/servers/${server.id}/permissions/roles/${editingRole.id}`, {
            onSuccess: () => {
                editForm.reset();
                setEditingRole(null);
            },
        });
    };

    const handleRemoveRole = (role: ServerRole) => {
        if (confirm(`Remove role "${role.name}" from this server?`)) {
            router.delete(`/admin/servers/${server.id}/permissions/roles/${role.id}`);
        }
    };

    const openEditDialog = (role: ServerRole) => {
        setEditingRole(role);
        editForm.setData({
            permissions: {
                access: role.permissions.access,
                filemanager_access: role.permissions.filemanager_access,
                filemanager_write: role.permissions.filemanager_write,
                'start-stop': role.permissions['start-stop'],
                exec: role.permissions.exec,
            },
        });
    };

    const handlePermissionChange = (permission: string, checked: boolean, form: any) => {
        form.setData('permissions', {
            ...form.data.permissions,
            [permission]: checked,
        });
    };

    const getPermissionBadges = (permissions: ServerRole['permissions']) => {
        const badges = [];
        if (permissions.access) badges.push(<Badge key="access" variant="default">Access</Badge>);
        if (permissions.filemanager_access) badges.push(<Badge key="filemanager_access" variant="default">File Manager</Badge>);
        if (permissions.filemanager_write) badges.push(<Badge key="filemanager_write" variant="default">File Edit</Badge>);
        if (permissions['start-stop']) badges.push(<Badge key="start-stop" variant="default">Start/Stop</Badge>);
        if (permissions.exec) badges.push(<Badge key="exec" variant="default">Exec</Badge>);
        return badges.length > 0 ? badges : [<Badge key="none" variant="outline">No Permissions</Badge>];
    };

    const availableRoles = allRoles.filter(role => 
        !serverRoles.some(serverRole => serverRole.id === role.id)
    );

    return (
        <AppLayout>
            <Head title={`Server Permissions - ${server.display_name}`} />
            
            <div className="space-y-6">
                <div className="flex items-center gap-4">
                    <Link href="/admin/servers">
                        <Button variant="ghost" size="sm">
                            <ArrowLeft size={16} />
                        </Button>
                    </Link>
                    <div>
                        <h1 className="text-2xl font-bold flex items-center gap-2">
                            <Server size={24} />
                            {server.display_name} - Permissions
                        </h1>
                        <p className="text-sm text-gray-600 dark:text-gray-400">
                            {server.https ? "https" : "http"}://{server.hostname}:{server.port}
                        </p>
                    </div>
                </div>

                <div className="flex justify-between items-center">
                    <h2 className="text-lg font-semibold">Role Permissions</h2>
                    <Dialog open={isAssignDialogOpen} onOpenChange={setIsAssignDialogOpen}>
                        <DialogTrigger asChild>
                            <Button disabled={availableRoles.length === 0}>
                                <Shield size={16} className="mr-2" />
                                Assign Role
                            </Button>
                        </DialogTrigger>
                        <DialogContent>
                            <DialogHeader>
                                <DialogTitle>Assign Role to Server</DialogTitle>
                            </DialogHeader>
                            <form onSubmit={handleAssignRole} className="space-y-4">
                                <div>
                                    <Label htmlFor="role">Select Role</Label>
                                    <Select 
                                        value={assignForm.data.role_id} 
                                        onValueChange={(value) => assignForm.setData('role_id', value)}
                                    >
                                        <SelectTrigger>
                                            <SelectValue placeholder="Choose a role" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {availableRoles.map((role) => (
                                                <SelectItem key={role.id} value={role.id.toString()}>
                                                    {role.name}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                    {assignForm.errors.role_id && (
                                        <p className="text-red-500 text-sm mt-1">{assignForm.errors.role_id}</p>
                                    )}
                                </div>
                                
                                <div>
                                    <Label>Permissions</Label>
                                    <div className="space-y-2 mt-2">
                                        <div className="flex items-center space-x-2">
                                            <Checkbox
                                                id="assign-access"
                                                checked={assignForm.data.permissions.access}
                                                onCheckedChange={(checked) =>
                                                    handlePermissionChange('access', checked as boolean, assignForm)
                                                }
                                            />
                                            <Label htmlFor="assign-access" className="text-sm">
                                                Access - View stacks, logs and containers
                                            </Label>
                                        </div>
                                        <div className="flex items-center space-x-2">
                                            <Checkbox
                                                id="assign-filemanager-access"
                                                checked={assignForm.data.permissions.filemanager_access}
                                                onCheckedChange={(checked) =>
                                                    handlePermissionChange('filemanager_access', checked as boolean, assignForm)
                                                }
                                            />
                                            <Label htmlFor="assign-filemanager-access" className="text-sm">
                                                File Manager Access - Browse stack files
                                            </Label>
                                        </div>
                                        <div className="flex items-center space-x-2">
                                            <Checkbox
                                                id="assign-filemanager-write"
                                                checked={assignForm.data.permissions.filemanager_write}
                                                onCheckedChange={(checked) =>
                                                    handlePermissionChange('filemanager_write', checked as boolean, assignForm)
                                                }
                                            />
                                            <Label htmlFor="assign-filemanager-write" className="text-sm">
                                                File Manager Write - Edit and modify files
                                            </Label>
                                        </div>
                                        <div className="flex items-center space-x-2">
                                            <Checkbox
                                                id="assign-start-stop"
                                                checked={assignForm.data.permissions['start-stop']}
                                                onCheckedChange={(checked) =>
                                                    handlePermissionChange('start-stop', checked as boolean, assignForm)
                                                }
                                            />
                                            <Label htmlFor="assign-start-stop" className="text-sm">
                                                Start/Stop - Control container lifecycle
                                            </Label>
                                        </div>
                                        <div className="flex items-center space-x-2">
                                            <Checkbox
                                                id="assign-exec"
                                                checked={assignForm.data.permissions.exec}
                                                onCheckedChange={(checked) =>
                                                    handlePermissionChange('exec', checked as boolean, assignForm)
                                                }
                                            />
                                            <Label htmlFor="assign-exec" className="text-sm">
                                                Exec - Execute commands in containers
                                            </Label>
                                        </div>
                                    </div>
                                </div>
                                
                                <div className="flex justify-end space-x-2">
                                    <Button
                                        type="button"
                                        variant="outline"
                                        onClick={() => setIsAssignDialogOpen(false)}
                                    >
                                        Cancel
                                    </Button>
                                    <Button type="submit" disabled={assignForm.processing}>
                                        Assign Role
                                    </Button>
                                </div>
                            </form>
                        </DialogContent>
                    </Dialog>
                </div>

                <div className="grid gap-4">
                    {serverRoles.length === 0 ? (
                        <Card>
                            <CardContent className="text-center py-8">
                                <Shield className="mx-auto h-12 w-12 text-gray-400 mb-4" />
                                <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">
                                    No roles assigned
                                </h3>
                                <p className="text-gray-600 dark:text-gray-400 mb-4">
                                    Assign roles to this server to grant permissions to users.
                                </p>
                                {availableRoles.length > 0 && (
                                    <Button onClick={() => setIsAssignDialogOpen(true)}>
                                        Assign First Role
                                    </Button>
                                )}
                            </CardContent>
                        </Card>
                    ) : (
                        serverRoles.map((role) => (
                            <Card key={role.id}>
                                <CardHeader>
                                    <div className="flex justify-between items-start">
                                        <div>
                                            <CardTitle className="capitalize">{role.name}</CardTitle>
                                            <div className="flex flex-wrap gap-2 mt-2">
                                                {getPermissionBadges(role.permissions)}
                                            </div>
                                        </div>
                                        <div className="space-x-2">
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                onClick={() => openEditDialog(role)}
                                            >
                                                <Edit size={16} />
                                            </Button>
                                            <Button
                                                variant="destructive"
                                                size="sm"
                                                onClick={() => handleRemoveRole(role)}
                                            >
                                                <Trash size={16} />
                                            </Button>
                                        </div>
                                    </div>
                                </CardHeader>
                                <CardContent>
                                    <div className="text-sm text-gray-600 dark:text-gray-400">
                                        <p><strong>Access:</strong> {role.permissions.access ? 'Allowed' : 'Denied'}</p>
                                        <p><strong>File Manager Access:</strong> {role.permissions.filemanager_access ? 'Allowed' : 'Denied'}</p>
                                        <p><strong>File Manager Write:</strong> {role.permissions.filemanager_write ? 'Allowed' : 'Denied'}</p>
                                        <p><strong>Start/Stop:</strong> {role.permissions['start-stop'] ? 'Allowed' : 'Denied'}</p>
                                        <p><strong>Exec:</strong> {role.permissions.exec ? 'Allowed' : 'Denied'}</p>
                                    </div>
                                </CardContent>
                            </Card>
                        ))
                    )}
                </div>

                {/* Edit Role Permissions Dialog */}
                <Dialog open={!!editingRole} onOpenChange={() => setEditingRole(null)}>
                    <DialogContent>
                        <DialogHeader>
                            <DialogTitle>Edit Permissions - {editingRole?.name}</DialogTitle>
                        </DialogHeader>
                        <form onSubmit={handleEditPermissions} className="space-y-4">
                            <div>
                                <Label>Permissions</Label>
                                <div className="space-y-2 mt-2">
                                    <div className="flex items-center space-x-2">
                                        <Checkbox
                                            id="edit-access"
                                            checked={editForm.data.permissions.access}
                                            onCheckedChange={(checked) =>
                                                handlePermissionChange('access', checked as boolean, editForm)
                                            }
                                        />
                                        <Label htmlFor="edit-access" className="text-sm">
                                            Access - View stacks, logs and containers
                                        </Label>
                                    </div>
                                    <div className="flex items-center space-x-2">
                                        <Checkbox
                                            id="edit-filemanager-access"
                                            checked={editForm.data.permissions.filemanager_access}
                                            onCheckedChange={(checked) =>
                                                handlePermissionChange('filemanager_access', checked as boolean, editForm)
                                            }
                                        />
                                        <Label htmlFor="edit-filemanager-access" className="text-sm">
                                            File Manager Access - Browse stack files
                                        </Label>
                                    </div>
                                    <div className="flex items-center space-x-2">
                                        <Checkbox
                                            id="edit-filemanager-write"
                                            checked={editForm.data.permissions.filemanager_write}
                                            onCheckedChange={(checked) =>
                                                handlePermissionChange('filemanager_write', checked as boolean, editForm)
                                            }
                                        />
                                        <Label htmlFor="edit-filemanager-write" className="text-sm">
                                            File Manager Write - Edit and modify files
                                        </Label>
                                    </div>
                                    <div className="flex items-center space-x-2">
                                        <Checkbox
                                            id="edit-start-stop"
                                            checked={editForm.data.permissions['start-stop']}
                                            onCheckedChange={(checked) =>
                                                handlePermissionChange('start-stop', checked as boolean, editForm)
                                            }
                                        />
                                        <Label htmlFor="edit-start-stop" className="text-sm">
                                            Start/Stop - Control container lifecycle
                                        </Label>
                                    </div>
                                    <div className="flex items-center space-x-2">
                                        <Checkbox
                                            id="edit-exec"
                                            checked={editForm.data.permissions.exec}
                                            onCheckedChange={(checked) =>
                                                handlePermissionChange('exec', checked as boolean, editForm)
                                            }
                                        />
                                        <Label htmlFor="edit-exec" className="text-sm">
                                            Exec - Execute commands in containers
                                        </Label>
                                    </div>
                                </div>
                            </div>
                            
                            <div className="flex justify-end space-x-2">
                                <Button
                                    type="button"
                                    variant="outline"
                                    onClick={() => setEditingRole(null)}
                                >
                                    Cancel
                                </Button>
                                <Button type="submit" disabled={editForm.processing}>
                                    Update Permissions
                                </Button>
                            </div>
                        </form>
                    </DialogContent>
                </Dialog>
            </div>
        </AppLayout>
    );
}