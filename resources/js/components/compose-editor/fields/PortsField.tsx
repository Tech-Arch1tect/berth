import React from 'react';
import { PlusIcon, TrashIcon } from '@heroicons/react/24/outline';
import { cn } from '../../../utils/cn';
import { hasEnvVars } from '../../../utils/composeNormaliser';
import { theme } from '../../../theme';
import { ComposePort } from '../../../types/compose';

interface PortsFieldProps {
  ports: ComposePort[];
  onChange: (ports: ComposePort[]) => void;
  disabled?: boolean;
}

export const PortsField: React.FC<PortsFieldProps> = ({ ports, onChange, disabled }) => {
  const handleAddPort = () => {
    onChange([...ports, { mode: '', protocol: 'tcp', target: '80', published: '80' }]);
  };

  const handleRemovePort = (index: number) => {
    onChange(ports.filter((_, i) => i !== index));
  };

  const handleUpdatePort = (index: number, updates: Partial<ComposePort>) => {
    onChange(
      ports.map((port, i) => (i === index ? { ...port, ...updates, rawValue: undefined } : port))
    );
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <label className={cn('text-sm font-medium', theme.text.muted)}>Ports</label>
        <button
          type="button"
          onClick={handleAddPort}
          disabled={disabled}
          className={cn(theme.forms.compact.addButton)}
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
              className={cn('flex flex-col gap-2 p-3 rounded-lg', 'bg-zinc-50 dark:bg-zinc-800/50')}
            >
              {port.rawValue && hasEnvVars(port.rawValue) && (
                <div
                  className={cn(
                    'text-xs px-2 py-1 rounded font-mono',
                    'bg-amber-50 text-amber-700 dark:bg-amber-900/20 dark:text-amber-400'
                  )}
                >
                  Original: {port.rawValue}
                </div>
              )}
              <div className="flex items-center gap-2">
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
                        theme.forms.compact.input,
                        hasEnvVars(port.host_ip) && 'font-mono text-xs'
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
                      placeholder="8080 or ${VAR}"
                      className={cn(
                        theme.forms.compact.input,
                        hasEnvVars(port.published) && 'font-mono text-xs'
                      )}
                    />
                  </div>
                  <div>
                    <label className={cn('block text-xs mb-1', theme.text.subtle)}>Target</label>
                    <input
                      type="text"
                      value={port.target}
                      onChange={(e) => handleUpdatePort(index, { target: e.target.value })}
                      disabled={disabled}
                      placeholder="80 or ${VAR}"
                      className={cn(
                        theme.forms.compact.input,
                        hasEnvVars(port.target) && 'font-mono text-xs'
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
                      className={cn(theme.forms.compact.select)}
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
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
