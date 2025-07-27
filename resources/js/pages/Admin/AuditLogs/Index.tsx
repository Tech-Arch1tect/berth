import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import AppLayout from '@/layouts/app-layout';
import { Head, Link, router, usePage } from '@inertiajs/react';
import { Download, Eye } from 'lucide-react';
import { useState } from 'react';

interface AuditLog {
    id: number;
    event: string;
    event_description: string;
    auditable_type?: string;
    auditable_id?: number;
    user_id?: number;
    user_email?: string;
    user_name?: string;
    url: string;
    method: string;
    ip_address?: string;
    server_id?: number;
    stack_name?: string;
    created_at: string;
    formatted_created_at: string;
    user?: {
        id: number;
        name: string;
        email: string;
    };
    server?: {
        id: number;
        display_name: string;
    };
}

interface FilterOption {
    value: string | number;
    label: string;
}

interface PageProps {
    auditLogs: {
        data: AuditLog[];
        current_page: number;
        last_page: number;
        per_page: number;
        total: number;
        links: Array<{
            url?: string;
            label: string;
            active: boolean;
        }>;
    };
    filters: {
        event?: string;
        user_id?: number;
        server_id?: number;
        date_from?: string;
        date_to?: string;
        search?: string;
    };
    filterOptions: {
        events: FilterOption[];
        users: FilterOption[];
        servers: FilterOption[];
    };
    [key: string]: unknown;
}

export default function Index() {
    const { auditLogs, filters, filterOptions } = usePage<PageProps>().props;
    const [localFilters, setLocalFilters] = useState(filters);

    const handleFilterChange = (key: keyof typeof filters, value: string | number | undefined) => {
        const filterValue = value === 'all' ? undefined : value;
        const newFilters = { ...localFilters, [key]: filterValue };
        setLocalFilters(newFilters);

        router.get(route('admin.audit-logs.index'), Object.fromEntries(Object.entries(newFilters).filter(([, v]) => v !== '' && v !== undefined)), {
            preserveState: true,
        });
    };

    const clearFilters = () => {
        setLocalFilters({});
        router.get(route('admin.audit-logs.index'));
    };

    const exportLogs = () => {
        const params = new URLSearchParams();
        Object.entries(localFilters).forEach(([key, value]) => {
            if (value) params.append(key, value.toString());
        });

        window.open(`${route('admin.audit-logs.export')}?${params.toString()}`);
    };

    const getEventBadgeVariant = (event: string) => {
        if (event.includes('created') || event.includes('up') || event.includes('login')) return 'default';
        if (event.includes('updated') || event.includes('renamed')) return 'secondary';
        if (event.includes('deleted') || event.includes('down') || event.includes('logout')) return 'destructive';
        if (event.includes('access_denied')) return 'destructive';
        return 'outline';
    };

    return (
        <AppLayout>
            <Head title="Audit Logs" />

            <div className="container mx-auto space-y-6 p-6">
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-2xl font-bold">Audit Logs</h1>
                        <p className="text-muted-foreground">View all system activity and user actions</p>
                    </div>
                    <Button onClick={exportLogs} variant="outline">
                        <Download className="mr-2 h-4 w-4" />
                        Export CSV
                    </Button>
                </div>

                {/* Filters */}
                <Card>
                    <CardHeader>
                        <CardTitle>Filters</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
                            <div>
                                <label className="text-sm font-medium">Search</label>
                                <Input
                                    placeholder="Search URL, user, IP..."
                                    value={localFilters.search || ''}
                                    onChange={(e) => handleFilterChange('search', e.target.value)}
                                />
                            </div>

                            <div>
                                <label className="text-sm font-medium">Event</label>
                                <Select value={localFilters.event || 'all'} onValueChange={(value) => handleFilterChange('event', value)}>
                                    <SelectTrigger>
                                        <SelectValue placeholder="All Events" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="all">All Events</SelectItem>
                                        {filterOptions.events.map((event) => (
                                            <SelectItem key={event.value} value={event.value.toString()}>
                                                {event.label}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>

                            <div>
                                <label className="text-sm font-medium">User</label>
                                <Select
                                    value={localFilters.user_id?.toString() || 'all'}
                                    onValueChange={(value) => handleFilterChange('user_id', value === 'all' ? undefined : parseInt(value))}
                                >
                                    <SelectTrigger>
                                        <SelectValue placeholder="All Users" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="all">All Users</SelectItem>
                                        {filterOptions.users.map((user) => (
                                            <SelectItem key={user.value} value={user.value.toString()}>
                                                {user.label}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>

                            <div>
                                <label className="text-sm font-medium">Server</label>
                                <Select
                                    value={localFilters.server_id?.toString() || 'all'}
                                    onValueChange={(value) => handleFilterChange('server_id', value === 'all' ? undefined : parseInt(value))}
                                >
                                    <SelectTrigger>
                                        <SelectValue placeholder="All Servers" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="all">All Servers</SelectItem>
                                        {filterOptions.servers.map((server) => (
                                            <SelectItem key={server.value} value={server.value.toString()}>
                                                {server.label}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>

                            <div>
                                <label className="text-sm font-medium">From Date</label>
                                <Input
                                    type="date"
                                    value={localFilters.date_from || ''}
                                    onChange={(e) => handleFilterChange('date_from', e.target.value)}
                                />
                            </div>

                            <div>
                                <label className="text-sm font-medium">To Date</label>
                                <Input
                                    type="date"
                                    value={localFilters.date_to || ''}
                                    onChange={(e) => handleFilterChange('date_to', e.target.value)}
                                />
                            </div>
                        </div>

                        <div className="mt-4 flex justify-end">
                            <Button variant="outline" onClick={clearFilters}>
                                Clear Filters
                            </Button>
                        </div>
                    </CardContent>
                </Card>

                {/* Results */}
                <Card>
                    <CardHeader>
                        <CardTitle>Audit Log Entries ({auditLogs.total} total)</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-4">
                            {auditLogs.data.map((log) => (
                                <div key={log.id} className="rounded-lg border p-4 transition-colors hover:bg-muted/50">
                                    <div className="flex items-start justify-between">
                                        <div className="flex-1 space-y-2">
                                            <div className="flex items-center gap-2">
                                                <Badge variant={getEventBadgeVariant(log.event)}>{log.event_description}</Badge>
                                                <span className="text-sm text-muted-foreground">{log.formatted_created_at}</span>
                                            </div>

                                            <div className="grid grid-cols-1 gap-4 text-sm md:grid-cols-2">
                                                <div>
                                                    <span className="font-medium">User:</span> {log.user_name || 'Unknown'} (
                                                    {log.user_email || 'No email'})
                                                </div>
                                                <div>
                                                    <span className="font-medium">IP:</span> {log.ip_address || 'Unknown'}
                                                </div>
                                                <div>
                                                    <span className="font-medium">Server:</span> {log.server?.display_name || 'N/A'}
                                                </div>
                                                <div>
                                                    <span className="font-medium">Stack:</span> {log.stack_name || 'N/A'}
                                                </div>
                                            </div>

                                            <div className="text-sm">
                                                <span className="font-medium">URL:</span>{' '}
                                                <code className="rounded bg-muted px-1 text-xs">
                                                    {log.method} {log.url}
                                                </code>
                                            </div>
                                        </div>

                                        <Link href={route('admin.audit-logs.show', log.id)} className="ml-4">
                                            <Button variant="outline" size="sm">
                                                <Eye className="h-4 w-4" />
                                            </Button>
                                        </Link>
                                    </div>
                                </div>
                            ))}
                        </div>

                        {auditLogs.data.length === 0 && (
                            <div className="py-8 text-center text-muted-foreground">No audit logs found matching your filters.</div>
                        )}

                        {/* Pagination */}
                        {auditLogs.total > auditLogs.per_page && (
                            <div className="mt-6 flex items-center justify-between">
                                <div className="text-sm text-muted-foreground">
                                    Showing {(auditLogs.current_page - 1) * auditLogs.per_page + 1} to{' '}
                                    {Math.min(auditLogs.current_page * auditLogs.per_page, auditLogs.total)} of {auditLogs.total} entries
                                </div>

                                <div className="flex items-center gap-2">
                                    {auditLogs.links.map((link, index) => (
                                        <Button
                                            key={index}
                                            variant={link.active ? 'default' : 'outline'}
                                            size="sm"
                                            disabled={!link.url}
                                            onClick={() => link.url && router.visit(link.url)}
                                            dangerouslySetInnerHTML={{ __html: link.label }}
                                        />
                                    ))}
                                </div>
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>
        </AppLayout>
    );
}
