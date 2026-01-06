import React, { useState } from 'react';
import { PlusIcon, TrashIcon, EyeIcon, EyeSlashIcon } from '@heroicons/react/24/outline';
import { cn } from '../../../utils/cn';
import { theme } from '../../../theme';

interface EnvironmentFieldProps {
  environment: Record<string, string>;
  onChange: (environment: Record<string, string>) => void;
  disabled?: boolean;
}

const SECRET_PATTERNS = [
  /password/i,
  /secret/i,
  /token/i,
  /api[_-]?key/i,
  /private[_-]?key/i,
  /auth/i,
  /credential/i,
];

const isSecretLike = (key: string): boolean => {
  return SECRET_PATTERNS.some((pattern) => pattern.test(key));
};

export const EnvironmentField: React.FC<EnvironmentFieldProps> = ({
  environment,
  onChange,
  disabled,
}) => {
  const [maskedKeys, setMaskedKeys] = useState<Set<string>>(() => {
    const secretKeys = new Set<string>();
    for (const key of Object.keys(environment)) {
      if (isSecretLike(key)) {
        secretKeys.add(key);
      }
    }
    return secretKeys;
  });

  const entries = Object.entries(environment);

  const handleAdd = () => {
    let key = 'VAR';
    let i = 1;
    while (Object.prototype.hasOwnProperty.call(environment, key)) {
      key = `VAR_${i++}`;
    }
    onChange({ ...environment, [key]: '' });
  };

  const handleUpdate = (oldKey: string, newKey: string, value: string) => {
    const updated: Record<string, string> = {};
    for (const [k, v] of Object.entries(environment)) {
      if (k === oldKey) {
        updated[newKey] = value;
      } else {
        updated[k] = v;
      }
    }
    onChange(updated);

    if (oldKey !== newKey && maskedKeys.has(oldKey)) {
      const next = new Set(maskedKeys);
      next.delete(oldKey);
      if (isSecretLike(newKey)) {
        next.add(newKey);
      }
      setMaskedKeys(next);
    } else if (isSecretLike(newKey) && !maskedKeys.has(newKey)) {
      setMaskedKeys(new Set([...maskedKeys, newKey]));
    }
  };

  const handleRemove = (key: string) => {
    const { [key]: _, ...rest } = environment;
    onChange(rest);
    if (maskedKeys.has(key)) {
      const next = new Set(maskedKeys);
      next.delete(key);
      setMaskedKeys(next);
    }
  };

  const toggleMask = (key: string) => {
    const next = new Set(maskedKeys);
    if (next.has(key)) {
      next.delete(key);
    } else {
      next.add(key);
    }
    setMaskedKeys(next);
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <label className={cn('text-sm font-medium', theme.text.muted)}>Environment Variables</label>
        <button
          type="button"
          onClick={handleAdd}
          disabled={disabled}
          className={cn(theme.forms.compact.addButton)}
        >
          <PlusIcon className="w-3 h-3" />
          Add
        </button>
      </div>

      {entries.length === 0 ? (
        <p className={cn('text-sm italic py-2', theme.text.muted)}>
          No environment variables defined
        </p>
      ) : (
        <div className="space-y-2">
          {entries.map(([key, value]) => {
            const isMasked = maskedKeys.has(key);
            return (
              <div key={key} className="flex items-center gap-2">
                <input
                  type="text"
                  value={key}
                  onChange={(e) => handleUpdate(key, e.target.value, value)}
                  disabled={disabled}
                  placeholder="KEY"
                  className={cn(theme.forms.compact.input, 'w-1/3 font-mono')}
                />
                <span className={theme.text.muted}>=</span>
                <div className="flex-1 relative">
                  <input
                    type={isMasked ? 'password' : 'text'}
                    value={value}
                    onChange={(e) => handleUpdate(key, key, e.target.value)}
                    disabled={disabled}
                    placeholder="value"
                    className={cn(theme.forms.compact.input, 'pr-8 font-mono')}
                  />
                  <button
                    type="button"
                    onClick={() => toggleMask(key)}
                    disabled={disabled}
                    className={cn(
                      'absolute right-1.5 top-1/2 -translate-y-1/2 p-1 rounded',
                      'text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300',
                      'disabled:opacity-50'
                    )}
                    title={isMasked ? 'Show value' : 'Hide value'}
                  >
                    {isMasked ? (
                      <EyeIcon className="w-4 h-4" />
                    ) : (
                      <EyeSlashIcon className="w-4 h-4" />
                    )}
                  </button>
                </div>
                <button
                  type="button"
                  onClick={() => handleRemove(key)}
                  disabled={disabled}
                  className={cn(
                    'p-1.5 rounded',
                    'text-zinc-400 hover:text-rose-500 hover:bg-rose-50',
                    'dark:hover:bg-rose-900/20',
                    'disabled:opacity-50 disabled:cursor-not-allowed'
                  )}
                >
                  <TrashIcon className="w-4 h-4" />
                </button>
              </div>
            );
          })}
        </div>
      )}
      <p className={cn('text-xs', theme.text.subtle)}>
        Secret-like variables (password, token, key) are automatically masked.
      </p>
    </div>
  );
};
