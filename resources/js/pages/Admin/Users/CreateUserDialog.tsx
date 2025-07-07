import { useState } from 'react';
import { useForm } from '@inertiajs/react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import InputError from '@/components/input-error';
import { Eye, EyeOff } from 'lucide-react';

interface Role {
    id: number;
    name: string;
}

interface CreateUserDialogProps {
    isOpen: boolean;
    onClose: () => void;
    roles: Role[];
}

export default function CreateUserDialog({ isOpen, onClose, roles }: CreateUserDialogProps) {
    const [showPassword, setShowPassword] = useState(false);

    const createForm = useForm({
        name: '',
        email: '',
        password: '',
        password_confirmation: '',
        roles: [] as string[],
        email_verified: true as boolean,
    });

    const handleCreateUser = (e: React.FormEvent) => {
        e.preventDefault();
        
        createForm.post('/admin/users', {
            onSuccess: () => {
                createForm.reset();
                setShowPassword(false);
                onClose();
            },
        });
    };

    const handleCreateRoleChange = (roleName: string, checked: boolean) => {
        const currentRoles = createForm.data.roles;
        if (checked) {
            createForm.setData('roles', [...currentRoles, roleName]);
        } else {
            createForm.setData('roles', currentRoles.filter(r => r !== roleName));
        }
    };

    const handleClose = () => {
        createForm.reset();
        setShowPassword(false);
        onClose();
    };

    return (
        <Dialog open={isOpen} onOpenChange={handleClose}>
            <DialogContent className="max-w-2xl">
                <DialogHeader>
                    <DialogTitle>Create New User</DialogTitle>
                </DialogHeader>
                <form onSubmit={handleCreateUser} className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <Label htmlFor="name">Name</Label>
                            <Input
                                id="name"
                                type="text"
                                value={createForm.data.name}
                                onChange={(e) => createForm.setData('name', e.target.value)}
                                placeholder="Enter full name"
                                required
                            />
                            <InputError message={createForm.errors.name} />
                        </div>
                        <div>
                            <Label htmlFor="email">Email</Label>
                            <Input
                                id="email"
                                type="email"
                                value={createForm.data.email}
                                onChange={(e) => createForm.setData('email', e.target.value)}
                                placeholder="Enter email address"
                                required
                            />
                            <InputError message={createForm.errors.email} />
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <Label htmlFor="password">Password</Label>
                            <div className="relative">
                                <Input
                                    id="password"
                                    type={showPassword ? "text" : "password"}
                                    value={createForm.data.password}
                                    onChange={(e) => createForm.setData('password', e.target.value)}
                                    placeholder="Enter password"
                                    required
                                />
                                <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                                    onClick={() => setShowPassword(!showPassword)}
                                >
                                    {showPassword ? (
                                        <EyeOff className="h-4 w-4" />
                                    ) : (
                                        <Eye className="h-4 w-4" />
                                    )}
                                </Button>
                            </div>
                            <InputError message={createForm.errors.password} />
                        </div>
                        <div>
                            <Label htmlFor="password_confirmation">Confirm Password</Label>
                            <Input
                                id="password_confirmation"
                                type={showPassword ? "text" : "password"}
                                value={createForm.data.password_confirmation}
                                onChange={(e) => createForm.setData('password_confirmation', e.target.value)}
                                placeholder="Confirm password"
                                required
                            />
                            <InputError message={createForm.errors.password_confirmation} />
                        </div>
                    </div>

                    <div>
                        <div className="flex items-center justify-between mb-3">
                            <Label className="text-base font-medium">Roles</Label>
                            <div className="flex items-center space-x-2">
                                <Checkbox
                                    id="email_verified"
                                    checked={createForm.data.email_verified}
                                    onCheckedChange={(checked) =>
                                        createForm.setData('email_verified', !!checked)
                                    }
                                />
                                <Label htmlFor="email_verified" className="text-sm">Email verified</Label>
                            </div>
                        </div>
                        <p className="text-sm text-muted-foreground mb-3">
                            Select the roles to assign to this user
                        </p>
                        <div className="grid grid-cols-1 gap-3 max-h-40 overflow-y-auto">
                            {roles.map((role) => (
                                <div key={role.id} className="flex items-center space-x-3 p-3 border rounded-lg">
                                    <Checkbox
                                        id={`create-role-${role.name}`}
                                        checked={createForm.data.roles.includes(role.name)}
                                        onCheckedChange={(checked) =>
                                            handleCreateRoleChange(role.name, checked as boolean)
                                        }
                                    />
                                    <Label htmlFor={`create-role-${role.name}`} className="text-sm font-medium capitalize flex-1">
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
                        <InputError message={createForm.errors.roles} />
                    </div>

                    <div className="flex justify-end space-x-2 pt-4">
                        <Button
                            type="button"
                            variant="outline"
                            onClick={handleClose}
                        >
                            Cancel
                        </Button>
                        <Button type="submit" disabled={createForm.processing}>
                            {createForm.processing ? 'Creating...' : 'Create User'}
                        </Button>
                    </div>
                </form>
            </DialogContent>
        </Dialog>
    );
}