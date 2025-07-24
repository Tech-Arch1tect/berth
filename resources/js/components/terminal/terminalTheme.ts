import { ITerminalOptions } from '@xterm/xterm';

export const terminalTheme: ITerminalOptions['theme'] = {
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
    brightWhite: 'hsl(var(--foreground))',
};

export const terminalOptions: ITerminalOptions = {
    fontFamily: 'Consolas, "Liberation Mono", Menlo, Courier, monospace',
    fontSize: 12,
    lineHeight: 1.2,
    theme: terminalTheme,
    allowTransparency: true,
    cursorBlink: true,
    scrollback: 2000,
    smoothScrollDuration: 100,
    allowProposedApi: true,
    convertEol: true,
    windowsMode: false,
};
