import React, { useEffect, useRef, useCallback, useState } from 'react';
import { Terminal as XTerm } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import { WebLinksAddon } from '@xterm/addon-web-links';
import { useTerminal } from '../../hooks/useTerminal';
import toast from 'react-hot-toast';
import '@xterm/xterm/css/xterm.css';
import { cn } from '../../utils/cn';
import { theme } from '../../theme';

interface TerminalProps {
  serverid: number;
  stackname: string;
  serviceName: string;
  containerName?: string;
  className?: string;
}

export const Terminal: React.FC<TerminalProps> = ({
  serverid,
  stackname,
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

  const handleResize = useCallback(() => {
    if (fitAddonRef.current && xtermRef.current) {
      try {
        fitAddonRef.current.fit();
        const dims = fitAddonRef.current.proposeDimensions();
        if (dims) {
          resizeTerminalRef.current?.(dims.cols, dims.rows);
        }
      } catch {}
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
      setTimeout(handleResize, 100);
    },
    [serviceName, containerName, handleResize]
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
    serverid,
    stackname,
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
          } catch {}
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
    if (!terminalRef.current || !isInitialised) return;

    const resizeObserver = new ResizeObserver(() => {
      setTimeout(handleResize, 50);
    });

    resizeObserver.observe(terminalRef.current);

    return () => {
      resizeObserver.disconnect();
    };
  }, [isInitialised, handleResize]);

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
        return session.isConnected ? theme.text.success : theme.text.warning;
      case 'connecting':
        return theme.text.warning;
      case 'error':
        return theme.text.danger;
      default:
        return theme.text.muted;
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
    <div className={`flex flex-col h-full bg-slate-900 rounded-lg overflow-hidden ${className}`}>
      <div className="flex items-center justify-between px-4 py-2 bg-slate-800 border-b border-slate-700">
        <div className="flex items-center space-x-2">
          <div className="flex items-center space-x-2">
            <div className={cn('w-2 h-2 rounded-full', getStatusColor())} />
            <span className={cn('text-sm font-medium', theme.text.standard)}>
              {serviceName}
              {containerName && <span className={theme.text.muted}>:{containerName}</span>}
            </span>
          </div>
        </div>
        <div className="flex items-center space-x-2">
          <span className={cn('text-xs', getStatusColor())}>{getStatusText()}</span>
          {session.isConnected && (
            <button
              onClick={closeTerminal}
              className={cn('text-xs px-2 py-1 rounded transition-colors', theme.buttons.danger)}
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
