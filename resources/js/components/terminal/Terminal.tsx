import React, { useEffect, useRef, useCallback, useState } from 'react';
import { Terminal as XTerm } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import { WebLinksAddon } from '@xterm/addon-web-links';
import { useTerminal } from '../../hooks/useTerminal';
import toast from 'react-hot-toast';
import '@xterm/xterm/css/xterm.css';

interface TerminalProps {
  serverId: number;
  stackName: string;
  serviceName: string;
  containerName?: string;
  className?: string;
}

export const Terminal: React.FC<TerminalProps> = ({
  serverId,
  stackName,
  serviceName,
  containerName,
  className = '',
}) => {
  const terminalRef = useRef<HTMLDivElement>(null);
  const xtermRef = useRef<XTerm | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const sendInputRef = useRef<(input: string | Uint8Array) => boolean>(() => false);
  const resizeTerminalRef = useRef<(cols: number, rows: number) => boolean>(() => false);
  const closeTerminalRef = useRef<() => void>(() => {});
  const [isInitialised, setIsInitialised] = useState(false);

  const handleOutput = useCallback((data: Uint8Array) => {
    if (xtermRef.current) {
      const text = new TextDecoder().decode(data);
      xtermRef.current.write(text);
    }
  }, []);

  const handleConnect = useCallback(
    (sessionId: string) => {
      toast.success(`Terminal session started: ${sessionId.substring(0, 8)}...`);
      if (xtermRef.current) {
        xtermRef.current.clear();
        xtermRef.current.writeln(
          `\x1b[32m✓ Connected to ${serviceName}${containerName ? `:${containerName}` : ''}\x1b[0m`
        );
      }
    },
    [serviceName, containerName]
  );

  const handleDisconnect = useCallback((exitCode?: number) => {
    const message =
      exitCode !== undefined
        ? `Terminal session ended (exit code: ${exitCode})`
        : 'Terminal session disconnected';

    toast.error(message);

    if (xtermRef.current) {
      xtermRef.current.writeln(`\x1b[31m✗ ${message}\x1b[0m`);
    }
  }, []);

  const handleError = useCallback((error: string) => {
    toast.error(`Terminal error: ${error}`);
    if (xtermRef.current) {
      xtermRef.current.writeln(`\x1b[31mError: ${error}\x1b[0m`);
    }
  }, []);

  const { session, sendInput, resizeTerminal, closeTerminal, connectionStatus } = useTerminal({
    serverId,
    stackName,
    serviceName,
    containerName,
    enabled: true,
    onOutput: handleOutput,
    onConnect: handleConnect,
    onDisconnect: handleDisconnect,
    onError: handleError,
  });

  const sessionRef = useRef(session);

  sendInputRef.current = sendInput;
  resizeTerminalRef.current = resizeTerminal;
  closeTerminalRef.current = closeTerminal;
  sessionRef.current = session;

  const handleResize = useCallback(() => {
    if (fitAddonRef.current && xtermRef.current) {
      try {
        fitAddonRef.current.fit();
        const dims = fitAddonRef.current.proposeDimensions();
        if (dims) {
          resizeTerminalRef.current?.(dims.cols, dims.rows);
        }
      } catch {
        // Ignore errors
      }
    }
  }, []);

  useEffect(() => {
    if (!terminalRef.current || isInitialised) return;

    const containerElement = terminalRef.current;
    if (!containerElement.offsetParent) {
      return;
    }

    const terminal = new XTerm({
      cursorBlink: true,
      fontFamily: 'Menlo, Monaco, "Courier New", monospace',
      fontSize: 14,
      lineHeight: 1.2,
      theme: {
        background: '#1a1a1a',
        foreground: '#ffffff',
        cursor: '#ffffff',
        selectionBackground: '#444444',
      },
      scrollback: 1000,
    });

    const fitAddon = new FitAddon();
    const webLinksAddon = new WebLinksAddon();

    terminal.loadAddon(fitAddon);
    terminal.loadAddon(webLinksAddon);

    try {
      terminal.open(containerElement);

      terminal.onData((data) => {
        sendInputRef.current?.(data);
      });

      terminal.onResize((size) => {
        resizeTerminalRef.current?.(size.cols, size.rows);
      });

      xtermRef.current = terminal;
      fitAddonRef.current = fitAddon;

      setTimeout(() => {
        if (xtermRef.current && fitAddonRef.current) {
          try {
            fitAddonRef.current.fit();
          } catch {
            // Ignore errors
          }
        }
      }, 100);

      setIsInitialised(true);
    } catch {
      terminal.dispose();
    }

    return () => {
      if (xtermRef.current) {
        xtermRef.current.dispose();
        xtermRef.current = null;
      }
      fitAddonRef.current = null;
      setIsInitialised(false);
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const handleWindowResize = () => {
      setTimeout(handleResize, 100);
    };

    window.addEventListener('resize', handleWindowResize);
    return () => window.removeEventListener('resize', handleWindowResize);
  }, [handleResize]);

  useEffect(() => {
    return () => {
      if (sessionRef.current.isConnected) {
        closeTerminalRef.current?.();
      }
    };
  }, []);

  const getStatusColor = () => {
    switch (connectionStatus) {
      case 'connected':
        return session.isConnected ? 'text-green-500' : 'text-yellow-500';
      case 'connecting':
        return 'text-yellow-500';
      case 'error':
        return 'text-red-500';
      default:
        return 'text-gray-500';
    }
  };

  const getStatusText = () => {
    if (connectionStatus === 'connected' && session.isConnected) {
      return 'Connected';
    }
    switch (connectionStatus) {
      case 'connecting':
        return session.isConnecting ? 'Starting session...' : 'Connecting...';
      case 'connected':
        return 'Starting session...';
      case 'error':
        return session.error || 'Connection error';
      default:
        return 'Disconnected';
    }
  };

  return (
    <div className={`flex flex-col h-full bg-gray-900 rounded-lg overflow-hidden ${className}`}>
      <div className="flex items-center justify-between px-4 py-2 bg-gray-800 border-b border-gray-700">
        <div className="flex items-center space-x-2">
          <div className="flex items-center space-x-2">
            <div className={`w-2 h-2 rounded-full ${getStatusColor()}`} />
            <span className="text-sm font-medium text-gray-200">
              {serviceName}
              {containerName && <span className="text-gray-400">:{containerName}</span>}
            </span>
          </div>
        </div>
        <div className="flex items-center space-x-2">
          <span className={`text-xs ${getStatusColor()}`}>{getStatusText()}</span>
          {session.isConnected && (
            <button
              onClick={closeTerminal}
              className="text-xs px-2 py-1 rounded bg-red-600 hover:bg-red-700 text-white transition-colors"
            >
              Disconnect
            </button>
          )}
        </div>
      </div>

      <div className="flex-1 p-2">
        <div ref={terminalRef} className="w-full h-full" style={{ minHeight: '400px' }} />
      </div>
    </div>
  );
};
