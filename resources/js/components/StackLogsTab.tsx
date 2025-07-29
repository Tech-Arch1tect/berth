import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useStackLogs } from '@/hooks/queries/use-stack-logs';
import type { Server, Stack } from '@/types/entities';
import { AlertCircle, FileText, RefreshCw } from 'lucide-react';
import { useState } from 'react';

interface StackLogsTabProps {
    server: Server;
    stack: Stack;
}

export default function StackLogsTab({ server, stack }: StackLogsTabProps) {
    const [selectedService, setSelectedService] = useState<string>('all');
    const [logTail, setLogTail] = useState<string>('100');

    const {
        data: logs,
        isLoading: isLoadingLogs,
        error: logsError,
        refetch: refetchLogs,
        isFetching,
    } = useStackLogs(server.id, stack.name, selectedService === 'all' ? undefined : selectedService, parseInt(logTail));

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
                    <Button onClick={() => refetchLogs()} disabled={isFetching} variant="secondary">
                        <RefreshCw className={`mr-2 h-4 w-4 ${isFetching ? 'animate-spin' : ''}`} />
                        Refresh Logs
                    </Button>
                </div>
                {isLoadingLogs ? (
                    <div className="flex items-center gap-2 text-muted-foreground">
                        <RefreshCw className="h-4 w-4 animate-spin" />
                        Loading logs...
                    </div>
                ) : logsError ? (
                    <div className="flex items-center gap-2 text-destructive">
                        <AlertCircle className="h-4 w-4" />
                        Failed to load logs: {logsError.message}
                    </div>
                ) : logs && logs.length > 0 ? (
                    <div className="max-h-96 overflow-y-auto rounded bg-muted/30 p-4">
                        {logs.map((log, index) => (
                            <div key={index} className="mb-1 font-mono text-xs">
                                <span className="text-muted-foreground">[{log.timestamp}]</span>
                                {log.service && <span className="ml-1 text-primary">{log.service}:</span>}
                                <span className="ml-1">{log.message}</span>
                            </div>
                        ))}
                    </div>
                ) : (
                    <div className="flex items-center gap-2 text-muted-foreground">
                        <FileText className="h-4 w-4" />
                        No logs available.
                    </div>
                )}
            </CardContent>
        </Card>
    );
}
