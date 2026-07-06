export interface TerminalKey {
  label: string;
  sequence: string;
  ariaLabel: string;
}

export const TERMINAL_KEYS: TerminalKey[] = [
  { label: 'Esc', sequence: '\x1b', ariaLabel: 'Escape' },
  { label: 'Tab', sequence: '\t', ariaLabel: 'Tab' },
  { label: '↑', sequence: '\x1b[A', ariaLabel: 'Arrow up' },
  { label: '↓', sequence: '\x1b[B', ariaLabel: 'Arrow down' },
  { label: '←', sequence: '\x1b[D', ariaLabel: 'Arrow left' },
  { label: '→', sequence: '\x1b[C', ariaLabel: 'Arrow right' },
  { label: '^C', sequence: '\x03', ariaLabel: 'Control C' },
  { label: '^D', sequence: '\x04', ariaLabel: 'Control D' },
  { label: '|', sequence: '|', ariaLabel: 'Pipe' },
  { label: '-', sequence: '-', ariaLabel: 'Dash' },
  { label: '/', sequence: '/', ariaLabel: 'Slash' },
  { label: '~', sequence: '~', ariaLabel: 'Tilde' },
];

export function controlSequence(char: string): string | null {
  if (char.length !== 1) return null;
  const code = char.toUpperCase().charCodeAt(0);
  if (code < 64 || code > 95) return null;
  return String.fromCharCode(code - 64);
}

export function applyStickyCtrl(
  data: string,
  armed: boolean
): { output: string; consumed: boolean } {
  if (!armed) return { output: data, consumed: false };
  const ctrl = controlSequence(data);
  if (ctrl === null) return { output: data, consumed: true };
  return { output: ctrl, consumed: true };
}
