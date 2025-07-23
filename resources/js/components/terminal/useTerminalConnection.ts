import { useState, useRef, useEffect, useCallback } from 'react';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import type { ConnectionStatus } from './TerminalHeader';

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

interface UseTerminalConnectionParams {
    serverId: number;
    stackName: string;
    service: string;
    shell: string;
}

export const useTerminalConnection = ({
    serverId,
    stackName,
    service,
    shell
}: UseTerminalConnectionParams) => {
    const websocket = useRef<WebSocket | null>(null);
    const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>('connecting');
    const [connectionInfo, setConnectionInfo] = useState<TerminalConnectionInfo | null>(null);
    const hasInitializedRef = useRef(false);

    const initializeTerminalSession = useCallback(async () => {
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
    }, [serverId, stackName, service, shell]);

    const connectWebSocket = useCallback((connectionInfo: TerminalConnectionInfo, terminal: Terminal, fitAddon: FitAddon) => {
        const url = new URL(connectionInfo.websocket_url);
        url.searchParams.set('token', connectionInfo.access_token);
        
        const ws = new WebSocket(url.toString());

        ws.onopen = () => {
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
    }, []);

    const connect = useCallback(async (terminal: Terminal, fitAddon: FitAddon) => {
        try {
            const info = await initializeTerminalSession();
            connectWebSocket(info, terminal, fitAddon);
        } catch (error) {
            console.error('Failed to connect terminal:', error);
        }
    }, [initializeTerminalSession, connectWebSocket]);

    const reconnect = useCallback(async (terminal: Terminal, fitAddon: FitAddon) => {
        setConnectionStatus('connecting');
        disconnect();
        await connect(terminal, fitAddon);
    }, [connect]);

    const disconnect = useCallback(() => {
        if (websocket.current) {
            websocket.current.close();
            websocket.current = null;
        }
    }, []);

    const close = useCallback(() => {
        if (websocket.current && websocket.current.readyState === WebSocket.OPEN) {
            websocket.current.send(JSON.stringify({ type: 'close' }));
        }
        disconnect();
    }, [disconnect]);

    useEffect(() => {
        return disconnect;
    }, [disconnect]);

    return {
        connectionStatus,
        connectionInfo,
        connect,
        reconnect,
        disconnect,
        close
    };
};