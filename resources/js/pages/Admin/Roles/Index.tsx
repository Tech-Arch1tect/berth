import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import AppLayout from '@/layouts/app-layout';
import type { Server as BaseServer } from '@/types/entities';
import { Head, Link, router, useForm } from '@inertiajs/react';
import { Shield } from 'lucide-react';
import { useState } from 'react';

interface Server extends BaseServer {
    pivot?: {
        can_access: boolean;
        can_filemanager_access: boolean;
        can_filemanager_write: boolean;
        can_start_stop: boolean;
        can_exec: boolean;
    };
}

interface Role {
    id: number;
    name: string;
    servers?: Server[];
}

interface Props {
    roles: Role[];
}

export default function RolesIndex({ roles }: Props) {
    const [editingRole, setEditingRole] = useState<Role | null>(null);
    const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);

    const createForm = useForm({
        name: '',
    });

    const editForm = useForm({
        name: '',
    });

    const handleCreateRole = (e: React.FormEvent) => {
        e.preventDefault();
        createForm.post('/admin/roles', {
            onSuccess: () => {
                createForm.reset();
                setIsCreateDialogOpen(false);
            },
        });
    };

    const handleEditRole = (e: React.FormEvent) => {
        e.preventDefault();
        if (!editingRole) return;

        editForm.put(`/admin/roles/${editingRole.id}`, {
            onSuccess: () => {
                editForm.reset();
                setEditingRole(null);
            },
        });
    };

    const handleDeleteRole = (role: Role) => {
        if (confirm(`Are you sure you want to delete the role "${role.name}"?`)) {
            router.delete(`/admin/roles/${role.id}`);
        }
    };

    const openEditDialog = (role: Role) => {
        setEditingRole(role);
        editForm.setData({
            name: role.name,
        });
    };

    return (
        <AppLayout>
            <Head title="Role Management" />

            <div className="space-y-6">
                <div className="flex items-center justify-between">
                    <h1 className="text-2xl font-bold">Role Management</h1>
                    <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
                        <DialogTrigger asChild>
                            <Button>Create Role</Button>
                        </DialogTrigger>
                        <DialogContent>
                            <DialogHeader>
                                <DialogTitle>Create New Role</DialogTitle>
                            </DialogHeader>
                            <form onSubmit={handleCreateRole} className="space-y-4">
                                <div>
                                    <Label htmlFor="name">Role Name</Label>
                                    <Input
                                        id="name"
                                        value={createForm.data.name}
                                        onChange={(e) => createForm.setData('name', e.target.value)}
                                        required
                                    />
                                    {createForm.errors.name && <p className="mt-1 text-sm text-red-500">{createForm.errors.name}</p>}
                                </div>
                                <div className="flex justify-end space-x-2">
                                    <Button type="button" variant="outline" onClick={() => setIsCreateDialogOpen(false)}>
                                        Cancel
                                    </Button>
                                    <Button type="submit" disabled={createForm.processing}>
                                        Create Role
                                    </Button>
                                </div>
                            </form>
                        </DialogContent>
                    </Dialog>
                </div>

                <div className="grid gap-4">
                    {roles.map((role) => (
                        <Card key={role.id}>
                            <CardHeader>
                                <div className="flex items-center justify-between">
                                    <CardTitle className="capitalize">{role.name}</CardTitle>
                                    <div className="space-x-2">
                                        <Button variant="outline" size="sm" asChild>
                                            <Link href={`/admin/roles/${role.id}/permissions`}>
                                                <Shield className="mr-1 h-4 w-4" />
                                                Permissions
                                            </Link>
                                        </Button>
                                        <Button variant="outline" size="sm" onClick={() => openEditDialog(role)}>
                                            Edit
                                        </Button>
                                        {role.name !== 'admin' && (
                                            <Button variant="destructive" size="sm" onClick={() => handleDeleteRole(role)}>
                                                Delete
                                            </Button>
                                        )}
                                    </div>
                                </div>
                            </CardHeader>
                            <CardContent>
                                <div className="space-y-2">
                                    <p className="text-sm text-gray-600 dark:text-gray-400">Role for organizing users into groups</p>

                                    {role.servers && role.servers.length > 0 ? (
                                        <div>
                                            <p className="mb-2 text-sm font-medium text-gray-900 dark:text-gray-100">
                                                Server Access ({role.servers.length}):
                                            </p>
                                            <div className="space-y-1">
                                                {role.servers.slice(0, 3).map((server) => (
                                                    <div key={server.id} className="text-xs text-gray-600 dark:text-gray-400">
                                                        <span className="font-medium">{server.display_name}</span>
                                                        <span className="ml-2">
                                                            {[
                                                                server.pivot?.can_access && 'Access',
                                                                server.pivot?.can_filemanager_access && 'Files',
                                                                server.pivot?.can_filemanager_write && 'Edit',
                                                                server.pivot?.can_start_stop && 'Up/Down',
                                                                server.pivot?.can_exec && 'Exec',
                                                            ]
                                                                .filter(Boolean)
                                                                .join(', ') || 'No permissions'}
                                                        </span>
                                                    </div>
                                                ))}
                                                {role.servers.length > 3 && (
                                                    <p className="text-xs text-gray-500 dark:text-gray-400">
                                                        and {role.servers.length - 3} more servers...
                                                    </p>
                                                )}
                                            </div>
                                        </div>
                                    ) : (
                                        <p className="text-xs text-gray-500 dark:text-gray-400">
                                            No server access configured - Click "Permissions" to grant access
                                        </p>
                                    )}
                                </div>
                            </CardContent>
                        </Card>
                    ))}
                </div>

                {/* Edit Role Dialog */}
                <Dialog open={!!editingRole} onOpenChange={() => setEditingRole(null)}>
                    <DialogContent>
                        <DialogHeader>
                            <DialogTitle>Edit Role</DialogTitle>
                        </DialogHeader>
                        <form onSubmit={handleEditRole} className="space-y-4">
                            <div>
                                <Label htmlFor="edit-name">Role Name</Label>
                                <Input
                                    id="edit-name"
                                    value={editForm.data.name}
                                    onChange={(e) => editForm.setData('name', e.target.value)}
                                    required
                                />
                                {editForm.errors.name && <p className="mt-1 text-sm text-red-500">{editForm.errors.name}</p>}
                            </div>
                            <div className="flex justify-end space-x-2">
                                <Button type="button" variant="outline" onClick={() => setEditingRole(null)}>
                                    Cancel
                                </Button>
                                <Button type="submit" disabled={editForm.processing}>
                                    Update Role
                                </Button>
                            </div>
                        </form>
                    </DialogContent>
                </Dialog>
            </div>
        </AppLayout>
    );
}
