import React, { useState } from 'react';
import { PlusIcon, TrashIcon, ArrowUpIcon, ArrowDownIcon } from '@heroicons/react/24/outline';
import { cn } from '../../../utils/cn';
import { theme } from '../../../theme';

interface CommandFieldProps {
  label: string;
  values: string[] | null;
  onChange: (values: string[] | null) => void;
  disabled?: boolean;
  placeholder?: string;
}

type InputMode = 'array' | 'shell';

export const CommandField: React.FC<CommandFieldProps> = ({
  label,
  values,
  onChange,
  disabled,
  placeholder = 'Enter command...',
}) => {
  const [inputMode, setInputMode] = useState<InputMode>('array');
  const [shellInput, setShellInput] = useState('');

  const handleAddItem = () => {
    onChange([...(values || []), '']);
  };

  const handleRemoveItem = (index: number) => {
    if (!values) return;
    const newValues = values.filter((_, i) => i !== index);
    onChange(newValues.length > 0 ? newValues : null);
  };

  const handleUpdateItem = (index: number, value: string) => {
    if (!values) return;
    const newValues = [...values];
    newValues[index] = value;
    onChange(newValues);
  };

  const handleMoveItem = (index: number, direction: 'up' | 'down') => {
    if (!values) return;
    const newIndex = direction === 'up' ? index - 1 : index + 1;
    if (newIndex < 0 || newIndex >= values.length) return;
    const newValues = [...values];
    [newValues[index], newValues[newIndex]] = [newValues[newIndex], newValues[index]];
    onChange(newValues);
  };

  const handleShellSubmit = () => {
    if (!shellInput.trim()) return;

    const parsed = parseShellCommand(shellInput);
    onChange(parsed);
    setShellInput('');
  };

  const handleClear = () => {
    onChange(null);
    setShellInput('');
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <label className={cn('text-sm font-medium', theme.text.muted)}>{label}</label>
        <div className="flex items-center gap-2">
          {values !== null && values.length > 0 && (
            <button
              type="button"
              onClick={handleClear}
              disabled={disabled}
              className={cn(
                'px-2 py-1 text-xs font-medium rounded',
                'text-zinc-500 hover:text-zinc-700 hover:bg-zinc-100',
                'dark:text-zinc-400 dark:hover:text-zinc-200 dark:hover:bg-zinc-800',
                'disabled:opacity-50 disabled:cursor-not-allowed'
              )}
            >
              Clear
            </button>
          )}
          <select
            value={inputMode}
            onChange={(e) => setInputMode(e.target.value as InputMode)}
            disabled={disabled}
            className={cn(
              'px-2 py-1 text-xs font-medium rounded border',
              'bg-white text-zinc-900',
              'dark:bg-zinc-900 dark:text-white',
              'border-zinc-200 dark:border-zinc-700',
              'focus:border-teal-500 focus:ring-1 focus:ring-teal-500',
              'disabled:opacity-50 disabled:cursor-not-allowed'
            )}
          >
            <option value="array">Array mode</option>
            <option value="shell">Shell mode</option>
          </select>
        </div>
      </div>

      {inputMode === 'shell' && (
        <div className="space-y-2">
          <div className="flex gap-2">
            <input
              type="text"
              value={shellInput}
              onChange={(e) => setShellInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleShellSubmit()}
              disabled={disabled}
              placeholder={placeholder}
              className={cn(
                'flex-1 px-3 py-2 text-sm rounded border font-mono',
                'bg-white text-zinc-900 placeholder:text-zinc-400',
                'dark:bg-zinc-900 dark:text-white dark:placeholder:text-zinc-500',
                'border-zinc-200 dark:border-zinc-700',
                'focus:border-teal-500 focus:ring-1 focus:ring-teal-500',
                'disabled:opacity-50 disabled:cursor-not-allowed'
              )}
            />
            <button
              type="button"
              onClick={handleShellSubmit}
              disabled={disabled || !shellInput.trim()}
              className={cn(
                'px-3 py-2 text-sm font-medium rounded',
                'bg-teal-100 text-teal-700 hover:bg-teal-200',
                'dark:bg-teal-900/30 dark:text-teal-400 dark:hover:bg-teal-900/50',
                'disabled:opacity-50 disabled:cursor-not-allowed'
              )}
            >
              Set
            </button>
          </div>
          <p className={cn('text-xs', theme.text.subtle)}>
            Enter command as you would in a shell. It will be parsed into an array.
          </p>
        </div>
      )}

      {inputMode === 'array' && (
        <div className="space-y-2">
          {!values || values.length === 0 ? (
            <p className={cn('text-sm italic', theme.text.muted)}>
              No {label.toLowerCase()} configured (using image default)
            </p>
          ) : (
            <div className="space-y-1">
              {values.map((item, index) => (
                <div key={index} className="flex items-center gap-1">
                  <span className={cn('w-6 text-xs text-right', theme.text.subtle)}>
                    {index === 0 ? '' : `[${index}]`}
                  </span>
                  <input
                    type="text"
                    value={item}
                    onChange={(e) => handleUpdateItem(index, e.target.value)}
                    disabled={disabled}
                    placeholder={index === 0 ? 'executable' : 'argument'}
                    className={cn(
                      'flex-1 px-2 py-1.5 text-sm rounded border font-mono',
                      'bg-white text-zinc-900 placeholder:text-zinc-400',
                      'dark:bg-zinc-900 dark:text-white dark:placeholder:text-zinc-500',
                      'border-zinc-200 dark:border-zinc-700',
                      'focus:border-teal-500 focus:ring-1 focus:ring-teal-500',
                      'disabled:opacity-50 disabled:cursor-not-allowed'
                    )}
                  />
                  <button
                    type="button"
                    onClick={() => handleMoveItem(index, 'up')}
                    disabled={disabled || index === 0}
                    className={cn(
                      'p-1 rounded',
                      'text-zinc-400 hover:text-zinc-600 hover:bg-zinc-100',
                      'dark:hover:text-zinc-300 dark:hover:bg-zinc-800',
                      'disabled:opacity-30 disabled:cursor-not-allowed'
                    )}
                  >
                    <ArrowUpIcon className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleMoveItem(index, 'down')}
                    disabled={disabled || index === values.length - 1}
                    className={cn(
                      'p-1 rounded',
                      'text-zinc-400 hover:text-zinc-600 hover:bg-zinc-100',
                      'dark:hover:text-zinc-300 dark:hover:bg-zinc-800',
                      'disabled:opacity-30 disabled:cursor-not-allowed'
                    )}
                  >
                    <ArrowDownIcon className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleRemoveItem(index)}
                    disabled={disabled}
                    className={cn(
                      'p-1 rounded',
                      'text-zinc-400 hover:text-rose-500 hover:bg-rose-50',
                      'dark:hover:bg-rose-900/20',
                      'disabled:opacity-50 disabled:cursor-not-allowed'
                    )}
                  >
                    <TrashIcon className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          )}
          <button
            type="button"
            onClick={handleAddItem}
            disabled={disabled}
            className={cn(
              'inline-flex items-center gap-1 px-2 py-1 text-xs font-medium rounded',
              'bg-teal-100 text-teal-700 hover:bg-teal-200',
              'dark:bg-teal-900/30 dark:text-teal-400 dark:hover:bg-teal-900/50',
              'disabled:opacity-50 disabled:cursor-not-allowed'
            )}
          >
            <PlusIcon className="w-3 h-3" />
            Add Argument
          </button>
        </div>
      )}

      {values && values.length > 0 && (
        <div className={cn('p-2 rounded text-xs font-mono', 'bg-zinc-100 dark:bg-zinc-800')}>
          <span className={theme.text.subtle}>Preview: </span>
          <span className={theme.text.standard}>{values.map(escapeArg).join(' ')}</span>
        </div>
      )}
    </div>
  );
};

function parseShellCommand(input: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuote: string | null = null;
  let escape = false;

  for (let i = 0; i < input.length; i++) {
    const char = input[i];

    if (escape) {
      current += char;
      escape = false;
      continue;
    }

    if (char === '\\' && !inQuote) {
      escape = true;
      continue;
    }

    if ((char === '"' || char === "'") && !inQuote) {
      inQuote = char;
      continue;
    }

    if (char === inQuote) {
      inQuote = null;
      continue;
    }

    if (char === ' ' && !inQuote) {
      if (current) {
        result.push(current);
        current = '';
      }
      continue;
    }

    current += char;
  }

  if (current) {
    result.push(current);
  }

  return result;
}

function escapeArg(arg: string): string {
  if (!arg) return '""';
  if (/^[a-zA-Z0-9_./=-]+$/.test(arg)) return arg;
  if (!arg.includes("'")) return `'${arg}'`;
  return `"${arg.replace(/"/g, '\\"')}"`;
}
