import React from 'react';
import { PlusIcon, TrashIcon } from '@heroicons/react/24/outline';
import { cn } from '../../../utils/cn';
import { theme } from '../../../theme';

interface LabelsFieldProps {
  labels: Record<string, string>;
  onChange: (labels: Record<string, string>) => void;
  disabled?: boolean;
}

export const LabelsField: React.FC<LabelsFieldProps> = ({ labels, onChange, disabled }) => {
  const entries = Object.entries(labels);

  const handleAdd = () => {
    let key = 'label';
    let i = 1;
    while (Object.prototype.hasOwnProperty.call(labels, key)) {
      key = `label_${i++}`;
    }
    onChange({ ...labels, [key]: '' });
  };

  const handleUpdate = (oldKey: string, newKey: string, value: string) => {
    const updated: Record<string, string> = {};
    for (const [k, v] of Object.entries(labels)) {
      if (k === oldKey) {
        updated[newKey] = value;
      } else {
        updated[k] = v;
      }
    }
    onChange(updated);
  };

  const handleRemove = (key: string) => {
    const { [key]: _, ...rest } = labels;
    onChange(rest);
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <label className={cn('text-sm font-medium', theme.text.muted)}>Labels</label>
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
        <p className={cn('text-sm italic py-2', theme.text.muted)}>No labels defined</p>
      ) : (
        <div className="space-y-2">
          {entries.map(([key, value]) => (
            <div key={key} className="flex items-center gap-2">
              <input
                type="text"
                value={key}
                onChange={(e) => handleUpdate(key, e.target.value, value)}
                disabled={disabled}
                placeholder="key"
                className={cn(theme.forms.compact.input, 'w-1/3 font-mono')}
              />
              <span className={theme.text.muted}>=</span>
              <input
                type="text"
                value={value}
                onChange={(e) => handleUpdate(key, key, e.target.value)}
                disabled={disabled}
                placeholder="value"
                className={cn(theme.forms.compact.input, 'flex-1 font-mono')}
              />
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
          ))}
        </div>
      )}
    </div>
  );
};
