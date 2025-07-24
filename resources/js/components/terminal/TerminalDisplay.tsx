import React, { useRef, useEffect, forwardRef, useImperativeHandle } from 'react';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import { terminalOptions } from './terminalTheme';
import '@xterm/xterm/css/xterm.css';

export interface TerminalDisplayRef {
    terminal: Terminal | null;
    fitAddon: FitAddon | null;
    fit: () => void;
    dispose: () => void;
    isReady: () => boolean;
}

interface TerminalDisplayProps {
    className?: string;
    onTerminalReady?: (terminal: Terminal, fitAddon: FitAddon) => void;
}

const TerminalDisplay = forwardRef<TerminalDisplayRef, TerminalDisplayProps>(({
    className = '',
    onTerminalReady
}, ref) => {
    const terminalRef = useRef<HTMLDivElement>(null);
    const terminalInstance = useRef<Terminal | null>(null);
    const fitAddon = useRef<FitAddon | null>(null);
    const onTerminalReadyRef = useRef(onTerminalReady);

    useEffect(() => {
        onTerminalReadyRef.current = onTerminalReady;
    }, [onTerminalReady]);

    const fit = () => {
        if (fitAddon.current) {
            fitAddon.current.fit();
        }
    };

    const dispose = () => {
        if (terminalInstance.current) {
            terminalInstance.current.dispose();
            terminalInstance.current = null;
        }
        fitAddon.current = null;
    };

    const isReady = () => {
        return terminalInstance.current !== null && fitAddon.current !== null;
    };

    useEffect(() => {
        const setupTerminal = () => {
            if (!terminalRef.current || terminalInstance.current) return;

            const terminal = new Terminal(terminalOptions);
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
                        (xtermElement as HTMLElement).style.padding = '6px';
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

            setTimeout(() => {
                fitAddonInstance.fit();
            }, 60);

            setTimeout(() => {
                onTerminalReadyRef.current?.(terminal, fitAddonInstance);
            }, 80);
        };

        setupTerminal();
        return dispose;
    }, []);

    useImperativeHandle(ref, () => ({
        terminal: terminalInstance.current,
        fitAddon: fitAddon.current,
        fit,
        dispose,
        isReady
    }));

    return (
        <div className={`flex-1 p-0 relative bg-gradient-to-br from-slate-950 to-slate-900 ${className}`} style={{ minHeight: '350px' }}>
            <div
                ref={terminalRef}
                className="w-full"
                style={{ 
                    minHeight: '350px',
                    background: 'linear-gradient(to bottom right, rgb(2 6 23), rgb(15 23 42))'
                }}
            />
        </div>
    );
});

TerminalDisplay.displayName = 'TerminalDisplay';

export default TerminalDisplay;
