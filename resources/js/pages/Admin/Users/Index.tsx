import { useState } from 'react';
import { Head, useForm, router } from '@inertiajs/react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Users, Edit, Trash2, Shield, Mail, User } from 'lucide-react';
import AppLayout from '@/layouts/app-layout';
import { type BreadcrumbItem } from '@/types';

const breadcrumbs: BreadcrumbItem[] = [
    { title: 'Dashboard', href: '/dashboard' },
    { title: 'Administration', href: '/admin' },
    { title: 'Users', href: '/admin/users' },
];

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
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="User Management" />
            
            <div className="space-y-6">
                {/* Header */}
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-gradient-to-br from-blue-500/20 to-purple-500/20 rounded-lg flex items-center justify-center">
                        <Users className="h-5 w-5 text-blue-500" />
                    </div>
                    <div>
                        <h1 className="text-2xl font-bold">User Management</h1>
                        <p className="text-sm text-muted-foreground">
                            Manage user accounts and role assignments
                        </p>
                    </div>
                </div>

                {/* Users List */}
                <div className="grid gap-4">
                    {users.map((user) => (
                        <Card key={user.id} className="group hover:shadow-md transition-all">
                            <CardHeader>
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 bg-gradient-to-br from-primary/20 to-accent/20 rounded-lg flex items-center justify-center">
                                            <User className="h-5 w-5 text-primary" />
                                        </div>
                                        <div>
                                            <CardTitle className="text-lg">{user.name}</CardTitle>
                                            <div className="flex items-center gap-1 text-sm text-muted-foreground">
                                                <Mail className="h-3 w-3" />
                                                {user.email}
                                            </div>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={() => openEditDialog(user)}
                                        >
                                            <Edit className="h-4 w-4 mr-2" />
                                            Edit Roles
                                        </Button>
                                        {!user.roles.some(role => role.name === 'admin') || 
                                         users.filter(u => u.roles.some(r => r.name === 'admin')).length > 1 ? (
                                            <Button
                                                variant="destructive"
                                                size="sm"
                                                onClick={() => handleDeleteUser(user)}
                                            >
                                                <Trash2 className="h-4 w-4" />
                                            </Button>
                                        ) : null}
                                    </div>
                                </div>
                            </CardHeader>
                            <CardContent>
                                <div className="flex items-center gap-2 mb-3">
                                    <Shield className="h-4 w-4 text-muted-foreground" />
                                    <span className="text-sm font-medium">Roles:</span>
                                </div>
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
                                <Label className="text-base font-medium">Roles</Label>
                                <p className="text-sm text-muted-foreground mb-3">
                                    Select the roles to assign to this user
                                </p>
                                <div className="grid grid-cols-1 gap-3">
                                    {roles.map((role) => (
                                        <div key={role.id} className="flex items-center space-x-3 p-3 border rounded-lg">
                                            <Checkbox
                                                id={`role-${role.name}`}
                                                checked={editForm.data.roles.includes(role.name)}
                                                onCheckedChange={(checked) =>
                                                    handleRoleChange(role.name, checked as boolean)
                                                }
                                            />
                                            <Label htmlFor={`role-${role.name}`} className="text-sm font-medium capitalize flex-1">
                                                {role.name}
                                            </Label>
                                            {role.name === 'admin' && (
                                                <Badge variant="outline" className="text-xs">
                                                    Full Access
                                                </Badge>
                                            )}
                                        </div>
                                    ))}
                                </div>
                                {editForm.errors.roles && (
                                    <p className="text-destructive text-sm mt-2">{editForm.errors.roles}</p>
                                )}
                            </div>
                            <div className="flex justify-end space-x-2 pt-4">
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