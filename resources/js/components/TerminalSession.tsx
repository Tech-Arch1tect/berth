import React, { useRef, useState, useEffect, useCallback } from 'react';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { RotateCcw, WifiOff } from 'lucide-react';
import TerminalHeader from './terminal/TerminalHeader';
import TerminalDisplay, { type TerminalDisplayRef } from './terminal/TerminalDisplay';
import { useTerminalConnection } from './terminal/useTerminalConnection';

interface TerminalSessionProps {
    serverId: number;
    stackName: string;
    service: string;
    shell?: string;
    onClose: () => void;
    className?: string;
}

const TerminalSession: React.FC<TerminalSessionProps> = ({
    serverId,
    stackName,
    service,
    shell = 'auto',
    onClose,
    className = ''
}) => {
    const terminalDisplayRef = useRef<TerminalDisplayRef>(null);
    const [isMaximized, setIsMaximized] = useState(false);
    
    const connection = useTerminalConnection({
        serverId,
        stackName,
        service,
        shell
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

    const handleTerminalReady = useCallback(async (terminal: Terminal, fitAddon: FitAddon) => {
        await connection.connect(terminal, fitAddon);
    }, [connection]);

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
            <CardContent className="flex-1 p-0 relative overflow-visible" style={{ minHeight: 0 }}>
                <TerminalDisplay ref={terminalDisplayRef} onTerminalReady={handleTerminalReady} />
                
                {/* Loading overlay */}
                {connection.connectionStatus === 'connecting' && (
                    <div className="absolute inset-0 bg-background/80 backdrop-blur-sm flex items-center justify-center">
                        <div className="text-center space-y-3">
                            <div className="w-8 h-8 mx-auto border-2 border-primary border-t-transparent rounded-full animate-spin" />
                            <div className="text-sm text-muted-foreground font-medium">
                                Connecting to {service}...
                            </div>
                        </div>
                    </div>
                )}
                
                {/* Error overlay */}
                {connection.connectionStatus === 'error' && (
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