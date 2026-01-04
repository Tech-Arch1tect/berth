import React from 'react';
import { PlusIcon, TrashIcon } from '@heroicons/react/24/outline';
import { cn } from '../../../utils/cn';
import { theme } from '../../../theme';
import { BuildChange } from '../../../types/compose';

interface BuildFieldProps {
  build: BuildChange | null;
  onChange: (build: BuildChange | null) => void;
  disabled?: boolean;
}

export const BuildField: React.FC<BuildFieldProps> = ({ build, onChange, disabled }) => {
  const handleUpdate = (updates: Partial<BuildChange>) => {
    onChange({ ...build, ...updates });
  };

  const handleClear = () => {
    onChange(null);
  };

  const handleAddArg = () => {
    const args = build?.args || {};
    let newKey = 'NEW_ARG';
    let i = 1;
    while (Object.prototype.hasOwnProperty.call(args, newKey)) {
      newKey = `NEW_ARG_${i++}`;
    }
    handleUpdate({ args: { ...args, [newKey]: '' } });
  };

  const handleRemoveArg = (key: string) => {
    if (!build?.args) return;
    const { [key]: _, ...rest } = build.args;
    handleUpdate({ args: Object.keys(rest).length > 0 ? rest : undefined });
  };

  const handleUpdateArg = (oldKey: string, newKey: string, value: string) => {
    if (!build?.args) return;
    const entries = Object.entries(build.args);
    const updated: Record<string, string> = {};
    for (const [k, v] of entries) {
      if (k === oldKey) {
        updated[newKey] = value;
      } else {
        updated[k] = v;
      }
    }
    handleUpdate({ args: updated });
  };

  const handleAddCacheFrom = () => {
    handleUpdate({
      cache_from: [...(build?.cache_from || []), ''],
    });
  };

  const handleRemoveCacheFrom = (index: number) => {
    if (!build?.cache_from) return;
    const updated = build.cache_from.filter((_, i) => i !== index);
    handleUpdate({ cache_from: updated.length > 0 ? updated : undefined });
  };

  const handleUpdateCacheFrom = (index: number, value: string) => {
    if (!build?.cache_from) return;
    const updated = [...build.cache_from];
    updated[index] = value;
    handleUpdate({ cache_from: updated });
  };

  const hasAnyConfig = build !== null && Object.keys(build).length > 0;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <label className={cn('text-sm font-medium', theme.text.muted)}>Build Configuration</label>
        {hasAnyConfig && (
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
            Clear All
          </button>
        )}
      </div>

      <div className={cn('p-3 rounded-lg space-y-4', 'bg-zinc-50 dark:bg-zinc-800/50')}>
        {/* Context */}
        <div>
          <label className={cn('block text-xs mb-1', theme.text.subtle)}>Context</label>
          <input
            type="text"
            value={build?.context || ''}
            onChange={(e) => handleUpdate({ context: e.target.value || undefined })}
            disabled={disabled}
            placeholder="./"
            className={cn(
              'w-full px-2 py-1.5 text-sm rounded border font-mono',
              'bg-white text-zinc-900 placeholder:text-zinc-400',
              'dark:bg-zinc-900 dark:text-white dark:placeholder:text-zinc-500',
              'border-zinc-200 dark:border-zinc-700',
              'focus:border-teal-500 focus:ring-1 focus:ring-teal-500',
              'disabled:opacity-50 disabled:cursor-not-allowed'
            )}
          />
          <p className={cn('text-xs mt-1', theme.text.subtle)}>
            Path to build context or Git repository URL
          </p>
        </div>

        {/* Dockerfile */}
        <div>
          <label className={cn('block text-xs mb-1', theme.text.subtle)}>Dockerfile</label>
          <input
            type="text"
            value={build?.dockerfile || ''}
            onChange={(e) => handleUpdate({ dockerfile: e.target.value || undefined })}
            disabled={disabled}
            placeholder="Dockerfile"
            className={cn(
              'w-full px-2 py-1.5 text-sm rounded border font-mono',
              'bg-white text-zinc-900 placeholder:text-zinc-400',
              'dark:bg-zinc-900 dark:text-white dark:placeholder:text-zinc-500',
              'border-zinc-200 dark:border-zinc-700',
              'focus:border-teal-500 focus:ring-1 focus:ring-teal-500',
              'disabled:opacity-50 disabled:cursor-not-allowed'
            )}
          />
        </div>

        {/* Target */}
        <div>
          <label className={cn('block text-xs mb-1', theme.text.subtle)}>Target</label>
          <input
            type="text"
            value={build?.target || ''}
            onChange={(e) => handleUpdate({ target: e.target.value || undefined })}
            disabled={disabled}
            placeholder="production"
            className={cn(
              'w-full px-2 py-1.5 text-sm rounded border',
              'bg-white text-zinc-900 placeholder:text-zinc-400',
              'dark:bg-zinc-900 dark:text-white dark:placeholder:text-zinc-500',
              'border-zinc-200 dark:border-zinc-700',
              'focus:border-teal-500 focus:ring-1 focus:ring-teal-500',
              'disabled:opacity-50 disabled:cursor-not-allowed'
            )}
          />
          <p className={cn('text-xs mt-1', theme.text.subtle)}>Multi-stage build target</p>
        </div>

        {/* Build Arguments */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className={cn('text-xs font-medium', theme.text.subtle)}>Build Arguments</label>
            <button
              type="button"
              onClick={handleAddArg}
              disabled={disabled}
              className={cn(
                'inline-flex items-center gap-1 px-2 py-1 text-xs font-medium rounded',
                'bg-teal-100 text-teal-700 hover:bg-teal-200',
                'dark:bg-teal-900/30 dark:text-teal-400 dark:hover:bg-teal-900/50',
                'disabled:opacity-50 disabled:cursor-not-allowed'
              )}
            >
              <PlusIcon className="w-3 h-3" />
              Add
            </button>
          </div>
          {!build?.args || Object.keys(build.args).length === 0 ? (
            <p className={cn('text-sm italic', theme.text.muted)}>No build arguments</p>
          ) : (
            <div className="space-y-2">
              {Object.entries(build.args).map(([key, value], index) => (
                <div key={index} className="flex items-center gap-2">
                  <input
                    type="text"
                    value={key}
                    onChange={(e) => handleUpdateArg(key, e.target.value, value)}
                    disabled={disabled}
                    placeholder="ARG_NAME"
                    className={cn(
                      'w-1/3 px-2 py-1.5 text-sm rounded border font-mono',
                      'bg-white text-zinc-900 placeholder:text-zinc-400',
                      'dark:bg-zinc-900 dark:text-white dark:placeholder:text-zinc-500',
                      'border-zinc-200 dark:border-zinc-700',
                      'focus:border-teal-500 focus:ring-1 focus:ring-teal-500',
                      'disabled:opacity-50 disabled:cursor-not-allowed'
                    )}
                  />
                  <span className={theme.text.muted}>=</span>
                  <input
                    type="text"
                    value={value}
                    onChange={(e) => handleUpdateArg(key, key, e.target.value)}
                    disabled={disabled}
                    placeholder="value"
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
                    onClick={() => handleRemoveArg(key)}
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
              ))}
            </div>
          )}
        </div>

        {/* Cache From */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className={cn('text-xs font-medium', theme.text.subtle)}>Cache From</label>
            <button
              type="button"
              onClick={handleAddCacheFrom}
              disabled={disabled}
              className={cn(
                'inline-flex items-center gap-1 px-2 py-1 text-xs font-medium rounded',
                'bg-teal-100 text-teal-700 hover:bg-teal-200',
                'dark:bg-teal-900/30 dark:text-teal-400 dark:hover:bg-teal-900/50',
                'disabled:opacity-50 disabled:cursor-not-allowed'
              )}
            >
              <PlusIcon className="w-3 h-3" />
              Add
            </button>
          </div>
          {!build?.cache_from || build.cache_from.length === 0 ? (
            <p className={cn('text-sm italic', theme.text.muted)}>No cache sources</p>
          ) : (
            <div className="space-y-2">
              {build.cache_from.map((source, index) => (
                <div key={index} className="flex items-center gap-2">
                  <input
                    type="text"
                    value={source}
                    onChange={(e) => handleUpdateCacheFrom(index, e.target.value)}
                    disabled={disabled}
                    placeholder="myapp:cache"
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
                    onClick={() => handleRemoveCacheFrom(index)}
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
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
