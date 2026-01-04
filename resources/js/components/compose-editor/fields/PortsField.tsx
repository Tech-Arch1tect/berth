import React from 'react';
import { PlusIcon, TrashIcon } from '@heroicons/react/24/outline';
import { cn } from '../../../utils/cn';
import { theme } from '../../../theme';
import { PortMappingChange } from '../../../types/compose';

interface PortsFieldProps {
  ports: PortMappingChange[];
  onChange: (ports: PortMappingChange[]) => void;
  disabled?: boolean;
}

export const PortsField: React.FC<PortsFieldProps> = ({ ports, onChange, disabled }) => {
  const handleAddPort = () => {
    onChange([...ports, { target: 80, published: '80' }]);
  };

  const handleRemovePort = (index: number) => {
    onChange(ports.filter((_, i) => i !== index));
  };

  const handleUpdatePort = (index: number, updates: Partial<PortMappingChange>) => {
    onChange(ports.map((port, i) => (i === index ? { ...port, ...updates } : port)));
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <label className={cn('text-sm font-medium', theme.text.muted)}>Ports</label>
        <button
          type="button"
          onClick={handleAddPort}
          disabled={disabled}
          className={cn(
            'inline-flex items-center gap-1 px-2 py-1 text-xs font-medium rounded',
            'bg-teal-100 text-teal-700 hover:bg-teal-200',
            'dark:bg-teal-900/30 dark:text-teal-400 dark:hover:bg-teal-900/50',
            'disabled:opacity-50 disabled:cursor-not-allowed'
          )}
        >
          <PlusIcon className="w-3 h-3" />
          Add Port
        </button>
      </div>

      {ports.length === 0 ? (
        <p className={cn('text-sm italic', theme.text.muted)}>No ports configured</p>
      ) : (
        <div className="space-y-2">
          {ports.map((port, index) => (
            <div
              key={index}
              className={cn(
                'flex items-center gap-2 p-3 rounded-lg',
                'bg-zinc-50 dark:bg-zinc-800/50'
              )}
            >
              <div className="flex-1 grid grid-cols-4 gap-2">
                <div>
                  <label className={cn('block text-xs mb-1', theme.text.subtle)}>Host IP</label>
                  <input
                    type="text"
                    value={port.host_ip || ''}
                    onChange={(e) =>
                      handleUpdatePort(index, { host_ip: e.target.value || undefined })
                    }
                    disabled={disabled}
                    placeholder="0.0.0.0"
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
                  <label className={cn('block text-xs mb-1', theme.text.subtle)}>Published</label>
                  <input
                    type="text"
                    value={port.published || ''}
                    onChange={(e) => handleUpdatePort(index, { published: e.target.value })}
                    disabled={disabled}
                    placeholder="8080"
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
                  <label className={cn('block text-xs mb-1', theme.text.subtle)}>Target</label>
                  <input
                    type="number"
                    value={port.target}
                    onChange={(e) =>
                      handleUpdatePort(index, { target: parseInt(e.target.value) || 0 })
                    }
                    disabled={disabled}
                    placeholder="80"
                    min={1}
                    max={65535}
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
                  <label className={cn('block text-xs mb-1', theme.text.subtle)}>Protocol</label>
                  <select
                    value={port.protocol || ''}
                    onChange={(e) =>
                      handleUpdatePort(index, { protocol: e.target.value || undefined })
                    }
                    disabled={disabled}
                    className={cn(
                      'w-full px-2 py-1.5 text-sm rounded border',
                      'bg-white text-zinc-900',
                      'dark:bg-zinc-900 dark:text-white',
                      'border-zinc-200 dark:border-zinc-700',
                      'focus:border-teal-500 focus:ring-1 focus:ring-teal-500',
                      'disabled:opacity-50 disabled:cursor-not-allowed'
                    )}
                  >
                    <option value="">Default (tcp)</option>
                    <option value="tcp">TCP</option>
                    <option value="udp">UDP</option>
                  </select>
                </div>
              </div>
              <button
                type="button"
                onClick={() => handleRemovePort(index)}
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
