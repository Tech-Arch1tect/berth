import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { FitAddon } from '@xterm/addon-fit';
import { Terminal } from '@xterm/xterm';
import { RotateCcw, WifiOff } from 'lucide-react';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import TerminalDisplay, { type TerminalDisplayRef } from './terminal/TerminalDisplay';
import TerminalHeader from './terminal/TerminalHeader';
import { useTerminalConnection } from './terminal/useTerminalConnection';

interface TerminalSessionProps {
    serverId: number;
    stackName: string;
    service: string;
    shell?: string;
    onClose: () => void;
    className?: string;
}

const TerminalSession: React.FC<TerminalSessionProps> = ({ serverId, stackName, service, shell = 'auto', onClose, className = '' }) => {
    const terminalDisplayRef = useRef<TerminalDisplayRef>(null);
    const [isMaximized, setIsMaximized] = useState(false);

    const connection = useTerminalConnection({
        serverId,
        stackName,
        service,
        shell,
    });

    const handleResize = () => {
        terminalDisplayRef.current?.fit();
    };

    const handleReconnect = async () => {
        const terminal = terminalDisplayRef.current?.terminal;
        const fitAddon = terminalDisplayRef.current?.fitAddon;
        if (terminal && fitAddon) {
            await connection.reconnect(terminal, fitAddon);
        }
    };

    const handleClose = () => {
        connection.close();
        onClose();
    };

    const toggleMaximize = () => {
        setIsMaximized(!isMaximized);
        setTimeout(handleResize, 100);
    };

    useEffect(() => {
        const handleWindowResize = () => {
            handleResize();
        };

        window.addEventListener('resize', handleWindowResize);
        return () => window.removeEventListener('resize', handleWindowResize);
    }, []);

    const handleTerminalReady = useCallback(
        async (terminal: Terminal, fitAddon: FitAddon) => {
            await connection.connect(terminal, fitAddon);
        },
        [connection],
    );

    return (
        <Card className={`${className} ${isMaximized ? 'fixed inset-4 z-50 shadow-2xl' : 'min-h-[400px]'} flex flex-col border-border/20`}>
            <CardHeader className="p-0">
                <TerminalHeader
                    service={service}
                    connectionStatus={connection.connectionStatus}
                    connectionInfo={connection.connectionInfo}
                    isMaximized={isMaximized}
                    onReconnect={handleReconnect}
                    onToggleMaximize={toggleMaximize}
                    onClose={handleClose}
                />
            </CardHeader>
            <CardContent className="relative flex-1 overflow-visible p-0" style={{ minHeight: 0 }}>
                <TerminalDisplay ref={terminalDisplayRef} onTerminalReady={handleTerminalReady} />

                {/* Loading overlay */}
                {connection.connectionStatus === 'connecting' && (
                    <div className="absolute inset-0 flex items-center justify-center bg-background/80 backdrop-blur-sm">
                        <div className="space-y-3 text-center">
                            <div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                            <div className="text-sm font-medium text-muted-foreground">Connecting to {service}...</div>
                        </div>
                    </div>
                )}

                {/* Error overlay */}
                {connection.connectionStatus === 'error' && (
                    <div className="absolute inset-0 flex items-center justify-center bg-background/90 backdrop-blur-sm">
                        <div className="space-y-4 p-6 text-center">
                            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10">
                                <WifiOff className="h-6 w-6 text-destructive" />
                            </div>
                            <div>
                                <div className="mb-1 text-sm font-medium text-destructive">Connection Failed</div>
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
