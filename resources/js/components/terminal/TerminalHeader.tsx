import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Activity, Maximize2, Minimize2, RotateCcw, Terminal as TerminalIcon, WifiOff, X } from 'lucide-react';
import React from 'react';

export type ConnectionStatus = 'connecting' | 'connected' | 'disconnected' | 'error';

interface TerminalConnectionInfo {
    websocket_url: string;
    access_token: string;
    stack_name: string;
    service: string;
    server_name: string;
    shell: string;
}

interface TerminalHeaderProps {
    service: string;
    connectionStatus: ConnectionStatus;
    connectionInfo: TerminalConnectionInfo | null;
    isMaximized: boolean;
    onReconnect: () => void;
    onToggleMaximize: () => void;
    onClose: () => void;
}

const TerminalHeader: React.FC<TerminalHeaderProps> = ({
    service,
    connectionStatus,
    connectionInfo,
    isMaximized,
    onReconnect,
    onToggleMaximize,
    onClose,
}) => {
    const getStatusText = (status: ConnectionStatus) => {
        switch (status) {
            case 'connected':
                return 'Connected';
            case 'connecting':
                return 'Connecting...';
            case 'disconnected':
                return 'Disconnected';
            case 'error':
                return 'Connection Error';
            default:
                return 'Unknown';
        }
    };

    return (
        <div className="flex-none border-b border-border/20 bg-gradient-to-r from-background/50 to-muted/20 px-4 py-3">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <div className="flex items-center gap-1.5">
                        <div className="h-3 w-3 rounded-full bg-red-500/80"></div>
                        <div className="h-3 w-3 rounded-full bg-yellow-500/80"></div>
                        <div className="h-3 w-3 rounded-full bg-green-500/80"></div>
                    </div>
                    <div className="flex items-center gap-2">
                        <TerminalIcon className="h-4 w-4 text-muted-foreground" />
                        <span className="font-mono text-sm font-medium">{service}</span>
                        {connectionInfo && connectionInfo.shell !== 'auto' && (
                            <span className="rounded bg-muted/50 px-1.5 py-0.5 font-mono text-xs text-muted-foreground/70">
                                {connectionInfo.shell}
                            </span>
                        )}
                    </div>
                    <Badge
                        variant={connectionStatus === 'connected' ? 'default' : connectionStatus === 'error' ? 'destructive' : 'secondary'}
                        className="flex items-center gap-1 px-2 py-0.5 text-xs"
                    >
                        {connectionStatus === 'connected' ? (
                            <Activity className="h-2.5 w-2.5" />
                        ) : connectionStatus === 'error' ? (
                            <WifiOff className="h-2.5 w-2.5" />
                        ) : (
                            <div className="h-2.5 w-2.5 animate-spin rounded-full border-2 border-current border-t-transparent" />
                        )}
                        {getStatusText(connectionStatus)}
                    </Badge>
                    {connectionInfo && <span className="font-mono text-xs text-muted-foreground/70">{connectionInfo.server_name}</span>}
                </div>
                <div className="flex items-center gap-1">
                    {(connectionStatus === 'disconnected' || connectionStatus === 'error') && (
                        <Button onClick={onReconnect} size="sm" variant="ghost" className="h-7 w-7 p-0 hover:bg-accent">
                            <RotateCcw className="h-3 w-3" />
                        </Button>
                    )}
                    <Button onClick={onToggleMaximize} size="sm" variant="ghost" className="h-7 w-7 p-0 hover:bg-accent">
                        {isMaximized ? <Minimize2 className="h-3 w-3" /> : <Maximize2 className="h-3 w-3" />}
                    </Button>
                    <Button onClick={onClose} size="sm" variant="ghost" className="h-7 w-7 p-0 hover:bg-destructive/10 hover:text-destructive">
                        <X className="h-3 w-3" />
                    </Button>
                </div>
            </div>
        </div>
    );
};

export default TerminalHeader;
