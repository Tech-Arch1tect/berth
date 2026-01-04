import React from 'react';
import { cn } from '../../../utils/cn';
import { theme } from '../../../theme';
import { HealthcheckChange } from '../../../types/compose';

interface HealthcheckFieldProps {
  healthcheck: HealthcheckChange | null;
  onChange: (healthcheck: HealthcheckChange | null) => void;
  disabled?: boolean;
}

const DEFAULT_HEALTHCHECK: HealthcheckChange = {
  test: ['CMD', 'echo', 'ok'],
  interval: '30s',
  timeout: '10s',
  retries: 3,
  start_period: '0s',
};

export const HealthcheckField: React.FC<HealthcheckFieldProps> = ({
  healthcheck,
  onChange,
  disabled,
}) => {
  const isEnabled = healthcheck !== null && !healthcheck.disable;
  const isDisabled = healthcheck?.disable === true;

  const handleToggle = (enabled: boolean) => {
    if (enabled) {
      onChange(DEFAULT_HEALTHCHECK);
    } else if (healthcheck) {
      onChange({ ...healthcheck, disable: true });
    } else {
      onChange({ disable: true });
    }
  };

  const handleClear = () => {
    onChange(null);
  };

  const handleUpdate = (updates: Partial<HealthcheckChange>) => {
    if (healthcheck) {
      onChange({ ...healthcheck, ...updates });
    }
  };

  const handleTestChange = (value: string) => {
    const parts = value.split(' ').filter((p) => p.length > 0);
    if (parts.length === 0) {
      handleUpdate({ test: ['CMD', 'echo', 'ok'] });
    } else {
      handleUpdate({ test: ['CMD-SHELL', value] });
    }
  };

  const testCommand =
    healthcheck?.test && healthcheck.test.length > 0
      ? healthcheck.test[0] === 'CMD-SHELL'
        ? healthcheck.test.slice(1).join(' ')
        : healthcheck.test[0] === 'CMD'
          ? healthcheck.test.slice(1).join(' ')
          : healthcheck.test.join(' ')
      : '';

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <label className={cn('text-sm font-medium', theme.text.muted)}>Healthcheck</label>
        <div className="flex items-center gap-2">
          {healthcheck !== null && (
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
            value={isDisabled ? 'disabled' : isEnabled ? 'enabled' : 'inherit'}
            onChange={(e) => {
              const val = e.target.value;
              if (val === 'enabled') handleToggle(true);
              else if (val === 'disabled') handleToggle(false);
              else handleClear();
            }}
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
            <option value="inherit">Inherit from image</option>
            <option value="enabled">Enabled</option>
            <option value="disabled">Disabled</option>
          </select>
        </div>
      </div>

      {isDisabled && (
        <p className={cn('text-sm italic', theme.text.muted)}>Healthcheck is disabled</p>
      )}

      {isEnabled && healthcheck && (
        <div className={cn('p-3 rounded-lg space-y-3', 'bg-zinc-50 dark:bg-zinc-800/50')}>
          <div>
            <label className={cn('block text-xs mb-1', theme.text.subtle)}>
              Test Command (shell syntax)
            </label>
            <input
              type="text"
              value={testCommand}
              onChange={(e) => handleTestChange(e.target.value)}
              disabled={disabled}
              placeholder="curl -f http://localhost/health || exit 1"
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

          <div className="grid grid-cols-4 gap-2">
            <div>
              <label className={cn('block text-xs mb-1', theme.text.subtle)}>Interval</label>
              <input
                type="text"
                value={healthcheck.interval || ''}
                onChange={(e) => handleUpdate({ interval: e.target.value || undefined })}
                disabled={disabled}
                placeholder="30s"
                className={cn(
                  'w-full px-2 py-1.5 text-sm rounded border',
                  'bg-white text-zinc-900 placeholder:text-zinc-400',
                  'dark:bg-zinc-900 dark:text-white dark:placeholder:text-zinc-500',
                  'border-zinc-200 dark:border-zinc-700',
                  'focus:border-teal-500 focus:ring-1 focus:ring-teal-500',
                  'disabled:opacity-50 disabled:cursor-not-allowed'
                )}
              />
            </div>
            <div>
              <label className={cn('block text-xs mb-1', theme.text.subtle)}>Timeout</label>
              <input
                type="text"
                value={healthcheck.timeout || ''}
                onChange={(e) => handleUpdate({ timeout: e.target.value || undefined })}
                disabled={disabled}
                placeholder="10s"
                className={cn(
                  'w-full px-2 py-1.5 text-sm rounded border',
                  'bg-white text-zinc-900 placeholder:text-zinc-400',
                  'dark:bg-zinc-900 dark:text-white dark:placeholder:text-zinc-500',
                  'border-zinc-200 dark:border-zinc-700',
                  'focus:border-teal-500 focus:ring-1 focus:ring-teal-500',
                  'disabled:opacity-50 disabled:cursor-not-allowed'
                )}
              />
            </div>
            <div>
              <label className={cn('block text-xs mb-1', theme.text.subtle)}>Retries</label>
              <input
                type="number"
                value={healthcheck.retries ?? ''}
                onChange={(e) =>
                  handleUpdate({
                    retries: e.target.value ? parseInt(e.target.value) : undefined,
                  })
                }
                disabled={disabled}
                placeholder="3"
                min={0}
                className={cn(
                  'w-full px-2 py-1.5 text-sm rounded border',
                  'bg-white text-zinc-900 placeholder:text-zinc-400',
                  'dark:bg-zinc-900 dark:text-white dark:placeholder:text-zinc-500',
                  'border-zinc-200 dark:border-zinc-700',
                  'focus:border-teal-500 focus:ring-1 focus:ring-teal-500',
                  'disabled:opacity-50 disabled:cursor-not-allowed'
                )}
              />
            </div>
            <div>
              <label className={cn('block text-xs mb-1', theme.text.subtle)}>Start Period</label>
              <input
                type="text"
                value={healthcheck.start_period || ''}
                onChange={(e) => handleUpdate({ start_period: e.target.value || undefined })}
                disabled={disabled}
                placeholder="0s"
                className={cn(
                  'w-full px-2 py-1.5 text-sm rounded border',
                  'bg-white text-zinc-900 placeholder:text-zinc-400',
                  'dark:bg-zinc-900 dark:text-white dark:placeholder:text-zinc-500',
                  'border-zinc-200 dark:border-zinc-700',
                  'focus:border-teal-500 focus:ring-1 focus:ring-teal-500',
                  'disabled:opacity-50 disabled:cursor-not-allowed'
                )}
              />
            </div>
          </div>
        </div>
      )}

      {!isEnabled && !isDisabled && (
        <p className={cn('text-sm italic', theme.text.muted)}>
          Using healthcheck from image (if any)
        </p>
      )}
    </div>
  );
};
