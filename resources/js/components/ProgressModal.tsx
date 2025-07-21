import { useState, useEffect, useRef } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import { CheckCircle, XCircle, Clock, Activity, Terminal, Minimize2 } from 'lucide-react';

export interface ProgressEvent {
    type: 'progress' | 'status' | 'complete' | 'error' | 'connection';
    operation: string;
    stage?: string;
    service?: string;
    message: string;
    progress?: {
        current: number;
        total: number;
    };
    timestamp: string;
    output?: string;
}

interface Props {
    url: string;
    onComplete?: (success: boolean) => void;
    onError?: (error: string) => void;
    title: string;
    isOpen: boolean;
    onClose: () => void;
}

export default function ProgressModal({ url, onComplete, onError, title, isOpen, onClose }: Props) {
    const [events, setEvents] = useState<ProgressEvent[]>([]);
    const [isConnected, setIsConnected] = useState(false);
    const [currentProgress, setCurrentProgress] = useState<{ current: number; total: number } | null>(null);
    const [overallStatus, setOverallStatus] = useState<'running' | 'completed' | 'error'>('running');
    const [isMinimized, setIsMinimized] = useState(false);
    const [completedAt, setCompletedAt] = useState<Date | null>(null);
    const eventSourceRef = useRef<AbortController | null>(null);
    const eventsEndRef = useRef<HTMLDivElement>(null);
    const shouldConnectRef = useRef<boolean>(true);

    useEffect(() => {
        eventsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [events]);

    useEffect(() => {
        if (!isOpen) {
            shouldConnectRef.current = false;
            if (eventSourceRef.current) {
                eventSourceRef.current.abort();
                eventSourceRef.current = null;
            }
            setEvents([]);
            setCurrentProgress(null);
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
        setEvents([]);
        setCurrentProgress(null);
        setOverallStatus('running');
        setIsConnected(false);
        setIsMinimized(false);
        setCompletedAt(null);

        const abortController = new AbortController();
        eventSourceRef.current = abortController;

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
                        break;
                    }

                    buffer += decoder.decode(value, { stream: true });
                    const lines = buffer.split('\n');
                    buffer = lines.pop() || '';

                    for (const line of lines) {
                        if (line.startsWith('data: ')) {
                            const data = line.slice(6).trim();
                            if (data) {
                                try {
                                    const progressEvent: ProgressEvent = JSON.parse(data);
                                    
                                    setEvents(prev => [...prev, progressEvent]);
                                    
                                    if (progressEvent.progress) {
                                        setCurrentProgress(progressEvent.progress);
                                    }
                                    
                                    if (progressEvent.type === 'complete') {
                                        setOverallStatus('completed');
                                        setCompletedAt(new Date());
                                        setIsConnected(false);
                                        shouldConnectRef.current = false;
                                        onComplete?.(true);
                                        reader.cancel();
                                        return;
                                    } else if (progressEvent.type === 'error') {
                                        setOverallStatus('error');
                                        setCompletedAt(new Date());
                                        setIsConnected(false);
                                        shouldConnectRef.current = false;
                                        onError?.(progressEvent.message);
                                        onComplete?.(false);
                                        reader.cancel();
                                        return;
                                    }
                                } catch (err) {
                                    console.error('Failed to parse progress event:', err);
                                }
                            }
                        }
                    }
                }

                reader.cancel();
            } catch (error) {
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
            abortController.abort();
        };
    }, [url, isOpen, onComplete, onError]);

    const getStatusIcon = (event: ProgressEvent) => {
        switch (event.type) {
            case 'complete':
                return <CheckCircle className="h-4 w-4 text-green-500" />;
            case 'error':
                return <XCircle className="h-4 w-4 text-red-500" />;
            case 'progress':
                return <Activity className="h-4 w-4 text-blue-500" />;
            case 'connection':
                return <Terminal className="h-4 w-4 text-gray-500" />;
            default:
                return <Clock className="h-4 w-4 text-yellow-500" />;
        }
    };

    const getStageColor = (stage?: string) => {
        switch (stage) {
            case 'pulling':
                return 'bg-blue-100 text-blue-800';
            case 'creating':
                return 'bg-yellow-100 text-yellow-800';
            case 'starting':
                return 'bg-green-100 text-green-800';
            case 'removing':
                return 'bg-red-100 text-red-800';
            case 'completed':
                return 'bg-green-100 text-green-800';
            case 'error':
                return 'bg-red-100 text-red-800';
            default:
                return 'bg-gray-100 text-gray-800';
        }
    };

    const progressPercentage = currentProgress 
        ? Math.round((currentProgress.current / currentProgress.total) * 100)
        : 0;

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
                    
                    {!isMinimized && currentProgress && (
                        <div className="space-y-2 pt-2">
                            <div className="flex justify-between text-sm">
                                <span>Progress</span>
                                <span>{currentProgress.current}/{currentProgress.total} ({progressPercentage}%)</span>
                            </div>
                            <Progress value={progressPercentage} className="h-2" />
                        </div>
                    )}
                </DialogHeader>
                
                {!isMinimized && (
                    <div className="flex-1 overflow-hidden">
                        <div className="h-full overflow-y-auto space-y-2 pr-2">
                            {events.map((event, index) => (
                                <div key={index} className="flex items-start gap-3 text-sm">
                                    {getStatusIcon(event)}
                                    
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2 flex-wrap">
                                            {event.stage && (
                                                <Badge variant="outline" className={`text-xs ${getStageColor(event.stage)}`}>
                                                    {event.stage}
                                                </Badge>
                                            )}
                                            {event.service && (
                                                <Badge variant="outline" className="text-xs bg-blue-50 text-blue-700">
                                                    {event.service}
                                                </Badge>
                                            )}
                                            <span className="text-xs text-gray-500">
                                                {event.timestamp ? new Date(event.timestamp).toLocaleTimeString() : 'N/A'}
                                            </span>
                                        </div>
                                        
                                        <p className="mt-1 font-mono text-xs break-all">
                                            {event.message}
                                        </p>
                                        
                                        {event.output && event.output !== event.message && (
                                            <pre className="mt-1 text-xs bg-gray-50 p-2 rounded overflow-x-auto">
                                                {event.output}
                                            </pre>
                                        )}
                                    </div>
                                </div>
                            ))}
                            
                            {events.length === 0 && (
                                <div className="text-center text-gray-500 py-8">
                                    Waiting for operation to start...
                                </div>
                            )}
                            <div ref={eventsEndRef} />
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