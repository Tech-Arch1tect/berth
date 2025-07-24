import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import AppLayout from '@/layouts/app-layout';
import { type BreadcrumbItem } from '@/types';
import { Head, router } from '@inertiajs/react';
import { Edit, Mail, Plus, Shield, Trash2, User, Users } from 'lucide-react';
import { useState } from 'react';
import CreateUserDialog from './CreateUserDialog';
import EditUserDialog from './EditUserDialog';

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
    const [showCreateForm, setShowCreateForm] = useState(false);

    const handleDeleteUser = (user: User) => {
        if (confirm(`Are you sure you want to delete user "${user.name}"?`)) {
            router.delete(`/admin/users/${user.id}`);
        }
    };

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="User Management" />

            <div className="space-y-6">
                {/* Header */}
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-to-br from-blue-500/20 to-purple-500/20">
                            <Users className="h-5 w-5 text-blue-500" />
                        </div>
                        <div>
                            <h1 className="text-2xl font-bold">User Management</h1>
                            <p className="text-sm text-muted-foreground">Manage user accounts and role assignments</p>
                        </div>
                    </div>
                    <Button onClick={() => setShowCreateForm(true)}>
                        <Plus className="mr-2 h-4 w-4" />
                        Create User
                    </Button>
                </div>

                {/* Users List */}
                <div className="grid gap-4">
                    {users.map((user) => (
                        <Card key={user.id} className="group transition-all hover:shadow-md">
                            <CardHeader>
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-3">
                                        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-to-br from-primary/20 to-accent/20">
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
                                        <Button variant="outline" size="sm" onClick={() => setEditingUser(user)}>
                                            <Edit className="mr-2 h-4 w-4" />
                                            Edit Roles
                                        </Button>
                                        {!user.roles.some((role) => role.name === 'admin') ||
                                        users.filter((u) => u.roles.some((r) => r.name === 'admin')).length > 1 ? (
                                            <Button variant="destructive" size="sm" onClick={() => handleDeleteUser(user)}>
                                                <Trash2 className="h-4 w-4" />
                                            </Button>
                                        ) : null}
                                    </div>
                                </div>
                            </CardHeader>
                            <CardContent>
                                <div className="mb-3 flex items-center gap-2">
                                    <Shield className="h-4 w-4 text-muted-foreground" />
                                    <span className="text-sm font-medium">Roles:</span>
                                </div>
                                <div className="flex flex-wrap gap-2">
                                    {user.roles.map((role) => (
                                        <Badge key={role.id} variant={role.name === 'admin' ? 'default' : 'secondary'}>
                                            {role.name}
                                        </Badge>
                                    ))}
                                    {user.roles.length === 0 && <Badge variant="outline">No roles assigned</Badge>}
                                </div>
                            </CardContent>
                        </Card>
                    ))}
                </div>

                {/* Dialog Components */}
                <CreateUserDialog isOpen={showCreateForm} onClose={() => setShowCreateForm(false)} roles={roles} />

                <EditUserDialog user={editingUser} onClose={() => setEditingUser(null)} roles={roles} />
            </div>
        </AppLayout>
    );
}
