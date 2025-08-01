import FlashMessages from '@/components/flash-messages';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import AppLayout from '@/layouts/app-layout';
import type { Server } from '@/types/entities';
import { Head, Link, router } from '@inertiajs/react';
import { ArrowLeft, Save } from 'lucide-react';
import { useState } from 'react';

interface RoleServer {
    id: number;
    display_name: string;
    hostname: string;
    port: number;
    https: boolean;
    permissions: {
        access: boolean;
        filemanager_access: boolean;
        filemanager_write: boolean;
        'start-stop': boolean;
        exec: boolean;
        docker_maintenance_read: boolean;
        docker_maintenance_write: boolean;
    };
}

interface Role {
    id: number;
    name: string;
}

interface Props {
    role: Role;
    roleServers: RoleServer[];
    allServers: Server[];
}

export default function RolePermissions({ role, roleServers, allServers }: Props) {
    const [serverPermissions, setServerPermissions] = useState(() => {
        const permissions: Record<
            number,
            {
                server_id: number;
                permissions: {
                    access: boolean;
                    filemanager_access: boolean;
                    filemanager_write: boolean;
                    'start-stop': boolean;
                    exec: boolean;
                    docker_maintenance_read: boolean;
                    docker_maintenance_write: boolean;
                };
            }
        > = {};

        roleServers.forEach((server) => {
            permissions[server.id] = {
                server_id: server.id,
                permissions: { ...server.permissions },
            };
        });

        allServers.forEach((server) => {
            if (!permissions[server.id]) {
                permissions[server.id] = {
                    server_id: server.id,
                    permissions: {
                        access: false,
                        filemanager_access: false,
                        filemanager_write: false,
                        'start-stop': false,
                        exec: false,
                        docker_maintenance_read: false,
                        docker_maintenance_write: false,
                    },
                };
            }
        });

        return permissions;
    });

    const [processing, setProcessing] = useState(false);

    const handlePermissionChange = (serverId: number, permission: string, checked: boolean) => {
        setServerPermissions((prev) => {
            const currentPerms = prev[serverId].permissions;
            let newPerms = { ...currentPerms, [permission]: checked };

            if (checked) {
                if (permission === 'filemanager_access' && !newPerms.access) {
                    newPerms.access = true;
                }
                if (permission === 'filemanager_write' && (!newPerms.access || !newPerms.filemanager_access)) {
                    newPerms.access = true;
                    newPerms.filemanager_access = true;
                }
                if (permission === 'start-stop' && !newPerms.access) {
                    newPerms.access = true;
                }
                if (permission === 'exec' && !newPerms.access) {
                    newPerms.access = true;
                }
                if (permission === 'docker_maintenance_read' && !newPerms.access) {
                    newPerms.access = true;
                }
                if (permission === 'docker_maintenance_write' && (!newPerms.access || !newPerms.docker_maintenance_read)) {
                    newPerms.access = true;
                    newPerms.docker_maintenance_read = true;
                }
            } else {
                if (permission === 'access') {
                    newPerms = {
                        access: false,
                        filemanager_access: false,
                        filemanager_write: false,
                        'start-stop': false,
                        exec: false,
                        docker_maintenance_read: false,
                        docker_maintenance_write: false,
                    };
                }
                if (permission === 'filemanager_access') {
                    newPerms.filemanager_write = false;
                }
                if (permission === 'docker_maintenance_read') {
                    newPerms.docker_maintenance_write = false;
                }
            }

            return {
                ...prev,
                [serverId]: {
                    ...prev[serverId],
                    permissions: newPerms,
                },
            };
        });
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();

        const permissionsArray = Object.values(serverPermissions);

        setProcessing(true);

        router.post(
            `/admin/roles/${role.id}/permissions`,
            {
                serverPermissions: permissionsArray,
            },
            {
                onSuccess: () => {
                    setProcessing(false);
                },
                onError: () => {
                    setProcessing(false);
                },
                onFinish: () => {
                    setProcessing(false);
                },
            },
        );
    };

    const hasAnyPermission = (serverId: number) => {
        const perms = serverPermissions[serverId]?.permissions;
        return (
            perms &&
            (perms.access ||
                perms.filemanager_access ||
                perms.filemanager_write ||
                perms['start-stop'] ||
                perms.exec ||
                perms.docker_maintenance_read ||
                perms.docker_maintenance_write)
        );
    };

    return (
        <AppLayout>
            <Head title={`Manage Permissions - ${role.name}`} />

            <div className="space-y-6">
                <div className="flex items-center space-x-4">
                    <Button variant="outline" size="sm" asChild>
                        <Link href="/admin/roles">
                            <ArrowLeft className="mr-1 h-4 w-4" />
                            Back to Roles
                        </Link>
                    </Button>
                    <div>
                        <h1 className="text-2xl font-bold">Manage Permissions</h1>
                        <p className="text-muted-foreground">Configure server access for the "{role.name}" role</p>
                    </div>
                </div>

                <FlashMessages />

                <form onSubmit={handleSubmit}>
                    <div className="space-y-4">
                        {allServers.map((server) => (
                            <Card key={server.id} className={hasAnyPermission(server.id) ? 'border-primary/20 bg-primary/5' : ''}>
                                <CardHeader>
                                    <CardTitle className="flex items-center justify-between">
                                        <div>
                                            <span className="text-lg">{server.display_name}</span>
                                            <p className="text-sm font-normal text-muted-foreground">
                                                {server.https ? 'https' : 'http'}://{server.hostname}:{server.port}
                                            </p>
                                        </div>
                                        {hasAnyPermission(server.id) && (
                                            <span className="rounded bg-primary/10 px-2 py-1 text-xs text-primary">Access Granted</span>
                                        )}
                                    </CardTitle>
                                </CardHeader>
                                <CardContent>
                                    <div className="grid grid-cols-1 gap-4 md:grid-cols-7">
                                        <div className="flex items-center space-x-2">
                                            <Checkbox
                                                id={`${server.id}-access`}
                                                checked={serverPermissions[server.id]?.permissions.access || false}
                                                onCheckedChange={(checked) => handlePermissionChange(server.id, 'access', checked as boolean)}
                                            />
                                            <label
                                                htmlFor={`${server.id}-access`}
                                                className="text-sm leading-none font-medium peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                                            >
                                                Access
                                            </label>
                                        </div>

                                        <div className="flex items-center space-x-2">
                                            <Checkbox
                                                id={`${server.id}-filemanager_access`}
                                                checked={serverPermissions[server.id]?.permissions.filemanager_access || false}
                                                onCheckedChange={(checked) =>
                                                    handlePermissionChange(server.id, 'filemanager_access', checked as boolean)
                                                }
                                            />
                                            <label
                                                htmlFor={`${server.id}-filemanager_access`}
                                                className="text-sm leading-none font-medium peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                                            >
                                                File Manager
                                            </label>
                                        </div>

                                        <div className="flex items-center space-x-2">
                                            <Checkbox
                                                id={`${server.id}-filemanager_write`}
                                                checked={serverPermissions[server.id]?.permissions.filemanager_write || false}
                                                onCheckedChange={(checked) =>
                                                    handlePermissionChange(server.id, 'filemanager_write', checked as boolean)
                                                }
                                            />
                                            <label
                                                htmlFor={`${server.id}-filemanager_write`}
                                                className="text-sm leading-none font-medium peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                                            >
                                                File Edit
                                            </label>
                                        </div>

                                        <div className="flex items-center space-x-2">
                                            <Checkbox
                                                id={`${server.id}-start-stop`}
                                                checked={serverPermissions[server.id]?.permissions['start-stop'] || false}
                                                onCheckedChange={(checked) => handlePermissionChange(server.id, 'start-stop', checked as boolean)}
                                            />
                                            <label
                                                htmlFor={`${server.id}-start-stop`}
                                                className="text-sm leading-none font-medium peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                                            >
                                                Up/Down
                                            </label>
                                        </div>

                                        <div className="flex items-center space-x-2">
                                            <Checkbox
                                                id={`${server.id}-exec`}
                                                checked={serverPermissions[server.id]?.permissions.exec || false}
                                                onCheckedChange={(checked) => handlePermissionChange(server.id, 'exec', checked as boolean)}
                                            />
                                            <label
                                                htmlFor={`${server.id}-exec`}
                                                className="text-sm leading-none font-medium peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                                            >
                                                Exec
                                            </label>
                                        </div>

                                        <div className="flex items-center space-x-2">
                                            <Checkbox
                                                id={`${server.id}-docker_maintenance_read`}
                                                checked={serverPermissions[server.id]?.permissions.docker_maintenance_read || false}
                                                onCheckedChange={(checked) =>
                                                    handlePermissionChange(server.id, 'docker_maintenance_read', checked as boolean)
                                                }
                                            />
                                            <label
                                                htmlFor={`${server.id}-docker_maintenance_read`}
                                                className="text-sm leading-none font-medium peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                                            >
                                                Docker Read
                                            </label>
                                        </div>

                                        <div className="flex items-center space-x-2">
                                            <Checkbox
                                                id={`${server.id}-docker_maintenance_write`}
                                                checked={serverPermissions[server.id]?.permissions.docker_maintenance_write || false}
                                                onCheckedChange={(checked) =>
                                                    handlePermissionChange(server.id, 'docker_maintenance_write', checked as boolean)
                                                }
                                            />
                                            <label
                                                htmlFor={`${server.id}-docker_maintenance_write`}
                                                className="text-sm leading-none font-medium peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                                            >
                                                Docker Write
                                            </label>
                                        </div>
                                    </div>

                                    <div className="mt-3 text-xs text-muted-foreground">
                                        <div className="grid grid-cols-1 gap-4 md:grid-cols-7">
                                            <span>View stacks & logs</span>
                                            <span>Browse files</span>
                                            <span>Edit & delete files</span>
                                            <span>Start/stop containers</span>
                                            <span>Execute commands</span>
                                            <span>View Docker maintenance</span>
                                            <span>Perform Docker maintenance</span>
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>
                        ))}
                    </div>

                    <div className="mt-6 flex justify-end space-x-2">
                        <Button variant="outline" asChild>
                            <Link href="/admin/roles">Cancel</Link>
                        </Button>
                        <Button type="submit" disabled={processing}>
                            <Save className="mr-1 h-4 w-4" />
                            Save Permissions
                        </Button>
                    </div>
                </form>
            </div>
        </AppLayout>
    );
}
