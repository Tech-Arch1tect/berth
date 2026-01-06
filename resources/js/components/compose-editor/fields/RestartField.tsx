import React from 'react';
import { cn } from '../../../utils/cn';
import { theme } from '../../../theme';

interface RestartFieldProps {
  restart: string | undefined;
  onChange: (restart: string | undefined) => void;
  disabled?: boolean;
}

const RESTART_POLICIES = [
  {
    value: '',
    label: 'Not set',
    description: 'Uses Docker default (no)',
  },
  {
    value: 'no',
    label: 'No',
    description: 'Never restart the container',
  },
  {
    value: 'always',
    label: 'Always',
    description: 'Always restart, including on daemon startup',
  },
  {
    value: 'on-failure',
    label: 'On Failure',
    description: 'Restart only if the container exits with a non-zero code',
  },
  {
    value: 'unless-stopped',
    label: 'Unless Stopped',
    description: 'Like always, but not if manually stopped before daemon restart',
  },
];

export const RestartField: React.FC<RestartFieldProps> = ({ restart, onChange, disabled }) => {
  const currentPolicy =
    RESTART_POLICIES.find((p) => p.value === (restart || '')) || RESTART_POLICIES[0];

  return (
    <div className="space-y-2">
      <label className={cn('block text-sm font-medium', theme.text.muted)}>Restart Policy</label>
      <select
        value={restart || ''}
        onChange={(e) => onChange(e.target.value || undefined)}
        disabled={disabled}
        className={cn(
          'w-full px-3 py-2 text-sm rounded-lg border',
          'bg-white text-zinc-900',
          'dark:bg-zinc-900 dark:text-white',
          'border-zinc-200 dark:border-zinc-700',
          'focus:border-teal-500 focus:ring-1 focus:ring-teal-500',
          'disabled:opacity-50 disabled:cursor-not-allowed'
        )}
      >
        {RESTART_POLICIES.map((policy) => (
          <option key={policy.value} value={policy.value}>
            {policy.label}
          </option>
        ))}
      </select>
      <p className={cn('text-xs', theme.text.subtle)}>{currentPolicy.description}</p>
    </div>
  );
};
