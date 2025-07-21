import { useState, useEffect, useRef } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { CheckCircle, XCircle, Activity, Minimize2 } from 'lucide-react';

interface ComposeEvent {
    type: string;
    timestamp: string;
    status?: {
        current: number;
        total: number;
    };
    service?: {
        name: string;
        action: string;
        progress?: string;
        size?: string;
        duration?: string;
    };
    network?: {
        name: string;
        action: string;
        duration?: string;
    };
    container?: {
        name: string;
        action: string;
        duration?: string;
    };
    message?: string;
}

interface ServiceState {
    name: string;
    action: string;
    progress?: string;
    duration?: string;
    lastUpdated: number;
}

interface Props {
    url: string;
    onComplete?: (success: boolean) => void;
    onError?: (error: string) => void;
    title: string;
    isOpen: boolean;
    onClose: () => void;
}

class StructuredEventProcessor {
    private services: Map<string, ServiceState> = new Map();
    private containers: Map<string, ServiceState> = new Map();
    private networks: Map<string, ServiceState> = new Map();
    private generalMessages: string[] = [];
    private overallStatus: { current: number; total: number } | null = null;

    processEvent(event: ComposeEvent): void {
        const now = Date.now();
        
        switch (event.type) {
            case 'status':
                if (event.status) {
                    this.overallStatus = event.status;
                }
                break;
                
            case 'service':
                if (event.service) {
                    this.services.set(event.service.name, {
                        name: event.service.name,
                        action: event.service.action,
                        progress: event.service.progress,
                        duration: event.service.duration,
                        lastUpdated: now
                    });
                }
                break;
                
            case 'container':
                if (event.container) {
                    this.containers.set(event.container.name, {
                        name: event.container.name,
                        action: event.container.action,
                        duration: event.container.duration,
                        lastUpdated: now
                    });
                }
                break;
                
            case 'network':
                if (event.network) {
                    this.networks.set(event.network.name, {
                        name: event.network.name,
                        action: event.network.action,
                        duration: event.network.duration,
                        lastUpdated: now
                    });
                }
                break;
                
            case 'connection':
            case 'complete':
            case 'error':
            case 'log':
                if (event.message) {
                    this.generalMessages.push(event.message);
                }
                break;
        }
    }

    getDisplay(): string {
        const lines: string[] = [];
        
        if (this.overallStatus) {
            lines.push(`[+] Running ${this.overallStatus.current}/${this.overallStatus.total}`);
        }
        
        this.services.forEach(service => {
            let line = ` ✔ ${service.name} ${service.action}`;
            if (service.progress) line += ` ${service.progress}`;
            if (service.duration) line += ` ${service.duration}`;
            lines.push(line);
        });
        
        this.containers.forEach(container => {
            let line = ` ✔ Container ${container.name} ${container.action}`;
            if (container.duration) line += ` ${container.duration}`;
            lines.push(line);
        });
        
        this.networks.forEach(network => {
            let line = ` ✔ Network ${network.name} ${network.action}`;
            if (network.duration) line += ` ${network.duration}`;
            lines.push(line);
        });
        
        const recentMessages = this.generalMessages.slice(-10);
        lines.push(...recentMessages);
        
        return lines.join('\n');
    }

    reset(): void {
        this.services.clear();
        this.containers.clear();
        this.networks.clear();
        this.generalMessages = [];
        this.overallStatus = null;
    }
}

export default function ProgressModal({ url, onComplete, onError, title, isOpen, onClose }: Props) {
    const [output, setOutput] = useState<string>('');
    const [isConnected, setIsConnected] = useState(false);
    const [overallStatus, setOverallStatus] = useState<'running' | 'completed' | 'error'>('running');
    const [isMinimized, setIsMinimized] = useState(false);
    const [completedAt, setCompletedAt] = useState<Date | null>(null);
    const [agentTimeout, setAgentTimeout] = useState<number>(600000);
    const eventSourceRef = useRef<AbortController | null>(null);
    const outputEndRef = useRef<HTMLDivElement>(null);
    const shouldConnectRef = useRef<boolean>(true);
    const eventProcessor = useRef(new StructuredEventProcessor());
    const updateTimeoutRef = useRef<NodeJS.Timeout | null>(null);
    const fetchTimeoutRef = useRef<NodeJS.Timeout | null>(null);

    useEffect(() => {
        outputEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [output]);

    useEffect(() => {
        const fetchConfig = async () => {
            try {
                const response = await fetch('/api/config', {
                    credentials: 'include'
                });
                if (response.ok) {
                    const config = await response.json();
                    setAgentTimeout(config.agent_timeout || 600000);
                }
            } catch (error) {
                console.warn('Failed to fetch config, using default timeout:', error);
            }
        };
        
        fetchConfig();
    }, []);

    useEffect(() => {
        if (!isOpen) {
            shouldConnectRef.current = false;
            if (eventSourceRef.current) {
                eventSourceRef.current.abort();
                eventSourceRef.current = null;
            }
            if (fetchTimeoutRef.current) {
                clearTimeout(fetchTimeoutRef.current);
                fetchTimeoutRef.current = null;
            }
            setOutput('');
            eventProcessor.current.reset();
            setOverallStatus('running');
            setIsConnected(false);
            setIsMinimized(false);
            setCompletedAt(null);
            return;
        }

        if (overallStatus === 'completed' || overallStatus === 'error') {
            return;
        }

        shouldConnectRef.current = true;
        setOutput('');
        eventProcessor.current.reset();
        setOverallStatus('running');
        setIsConnected(false);
        setIsMinimized(false);
        setCompletedAt(null);

        const abortController = new AbortController();
        eventSourceRef.current = abortController;

        fetchTimeoutRef.current = setTimeout(() => {
            abortController.abort();
        }, agentTimeout);

        const startStreaming = async () => {
            try {
                const response = await fetch(url, {
                    method: 'GET',
                    credentials: 'include',
                    signal: abortController.signal,
                    headers: {
                        'Accept': 'text/event-stream',
                        'Cache-Control': 'no-cache',
                    }
                });

                if (!response.ok) {
                    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
                }

                setIsConnected(true);
                
                const reader = response.body?.getReader();
                const decoder = new TextDecoder();

                if (!reader) {
                    throw new Error('Failed to get response reader');
                }

                let buffer = '';

                while (shouldConnectRef.current) {
                    const { done, value } = await reader.read();
                    
                    if (done) {
                        if (updateTimeoutRef.current) {
                            clearTimeout(updateTimeoutRef.current);
                        }
                        if (fetchTimeoutRef.current) {
                            clearTimeout(fetchTimeoutRef.current);
                        }
                        const finalDisplay = eventProcessor.current.getDisplay();
                        setOutput(finalDisplay);
                        
                        setOverallStatus('completed');
                        setCompletedAt(new Date());
                        setIsConnected(false);
                        shouldConnectRef.current = false;
                        onComplete?.(true);
                        break;
                    }

                    buffer += decoder.decode(value, { stream: true });
                    const lines = buffer.split('\n');
                    buffer = lines.pop() || '';

                    for (const line of lines) {
                        if (line.startsWith('data: ')) {
                            try {
                                const eventData = line.substring(6);
                                const event: ComposeEvent = JSON.parse(eventData);
                                eventProcessor.current.processEvent(event);
                            } catch (parseError) {
                                console.warn('Failed to parse event:', line, parseError);
                                eventProcessor.current.processEvent({
                                    type: 'log',
                                    timestamp: new Date().toISOString(),
                                    message: line
                                });
                            }
                        }
                    }
                    
                    if (updateTimeoutRef.current) {
                        clearTimeout(updateTimeoutRef.current);
                    }
                    
                    updateTimeoutRef.current = setTimeout(() => {
                        const currentDisplay = eventProcessor.current.getDisplay();
                        setOutput(currentDisplay);
                    }, 50);
                }

                reader.cancel();
            } catch (error) {
                if (fetchTimeoutRef.current) {
                    clearTimeout(fetchTimeoutRef.current);
                }
                
                if (error instanceof Error && error.name === 'AbortError') {
                    return;
                }
                
                console.error('Streaming error:', error);
                setIsConnected(false);
                shouldConnectRef.current = false;
                
                setOverallStatus('error');
                setCompletedAt(new Date());
                const errorMessage = error instanceof Error ? error.message : 'Unknown error';
                onError?.(`Connection failed: ${errorMessage}`);
                onComplete?.(false);
            }
        };

        startStreaming();

        return () => {
            shouldConnectRef.current = false;
            if (fetchTimeoutRef.current) {
                clearTimeout(fetchTimeoutRef.current);
            }
            abortController.abort();
        };
    }, [url, isOpen, onComplete, onError, agentTimeout]);


    const handleOpenChange = (open: boolean) => {
        if (!open) {
            if (overallStatus === 'running') {
                setIsMinimized(true);
            } else {
                onClose();
            }
        }
    };


    if (!isOpen) return null;

    return (
        <Dialog open={isOpen} onOpenChange={handleOpenChange}>
            <DialogContent className={`max-w-4xl max-h-[85vh] flex flex-col ${isMinimized ? 'h-20' : 'h-[75vh]'}`}>
                <DialogHeader className="flex-shrink-0">
                    <div className="flex items-center justify-between">
                        <DialogTitle className="flex items-center gap-2">
                            {overallStatus === 'completed' && <CheckCircle className="h-5 w-5 text-green-500" />}
                            {overallStatus === 'error' && <XCircle className="h-5 w-5 text-red-500" />}
                            {overallStatus === 'running' && <Activity className="h-5 w-5 text-blue-500 animate-spin" />}
                            {title}
                        </DialogTitle>
                        
                        <div className="flex items-center gap-2">
                            <Badge variant={isConnected ? 'default' : 'destructive'}>
                                {isConnected ? 'Connected' : 'Disconnected'}
                            </Badge>
                            
                            {overallStatus === 'running' && (
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => setIsMinimized(!isMinimized)}
                                >
                                    <Minimize2 className="h-4 w-4" />
                                </Button>
                            )}
                        </div>
                    </div>
                </DialogHeader>
                
                {!isMinimized && (
                    <div className="flex-1 overflow-hidden">
                        <div className="h-full overflow-y-auto pr-2">
                            {output ? (
                                <div className="font-mono text-xs whitespace-pre-wrap break-words bg-gray-900 p-4 rounded text-gray-100">
                                    {output}
                                </div>
                            ) : (
                                <div className="text-center text-gray-500 py-8">
                                    Waiting for operation to start...
                                </div>
                            )}
                            <div ref={outputEndRef} />
                        </div>
                    </div>
                )}
                
                {overallStatus === 'completed' && completedAt && (
                    <div className="flex-shrink-0 pt-2 text-xs text-gray-500 text-center">
                        Operation completed at {completedAt.toLocaleTimeString()}
                    </div>
                )}
            </DialogContent>
        </Dialog>
    );
}