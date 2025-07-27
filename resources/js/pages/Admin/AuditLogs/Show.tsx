import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import AppLayout from '@/layouts/app-layout';
import { Head, Link, usePage } from '@inertiajs/react';
import { ArrowLeft } from 'lucide-react';

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
    old_values?: Record<string, unknown>;
    new_values?: Record<string, unknown>;
    metadata?: Record<string, unknown>;
    ip_address?: string;
    user_agent?: string;
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

interface PageProps {
    auditLog: AuditLog;
    [key: string]: unknown;
}

export default function Show() {
    const { auditLog } = usePage<PageProps>().props;

    const getEventBadgeVariant = (event: string) => {
        if (event.includes('created') || event.includes('up') || event.includes('login')) return 'default';
        if (event.includes('updated') || event.includes('renamed')) return 'secondary';
        if (event.includes('deleted') || event.includes('down') || event.includes('logout')) return 'destructive';
        if (event.includes('access_denied')) return 'destructive';
        return 'outline';
    };

    const formatJsonData = (data: Record<string, unknown> | null | undefined) => {
        if (!data || Object.keys(data).length === 0) return null;

        return <pre className="max-h-48 overflow-auto rounded bg-muted p-3 text-xs">{JSON.stringify(data, null, 2)}</pre>;
    };

    return (
        <AppLayout>
            <Head title={`Audit Log #${auditLog.id}`} />

            <div className="container mx-auto space-y-6 p-6">
                <div className="flex items-center justify-between">
                    <div>
                        <Link
                            href={route('admin.audit-logs.index')}
                            className="mb-2 flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
                        >
                            <ArrowLeft className="h-4 w-4" />
                            Back to Audit Logs
                        </Link>
                        <h1 className="text-2xl font-bold">Audit Log #{auditLog.id}</h1>
                        <p className="text-muted-foreground">Detailed view of audit log entry</p>
                    </div>
                </div>

                {/* Event Information */}
                <Card>
                    <CardHeader>
                        <CardTitle>Event Information</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                            <div>
                                <label className="text-sm font-medium text-muted-foreground">Event</label>
                                <div className="mt-1">
                                    <Badge variant={getEventBadgeVariant(auditLog.event)}>{auditLog.event_description}</Badge>
                                </div>
                            </div>
                            <div>
                                <label className="text-sm font-medium text-muted-foreground">Timestamp</label>
                                <div className="mt-1 font-mono text-sm">{auditLog.formatted_created_at}</div>
                            </div>
                            <div>
                                <label className="text-sm font-medium text-muted-foreground">Request Method</label>
                                <div className="mt-1">
                                    <Badge variant="outline">{auditLog.method}</Badge>
                                </div>
                            </div>
                            <div>
                                <label className="text-sm font-medium text-muted-foreground">Auditable Type</label>
                                <div className="mt-1 text-sm">{auditLog.auditable_type || 'N/A'}</div>
                            </div>
                        </div>

                        <div>
                            <label className="text-sm font-medium text-muted-foreground">URL</label>
                            <div className="mt-1">
                                <code className="rounded bg-muted px-2 py-1 text-xs break-all">{auditLog.url}</code>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                {/* User Information */}
                <Card>
                    <CardHeader>
                        <CardTitle>User Information</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                            <div>
                                <label className="text-sm font-medium text-muted-foreground">User Name</label>
                                <div className="mt-1 text-sm">{auditLog.user_name || 'Unknown'}</div>
                            </div>
                            <div>
                                <label className="text-sm font-medium text-muted-foreground">Email</label>
                                <div className="mt-1 text-sm">{auditLog.user_email || 'Unknown'}</div>
                            </div>
                            <div>
                                <label className="text-sm font-medium text-muted-foreground">IP Address</label>
                                <div className="mt-1 font-mono text-sm">{auditLog.ip_address || 'Unknown'}</div>
                            </div>
                            <div>
                                <label className="text-sm font-medium text-muted-foreground">User Agent</label>
                                <div className="mt-1 text-xs break-all text-muted-foreground">{auditLog.user_agent || 'Unknown'}</div>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                {/* Context Information */}
                <Card>
                    <CardHeader>
                        <CardTitle>Context Information</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                            <div>
                                <label className="text-sm font-medium text-muted-foreground">Server</label>
                                <div className="mt-1 text-sm">{auditLog.server?.display_name || 'N/A'}</div>
                            </div>
                            <div>
                                <label className="text-sm font-medium text-muted-foreground">Stack</label>
                                <div className="mt-1 text-sm">{auditLog.stack_name || 'N/A'}</div>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                {/* Data Changes */}
                {(auditLog.old_values || auditLog.new_values) && (
                    <Card>
                        <CardHeader>
                            <CardTitle>Data Changes</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            {auditLog.old_values && (
                                <div>
                                    <label className="text-sm font-medium text-muted-foreground">Old Values</label>
                                    <div className="mt-1">{formatJsonData(auditLog.old_values)}</div>
                                </div>
                            )}

                            {auditLog.new_values && (
                                <div>
                                    <label className="text-sm font-medium text-muted-foreground">New Values</label>
                                    <div className="mt-1">{formatJsonData(auditLog.new_values)}</div>
                                </div>
                            )}
                        </CardContent>
                    </Card>
                )}

                {/* Metadata */}
                {auditLog.metadata && Object.keys(auditLog.metadata).length > 0 && (
                    <Card>
                        <CardHeader>
                            <CardTitle>Metadata</CardTitle>
                        </CardHeader>
                        <CardContent>{formatJsonData(auditLog.metadata)}</CardContent>
                    </Card>
                )}
            </div>
        </AppLayout>
    );
}
