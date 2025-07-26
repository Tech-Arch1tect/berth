import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import type { LogsResponse, Server, Stack } from '@/types/entities';
import { apiGet } from '@/utils/api';
import { AlertCircle, FileText } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';

interface StackLogsTabProps {
    server: Server;
    stack: Stack;
}

export default function StackLogsTab({ server, stack }: StackLogsTabProps) {
    const [logs, setLogs] = useState<LogsResponse | null>(null);
    const [isLoadingLogs, setIsLoadingLogs] = useState(false);
    const [selectedService, setSelectedService] = useState<string>('all');
    const [logTail, setLogTail] = useState<string>('100');

    const fetchLogs = useCallback(async () => {
        setIsLoadingLogs(true);
        try {
            const params = new URLSearchParams({ tail: logTail });
            if (selectedService !== 'all') {
                params.append('service', selectedService);
            }
            const response = await apiGet<LogsResponse>(`/api/servers/${server.id}/stacks/${stack.name}/logs?${params}`);
            if (response.success) {
                setLogs(response.data || null);
            } else {
                setLogs(null);
            }
        } catch {
            setLogs(null);
        } finally {
            setIsLoadingLogs(false);
        }
    }, [server.id, stack.name, selectedService, logTail]);

    useEffect(() => {
        fetchLogs();
    }, [fetchLogs]);

    const serviceOptions = [{ value: 'all', label: 'All Services' }, ...Object.keys(stack.services).map((name) => ({ value: name, label: name }))];
    const tailOptions = ['100', '500', '1000', '2000'];

    return (
        <Card className="shadow-sm">
            <CardContent className="p-6">
                <div className="mb-4 flex items-center gap-3">
                    <FileText className="h-5 w-5 text-muted-foreground" />
                    <span className="font-medium">Stack Logs</span>
                </div>
                <div className="mb-4 flex flex-wrap items-end gap-4">
                    <div>
                        <label className="mb-1 block text-xs font-medium text-muted-foreground">Service</label>
                        <Select value={selectedService} onValueChange={setSelectedService}>
                            <SelectTrigger className="w-40">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                {serviceOptions.map((opt) => (
                                    <SelectItem key={opt.value} value={opt.value}>
                                        {opt.label}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                    <div>
                        <label className="mb-1 block text-xs font-medium text-muted-foreground">Tail</label>
                        <Select value={logTail} onValueChange={setLogTail}>
                            <SelectTrigger className="w-24">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                {tailOptions.map((opt) => (
                                    <SelectItem key={opt} value={opt}>
                                        {opt}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                    <Button onClick={fetchLogs} disabled={isLoadingLogs} variant="secondary">
                        Fetch Logs
                    </Button>
                </div>
                {isLoadingLogs ? (
                    <div>Loading logs...</div>
                ) : logs ? (
                    <pre className="max-h-96 overflow-x-auto rounded bg-muted/30 p-4 text-xs whitespace-pre-wrap">{logs.logs}</pre>
                ) : (
                    <div className="flex items-center gap-2 text-muted-foreground">
                        <AlertCircle className="h-4 w-4" />
                        No logs available.
                    </div>
                )}
            </CardContent>
        </Card>
    );
}
