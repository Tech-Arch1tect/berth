import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { useForm } from '@inertiajs/react';
import React, { useEffect, useRef } from 'react';

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
    const initialRoles = user?.roles.map((r) => r.name) || ([] as string[]);
    const editForm = useForm({
        roles: initialRoles,
    });
    
    const editFormRef = useRef(editForm);

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
            editForm.setData(
                'roles',
                currentRoles.filter((r) => r !== roleName),
            );
        }
    };

    // Reset form data when user changes
    useEffect(() => {
        if (user) {
            editFormRef.current.setData(
                'roles',
                user.roles.map((r) => r.name),
            );
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
                        <p className="mb-3 text-sm text-muted-foreground">Select the roles to assign to this user</p>
                        <div className="grid grid-cols-1 gap-3">
                            {roles.map((role) => (
                                <div key={role.id} className="flex items-center space-x-3 rounded-lg border p-3">
                                    <Checkbox
                                        id={`role-${role.name}`}
                                        checked={editForm.data.roles.includes(role.name)}
                                        onCheckedChange={(checked) => handleRoleChange(role.name, checked as boolean)}
                                    />
                                    <Label htmlFor={`role-${role.name}`} className="flex-1 text-sm font-medium capitalize">
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
                        {editForm.errors.roles && <p className="mt-2 text-sm text-destructive">{editForm.errors.roles}</p>}
                    </div>
                    <div className="flex justify-end space-x-2 pt-4">
                        <Button type="button" variant="outline" onClick={onClose}>
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
