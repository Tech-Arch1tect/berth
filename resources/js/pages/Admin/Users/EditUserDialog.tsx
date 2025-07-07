import React from 'react';
import { useForm } from '@inertiajs/react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';

interface Role {
    id: number;
    name: string;
}

interface User {
    id: number;
    name: string;
    email: string;
    roles: Role[];
}

interface EditUserDialogProps {
    user: User | null;
    onClose: () => void;
    roles: Role[];
}

export default function EditUserDialog({ user, onClose, roles }: EditUserDialogProps) {
    const editForm = useForm({
        roles: user?.roles.map(r => r.name) || [] as string[],
    });

    const handleEditUser = (e: React.FormEvent) => {
        e.preventDefault();
        if (!user) return;
        
        editForm.put(`/admin/users/${user.id}/roles`, {
            onSuccess: () => {
                editForm.reset();
                onClose();
            },
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

    // Reset form data when user changes
    React.useEffect(() => {
        if (user) {
            editForm.setData('roles', user.roles.map(r => r.name));
        }
    }, [user]);

    return (
        <Dialog open={!!user} onOpenChange={onClose}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Edit User Roles - {user?.name}</DialogTitle>
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
                            onClick={onClose}
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
    );
}