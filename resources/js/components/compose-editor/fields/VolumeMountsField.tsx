import React from 'react';
import { PlusIcon, TrashIcon } from '@heroicons/react/24/outline';
import { cn } from '../../../utils/cn';
import { hasEnvVars } from '../../../utils/composeNormaliser';
import { theme } from '../../../theme';
import { ComposeVolumeMount } from '../../../types/compose';

interface VolumeMountsFieldProps {
  volumes: ComposeVolumeMount[];
  availableVolumes: string[];
  onChange: (volumes: ComposeVolumeMount[]) => void;
  disabled?: boolean;
}

const VOLUME_TYPES = [
  { value: 'bind', label: 'Bind Mount' },
  { value: 'volume', label: 'Named Volume' },
  { value: 'tmpfs', label: 'Tmpfs' },
];

export const VolumeMountsField: React.FC<VolumeMountsFieldProps> = ({
  volumes,
  availableVolumes,
  onChange,
  disabled,
}) => {
  const handleAddVolume = () => {
    onChange([...volumes, { type: 'bind', source: '', target: '' }]);
  };

  const handleRemoveVolume = (index: number) => {
    onChange(volumes.filter((_, i) => i !== index));
  };

  const handleUpdateVolume = (index: number, updates: Partial<ComposeVolumeMount>) => {
    onChange(
      volumes.map((vol, i) => (i === index ? { ...vol, ...updates, rawValue: undefined } : vol))
    );
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <label className={cn('text-sm font-medium', theme.text.muted)}>Volumes</label>
        <button
          type="button"
          onClick={handleAddVolume}
          disabled={disabled}
          className={cn(
            'inline-flex items-center gap-1 px-2 py-1 text-xs font-medium rounded',
            'bg-teal-100 text-teal-700 hover:bg-teal-200',
            'dark:bg-teal-900/30 dark:text-teal-400 dark:hover:bg-teal-900/50',
            'disabled:opacity-50 disabled:cursor-not-allowed'
          )}
        >
          <PlusIcon className="w-3 h-3" />
          Add Volume
        </button>
      </div>

      {volumes.length === 0 ? (
        <p className={cn('text-sm italic', theme.text.muted)}>No volumes configured</p>
      ) : (
        <div className="space-y-2">
          {volumes.map((volume, index) => (
            <div
              key={index}
              className={cn('flex flex-col gap-2 p-3 rounded-lg', 'bg-zinc-50 dark:bg-zinc-800/50')}
            >
              {volume.rawValue && hasEnvVars(volume.rawValue) && (
                <div
                  className={cn(
                    'text-xs px-2 py-1 rounded font-mono',
                    'bg-amber-50 text-amber-700 dark:bg-amber-900/20 dark:text-amber-400'
                  )}
                >
                  Original: {volume.rawValue}
                </div>
              )}
              <div className="flex items-start gap-2">
                <div className="flex-1 grid grid-cols-4 gap-2">
                  <div>
                    <label className={cn('block text-xs mb-1', theme.text.subtle)}>Type</label>
                    <select
                      value={volume.type}
                      onChange={(e) => handleUpdateVolume(index, { type: e.target.value })}
                      disabled={disabled}
                      className={cn(theme.forms.compact.select)}
                    >
                      {VOLUME_TYPES.map((type) => (
                        <option key={type.value} value={type.value}>
                          {type.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className={cn('block text-xs mb-1', theme.text.subtle)}>
                      {volume.type === 'tmpfs' ? 'Size (optional)' : 'Source'}
                    </label>
                    <input
                      type="text"
                      list={volume.type === 'volume' ? `volume-suggestions-${index}` : undefined}
                      value={volume.source}
                      onChange={(e) => handleUpdateVolume(index, { source: e.target.value })}
                      disabled={disabled || volume.type === 'tmpfs'}
                      placeholder={
                        volume.type === 'bind'
                          ? './data or ${VAR}'
                          : volume.type === 'volume'
                            ? 'volume-name or ${VAR}'
                            : ''
                      }
                      className={cn(
                        theme.forms.compact.input,
                        hasEnvVars(volume.source) && 'font-mono text-xs'
                      )}
                    />
                    {volume.type === 'volume' && availableVolumes.length > 0 && (
                      <datalist id={`volume-suggestions-${index}`}>
                        {availableVolumes.map((vol) => (
                          <option key={vol} value={vol} />
                        ))}
                      </datalist>
                    )}
                  </div>
                  <div>
                    <label className={cn('block text-xs mb-1', theme.text.subtle)}>Target</label>
                    <input
                      type="text"
                      value={volume.target}
                      onChange={(e) => handleUpdateVolume(index, { target: e.target.value })}
                      disabled={disabled}
                      placeholder="/app/data"
                      className={cn(
                        theme.forms.compact.input,
                        hasEnvVars(volume.target) && 'font-mono text-xs'
                      )}
                    />
                  </div>
                  <div>
                    <label className={cn('block text-xs mb-1', theme.text.subtle)}>Access</label>
                    <select
                      value={volume.read_only ? 'ro' : 'rw'}
                      onChange={(e) =>
                        handleUpdateVolume(index, { read_only: e.target.value === 'ro' })
                      }
                      disabled={disabled}
                      className={cn(theme.forms.compact.select)}
                    >
                      <option value="rw">Read/Write</option>
                      <option value="ro">Read Only</option>
                    </select>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => handleRemoveVolume(index)}
                  disabled={disabled}
                  className={cn(
                    'p-1.5 rounded mt-5',
                    'text-zinc-400 hover:text-rose-500 hover:bg-rose-50',
                    'dark:hover:bg-rose-900/20',
                    'disabled:opacity-50 disabled:cursor-not-allowed'
                  )}
                >
                  <TrashIcon className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
