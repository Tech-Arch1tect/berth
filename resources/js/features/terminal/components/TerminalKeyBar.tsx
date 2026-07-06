import React from 'react';
import { cn } from '../../../shared/utils/cn';
import { theme } from '../../../shared/theme';
import { TERMINAL_KEYS } from '../utils/keySequences';

interface TerminalKeyBarProps {
  onSend: (sequence: string) => void;
  ctrlArmed: boolean;
  onToggleCtrl: () => void;
}

const keyClass = cn(
  'inline-flex min-h-[44px] min-w-[44px] flex-shrink-0 items-center justify-center rounded-md px-2 font-mono text-sm',
  'bg-zinc-100 text-zinc-700 active:bg-zinc-300 dark:bg-zinc-800 dark:text-zinc-200 dark:active:bg-zinc-600'
);

export const TerminalKeyBar: React.FC<TerminalKeyBarProps> = ({
  onSend,
  ctrlArmed,
  onToggleCtrl,
}) => {
  const keepTerminalFocus = (e: React.PointerEvent) => e.preventDefault();

  return (
    <div
      className={cn(
        'flex items-center gap-1 overflow-x-auto border-t px-2 py-1',
        'border-zinc-200 bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-800/80'
      )}
      style={{ scrollbarWidth: 'none' }}
      role="toolbar"
      aria-label="Terminal keys"
    >
      <button
        type="button"
        onPointerDown={keepTerminalFocus}
        onClick={onToggleCtrl}
        aria-pressed={ctrlArmed}
        aria-label="Control modifier for the next key"
        className={cn(
          keyClass,
          ctrlArmed &&
            'bg-teal-600 text-white active:bg-teal-700 dark:bg-teal-600 dark:text-white dark:active:bg-teal-700'
        )}
      >
        Ctrl
      </button>
      {TERMINAL_KEYS.map((key) => (
        <button
          key={key.label}
          type="button"
          onPointerDown={keepTerminalFocus}
          onClick={() => onSend(key.sequence)}
          aria-label={key.ariaLabel}
          className={keyClass}
        >
          {key.label}
        </button>
      ))}
      <span className={cn('ml-auto pl-2 text-xs', ctrlArmed ? theme.text.info : 'invisible')}>
        Ctrl armed
      </span>
    </div>
  );
};
