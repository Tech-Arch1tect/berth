import { useState } from 'react';
import { Head, useForm, router } from '@inertiajs/react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import AppLayout from '@/layouts/app-layout';

interface User {
    id: number;
    name: string;
    email: string;
    roles: Role[];
}

interface Role {
    id: number;
    name: string;
}

interface Props {
    users: User[];
    roles: Role[];
}

export default function UsersIndex({ users, roles }: Props) {
    const [editingUser, setEditingUser] = useState<User | null>(null);

    const editForm = useForm({
        roles: [] as string[],
    });

    const handleEditUser = (e: React.FormEvent) => {
        e.preventDefault();
        if (!editingUser) return;
        
        editForm.put(`/admin/users/${editingUser.id}/roles`, {
            onSuccess: () => {
                editForm.reset();
                setEditingUser(null);
            },
        });
    };

    const handleDeleteUser = (user: User) => {
        if (confirm(`Are you sure you want to delete user "${user.name}"?`)) {
            router.delete(`/admin/users/${user.id}`);
        }
    };

    const openEditDialog = (user: User) => {
        setEditingUser(user);
        editForm.setData({
            roles: user.roles.map(r => r.name),
        });
    };

    const handleRoleChange = (roleName: string, checked: boolean) => {
        const currentRoles = editForm.data.roles;
        if (checked) {
            editForm.setData('roles', [...currentRoles, roleName]);
        } else {
            editForm.setData('roles', currentRoles.filter(r => r !== roleName));
        }
    };

    return (
        <AppLayout>
            <Head title="User Management" />
            
            <div className="space-y-6">
                <div className="flex justify-between items-center">
                    <h1 className="text-2xl font-bold">User Management</h1>
                </div>

                <div className="grid gap-4">
                    {users.map((user) => (
                        <Card key={user.id}>
                            <CardHeader>
                                <div className="flex justify-between items-center">
                                    <div>
                                        <CardTitle>{user.name}</CardTitle>
                                        <p className="text-sm text-gray-600 dark:text-gray-400">{user.email}</p>
                                    </div>
                                    <div className="space-x-2">
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={() => openEditDialog(user)}
                                        >
                                            Edit Roles
                                        </Button>
                                        {!user.roles.some(role => role.name === 'admin') || 
                                         users.filter(u => u.roles.some(r => r.name === 'admin')).length > 1 ? (
                                            <Button
                                                variant="destructive"
                                                size="sm"
                                                onClick={() => handleDeleteUser(user)}
                                            >
                                                Delete
                                            </Button>
                                        ) : null}
                                    </div>
                                </div>
                            </CardHeader>
                            <CardContent>
                                <div className="flex flex-wrap gap-2">
                                    {user.roles.map((role) => (
                                        <Badge 
                                            key={role.id} 
                                            variant={role.name === 'admin' ? 'default' : 'secondary'}
                                        >
                                            {role.name}
                                        </Badge>
                                    ))}
                                    {user.roles.length === 0 && (
                                        <Badge variant="outline">No roles assigned</Badge>
                                    )}
                                </div>
                            </CardContent>
                        </Card>
                    ))}
                </div>

                {/* Edit User Roles Dialog */}
                <Dialog open={!!editingUser} onOpenChange={() => setEditingUser(null)}>
                    <DialogContent>
                        <DialogHeader>
                            <DialogTitle>Edit User Roles - {editingUser?.name}</DialogTitle>
                        </DialogHeader>
                        <form onSubmit={handleEditUser} className="space-y-4">
                            <div>
                                <Label>Roles</Label>
                                <div className="grid grid-cols-1 gap-2 mt-2">
                                    {roles.map((role) => (
                                        <div key={role.id} className="flex items-center space-x-2">
                                            <Checkbox
                                                id={`role-${role.name}`}
                                                checked={editForm.data.roles.includes(role.name)}
                                                onCheckedChange={(checked) =>
                                                    handleRoleChange(role.name, checked as boolean)
                                                }
                                            />
                                            <Label htmlFor={`role-${role.name}`} className="text-sm capitalize">
                                                {role.name}
                                            </Label>
                                        </div>
                                    ))}
                                </div>
                                {editForm.errors.roles && (
                                    <p className="text-red-500 text-sm mt-1">{editForm.errors.roles}</p>
                                )}
                            </div>
                            <div className="flex justify-end space-x-2">
                                <Button
                                    type="button"
                                    variant="outline"
                                    onClick={() => setEditingUser(null)}
                                >
                                    Cancel
                                </Button>
                                <Button type="submit" disabled={editForm.processing}>
                                    Update Roles
                                </Button>
                            </div>
                        </form>
                    </DialogContent>
                </Dialog>
            </div>
        </AppLayout>
    );
}