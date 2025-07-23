import React, { useEffect, useRef, useState } from 'react';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { X, Maximize2, Minimize2, RotateCcw, Terminal as TerminalIcon, Activity, WifiOff } from 'lucide-react';
import '@xterm/xterm/css/xterm.css';

interface TerminalSessionProps {
    serverId: number;
    stackName: string;
    service: string;
    shell?: string;
    onClose: () => void;
    className?: string;
}

interface TerminalMessage {
    type: 'input' | 'resize' | 'close';
    data?: string;
    cols?: number;
    rows?: number;
}

interface TerminalConnectionInfo {
    websocket_url: string;
    access_token: string;
    stack_name: string;
    service: string;
    server_name: string;
    shell: string;
}

const TerminalSession: React.FC<TerminalSessionProps> = ({
    serverId,
    stackName,
    service,
    shell = 'auto',
    onClose,
    className = ''
}) => {
    const terminalRef = useRef<HTMLDivElement>(null);
    const terminalInstance = useRef<Terminal | null>(null);
    const fitAddon = useRef<FitAddon | null>(null);
    const websocket = useRef<WebSocket | null>(null);
    const [connectionStatus, setConnectionStatus] = useState<'connecting' | 'connected' | 'disconnected' | 'error'>('connecting');
    const [isMaximized, setIsMaximized] = useState(false);
    const [connectionInfo, setConnectionInfo] = useState<TerminalConnectionInfo | null>(null);

    const initializeTerminalSession = async () => {
        try {
            const url = new URL(`/api/servers/${serverId}/stacks/${stackName}/terminal/${service}`, window.location.origin);
            url.searchParams.set('shell', shell);
            
            const response = await fetch(url.toString(), {
                method: 'GET',
                headers: {
                    'Accept': 'application/json',
                    'X-CSRF-TOKEN': document.querySelector('meta[name="csrf-token"]')?.getAttribute('content') || '',
                },
            });

            if (!response.ok) {
                throw new Error(`Failed to get terminal connection info: ${response.status}`);
            }

            const data: TerminalConnectionInfo = await response.json();
            setConnectionInfo(data);
            return data;
        } catch (error) {
            console.error('Failed to initialize terminal session:', error);
            setConnectionStatus('error');
            throw error;
        }
    };

    const setupTerminal = () => {
        if (!terminalRef.current) return;

        const terminal = new Terminal({
            fontFamily: 'Consolas, "Liberation Mono", Menlo, Courier, monospace',
            fontSize: 13,
            lineHeight: 1.4,
            theme: {
                background: 'transparent',
                foreground: 'hsl(var(--foreground))',
                cursor: 'hsl(var(--primary))',
                cursorAccent: 'hsl(var(--primary-foreground))',
                black: 'hsl(var(--muted))',
                red: 'hsl(var(--destructive))',
                green: '#22c55e',
                yellow: '#eab308',
                blue: 'hsl(var(--primary))',
                magenta: '#a855f7',
                cyan: '#06b6d4',
                white: 'hsl(var(--muted-foreground))',
                brightBlack: 'hsl(var(--border))',
                brightRed: '#ef4444',
                brightGreen: '#16a34a',
                brightYellow: '#ca8a04',
                brightBlue: 'hsl(var(--primary))',
                brightMagenta: '#9333ea',
                brightCyan: '#0891b2',
                brightWhite: 'hsl(var(--foreground))'
            },
            allowTransparency: true,
            cursorBlink: true,
            scrollback: 2000,
            smoothScrollDuration: 100,
        });

        const fitAddonInstance = new FitAddon();
        terminal.loadAddon(fitAddonInstance);

        terminal.open(terminalRef.current);
        fitAddonInstance.fit();

        setTimeout(() => {
            if (terminalRef.current) {
                const xtermElement = terminalRef.current.querySelector('.xterm');
                const xtermViewport = terminalRef.current.querySelector('.xterm-viewport');
                const xtermScreen = terminalRef.current.querySelector('.xterm-screen');
                const xtermHelpers = terminalRef.current.querySelector('.xterm-helpers');
                
                if (xtermElement) {
                    (xtermElement as HTMLElement).style.padding = '8px';
                    (xtermElement as HTMLElement).style.background = 'transparent';
                }
                if (xtermViewport) {
                    (xtermViewport as HTMLElement).style.background = 'transparent';
                }
                if (xtermScreen) {
                    (xtermScreen as HTMLElement).style.background = 'transparent';
                }
                if (xtermHelpers) {
                    (xtermHelpers as HTMLElement).style.background = 'transparent';
                }
            }
        }, 50);

        terminalInstance.current = terminal;
        fitAddon.current = fitAddonInstance;

        return { terminal, fitAddonInstance };
    };

    const connectWebSocket = (connectionInfo: TerminalConnectionInfo, terminal: Terminal, fitAddonInstance: FitAddon) => {
        const url = new URL(connectionInfo.websocket_url);
        url.searchParams.set('token', connectionInfo.access_token);
        
        const ws = new WebSocket(url.toString());

        ws.onopen = () => {
            console.log('Terminal WebSocket connected');
            setConnectionStatus('connected');
            
            const { cols, rows } = terminal;
            sendMessage({ type: 'resize', cols, rows });
            
            terminal.onData((data) => {
                sendMessage({ type: 'input', data });
            });

            terminal.onResize(({ cols, rows }) => {
                sendMessage({ type: 'resize', cols, rows });
            });
        };

        ws.onmessage = (event) => {
            terminal.write(event.data);
        };

        ws.onclose = () => {
            console.log('Terminal WebSocket disconnected');
            setConnectionStatus('disconnected');
        };

        ws.onerror = (error) => {
            console.error('Terminal WebSocket error:', error);
            setConnectionStatus('error');
        };

        websocket.current = ws;

        const sendMessage = (message: TerminalMessage) => {
            if (ws.readyState === WebSocket.OPEN) {
                ws.send(JSON.stringify(message));
            }
        };
    };

    const handleResize = () => {
        if (fitAddon.current) {
            fitAddon.current.fit();
        }
    };

    const handleReconnect = async () => {
        setConnectionStatus('connecting');
        cleanup();
        
        try {
            const info = await initializeTerminalSession();
            const setupResult = setupTerminal();
            if (setupResult) {
                const { terminal, fitAddonInstance } = setupResult;
                connectWebSocket(info, terminal, fitAddonInstance);
            }
        } catch (error) {
            console.error('Failed to reconnect:', error);
        }
    };

    const cleanup = () => {
        if (websocket.current) {
            websocket.current.close();
            websocket.current = null;
        }
        if (terminalInstance.current) {
            terminalInstance.current.dispose();
            terminalInstance.current = null;
        }
        fitAddon.current = null;
    };

    useEffect(() => {
        const handleWindowResize = () => {
            handleResize();
        };

        window.addEventListener('resize', handleWindowResize);
        return () => window.removeEventListener('resize', handleWindowResize);
    }, []);

    useEffect(() => {
        const initialize = async () => {
            try {
                const info = await initializeTerminalSession();
                const setupResult = setupTerminal();
                if (setupResult) {
                    const { terminal, fitAddonInstance } = setupResult;
                    connectWebSocket(info, terminal, fitAddonInstance);
                }
            } catch (error) {
                console.error('Failed to initialize terminal:', error);
            }
        };

        initialize();

        return cleanup;
    }, [serverId, stackName, service, shell]);

    const handleClose = () => {
        if (websocket.current && websocket.current.readyState === WebSocket.OPEN) {
            websocket.current.send(JSON.stringify({ type: 'close' }));
        }
        cleanup();
        onClose();
    };

    const toggleMaximize = () => {
        setIsMaximized(!isMaximized);
        setTimeout(handleResize, 100);
    };

    const getStatusColor = (status: typeof connectionStatus) => {
        switch (status) {
            case 'connected': return 'bg-green-500';
            case 'connecting': return 'bg-yellow-500';
            case 'disconnected': return 'bg-gray-500';
            case 'error': return 'bg-red-500';
            default: return 'bg-gray-500';
        }
    };

    const getStatusText = (status: typeof connectionStatus) => {
        switch (status) {
            case 'connected': return 'Connected';
            case 'connecting': return 'Connecting...';
            case 'disconnected': return 'Disconnected';
            case 'error': return 'Connection Error';
            default: return 'Unknown';
        }
    };

    return (
        <Card className={`${className} ${isMaximized ? 'fixed inset-4 z-50 shadow-2xl' : 'h-[400px]'} flex flex-col border-border/20`}>
            <CardHeader className="flex-none py-3 px-4 border-b border-border/20 bg-gradient-to-r from-background/50 to-muted/20">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        {/* Mock terminal header with traffic lights */}
                        <div className="flex items-center gap-1.5">
                            <div className="w-3 h-3 rounded-full bg-red-500/80"></div>
                            <div className="w-3 h-3 rounded-full bg-yellow-500/80"></div>
                            <div className="w-3 h-3 rounded-full bg-green-500/80"></div>
                        </div>
                        <div className="flex items-center gap-2">
                            <TerminalIcon className="h-4 w-4 text-muted-foreground" />
                            <span className="text-sm font-medium font-mono">
                                {service}
                            </span>
                            {connectionInfo && connectionInfo.shell !== 'auto' && (
                                <span className="text-xs text-muted-foreground/70 font-mono bg-muted/50 px-1.5 py-0.5 rounded">
                                    {connectionInfo.shell}
                                </span>
                            )}
                        </div>
                        <Badge 
                            variant={connectionStatus === 'connected' ? 'default' : 
                                    connectionStatus === 'error' ? 'destructive' : 'secondary'}
                            className="text-xs flex items-center gap-1 px-2 py-0.5"
                        >
                            {connectionStatus === 'connected' ? (
                                <Activity className="h-2.5 w-2.5" />
                            ) : connectionStatus === 'error' ? (
                                <WifiOff className="h-2.5 w-2.5" />
                            ) : (
                                <div className="w-2.5 h-2.5 rounded-full border-2 border-current border-t-transparent animate-spin" />
                            )}
                            {getStatusText(connectionStatus)}
                        </Badge>
                        {connectionInfo && (
                            <span className="text-xs text-muted-foreground/70 font-mono">
                                {connectionInfo.server_name}
                            </span>
                        )}
                    </div>
                    <div className="flex items-center gap-1">
                        {connectionStatus === 'disconnected' || connectionStatus === 'error' ? (
                            <Button
                                onClick={handleReconnect}
                                size="sm"
                                variant="ghost"
                                className="h-7 w-7 p-0 hover:bg-accent"
                            >
                                <RotateCcw className="h-3 w-3" />
                            </Button>
                        ) : null}
                        <Button
                            onClick={toggleMaximize}
                            size="sm"
                            variant="ghost"
                            className="h-7 w-7 p-0 hover:bg-accent"
                        >
                            {isMaximized ? (
                                <Minimize2 className="h-3 w-3" />
                            ) : (
                                <Maximize2 className="h-3 w-3" />
                            )}
                        </Button>
                        <Button
                            onClick={handleClose}
                            size="sm"
                            variant="ghost"
                            className="h-7 w-7 p-0 hover:bg-destructive/10 hover:text-destructive"
                        >
                            <X className="h-3 w-3" />
                        </Button>
                    </div>
                </div>
            </CardHeader>
            <CardContent className="flex-1 p-0 relative overflow-hidden bg-gradient-to-br from-slate-950 to-slate-900">
                <div
                    ref={terminalRef}
                    className="h-full w-full"
                    style={{ 
                        height: '100%',
                        background: 'linear-gradient(to bottom right, rgb(2 6 23), rgb(15 23 42))'
                    }}
                />
                {connectionStatus === 'connecting' && (
                    <div className="absolute inset-0 bg-background/80 backdrop-blur-sm flex items-center justify-center">
                        <div className="text-center space-y-3">
                            <div className="w-8 h-8 mx-auto border-2 border-primary border-t-transparent rounded-full animate-spin" />
                            <div className="text-sm text-muted-foreground font-medium">
                                Connecting to {service}...
                            </div>
                        </div>
                    </div>
                )}
                {connectionStatus === 'error' && (
                    <div className="absolute inset-0 bg-background/90 backdrop-blur-sm flex items-center justify-center">
                        <div className="text-center space-y-4 p-6">
                            <div className="w-12 h-12 mx-auto rounded-full bg-destructive/10 flex items-center justify-center">
                                <WifiOff className="h-6 w-6 text-destructive" />
                            </div>
                            <div>
                                <div className="text-sm font-medium text-destructive mb-1">Connection Failed</div>
                                <div className="text-xs text-muted-foreground">Unable to connect to {service}</div>
                            </div>
                            <Button onClick={handleReconnect} size="sm" variant="outline" className="gap-2">
                                <RotateCcw className="h-3 w-3" />
                                Retry Connection
                            </Button>
                        </div>
                    </div>
                )}
            </CardContent>
        </Card>
    );
};

export default TerminalSession;