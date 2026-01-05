import React, { useState } from 'react';
import {
  PlusIcon,
  TrashIcon,
  ChevronDownIcon,
  ChevronRightIcon,
} from '@heroicons/react/24/outline';
import { cn } from '../../../utils/cn';
import { theme } from '../../../theme';
import { ComposeNetworkConfig } from '../../../types/compose';

interface NetworksEditorProps {
  networks: Record<string, ComposeNetworkConfig>;
  onChange: (networks: Record<string, ComposeNetworkConfig>) => void;
  disabled?: boolean;
}

const NETWORK_DRIVERS = [
  { value: 'bridge', label: 'Bridge' },
  { value: 'overlay', label: 'Overlay' },
  { value: 'macvlan', label: 'Macvlan' },
  { value: 'ipvlan', label: 'IPvlan' },
  { value: 'host', label: 'Host' },
  { value: 'none', label: 'None' },
];

export const NetworksEditor: React.FC<NetworksEditorProps> = ({ networks, onChange, disabled }) => {
  const [expandedNetworks, setExpandedNetworks] = useState<Set<string>>(new Set());
  const [newNetworkName, setNewNetworkName] = useState('');

  const networkNames = Object.keys(networks);

  const toggleExpand = (name: string) => {
    const next = new Set(expandedNetworks);
    if (next.has(name)) {
      next.delete(name);
    } else {
      next.add(name);
    }
    setExpandedNetworks(next);
  };

  const handleAddNetwork = () => {
    if (!newNetworkName.trim()) return;
    if (networks[newNetworkName]) return;

    onChange({
      ...networks,
      [newNetworkName]: {},
    });
    setExpandedNetworks(new Set([...expandedNetworks, newNetworkName]));
    setNewNetworkName('');
  };

  const handleRemoveNetwork = (name: string) => {
    const { [name]: _, ...rest } = networks;
    onChange(rest);
    const next = new Set(expandedNetworks);
    next.delete(name);
    setExpandedNetworks(next);
  };

  const handleUpdateNetwork = (name: string, updates: Partial<ComposeNetworkConfig>) => {
    onChange({
      ...networks,
      [name]: { ...networks[name], ...updates },
    });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <input
          type="text"
          value={newNetworkName}
          onChange={(e) => setNewNetworkName(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleAddNetwork()}
          disabled={disabled}
          placeholder="New network name"
          className={cn(
            'flex-1 px-3 py-2 text-sm rounded-lg border',
            'bg-white text-zinc-900 placeholder:text-zinc-400',
            'dark:bg-zinc-900 dark:text-white dark:placeholder:text-zinc-500',
            'border-zinc-200 dark:border-zinc-700',
            'focus:border-teal-500 focus:ring-1 focus:ring-teal-500',
            'disabled:opacity-50 disabled:cursor-not-allowed'
          )}
        />
        <button
          type="button"
          onClick={handleAddNetwork}
          disabled={disabled || !newNetworkName.trim()}
          className={cn(
            'inline-flex items-center gap-1 px-3 py-2 text-sm font-medium rounded-lg',
            'bg-teal-600 text-white hover:bg-teal-700',
            'disabled:opacity-50 disabled:cursor-not-allowed'
          )}
        >
          <PlusIcon className="w-4 h-4" />
          Add Network
        </button>
      </div>

      {networkNames.length === 0 ? (
        <p className={cn('text-sm italic py-4', theme.text.muted)}>
          No networks defined. Add a network above.
        </p>
      ) : (
        <div className="space-y-2">
          {networkNames.map((name) => (
            <NetworkItem
              key={name}
              name={name}
              config={networks[name]}
              expanded={expandedNetworks.has(name)}
              onToggle={() => toggleExpand(name)}
              onChange={(updates) => handleUpdateNetwork(name, updates)}
              onRemove={() => handleRemoveNetwork(name)}
              disabled={disabled}
            />
          ))}
        </div>
      )}
    </div>
  );
};

interface NetworkItemProps {
  name: string;
  config: ComposeNetworkConfig;
  expanded: boolean;
  onToggle: () => void;
  onChange: (updates: Partial<ComposeNetworkConfig>) => void;
  onRemove: () => void;
  disabled?: boolean;
}

const NetworkItem: React.FC<NetworkItemProps> = ({
  name,
  config,
  expanded,
  onToggle,
  onChange,
  onRemove,
  disabled,
}) => {
  const handleAddIpamConfig = () => {
    const currentConfig = config.ipam?.config || [];
    onChange({
      ipam: {
        ...config.ipam,
        config: [...currentConfig, {}],
      },
    });
  };

  const handleUpdateIpamConfig = (
    index: number,
    updates: { subnet?: string; gateway?: string; ip_range?: string }
  ) => {
    const currentConfig = [...(config.ipam?.config || [])];
    currentConfig[index] = { ...currentConfig[index], ...updates };
    onChange({
      ipam: {
        ...config.ipam,
        config: currentConfig,
      },
    });
  };

  const handleRemoveIpamConfig = (index: number) => {
    const currentConfig = (config.ipam?.config || []).filter((_, i) => i !== index);
    onChange({
      ipam: {
        ...config.ipam,
        config: currentConfig.length > 0 ? currentConfig : undefined,
      },
    });
  };

  const handleAddDriverOpt = () => {
    const opts = config.driver_opts || {};
    let newKey = 'option';
    let i = 1;
    while (Object.prototype.hasOwnProperty.call(opts, newKey)) {
      newKey = `option_${i++}`;
    }
    onChange({ driver_opts: { ...opts, [newKey]: '' } });
  };

  const handleUpdateDriverOpt = (oldKey: string, newKey: string, value: string) => {
    const opts = config.driver_opts || {};
    const updated: Record<string, string> = {};
    for (const [k, v] of Object.entries(opts)) {
      if (k === oldKey) {
        updated[newKey] = value;
      } else {
        updated[k] = v;
      }
    }
    onChange({ driver_opts: Object.keys(updated).length > 0 ? updated : undefined });
  };

  const handleRemoveDriverOpt = (key: string) => {
    const { [key]: _, ...rest } = config.driver_opts || {};
    onChange({ driver_opts: Object.keys(rest).length > 0 ? rest : undefined });
  };

  const handleAddLabel = () => {
    const labels = config.labels || {};
    let newKey = 'label';
    let i = 1;
    while (Object.prototype.hasOwnProperty.call(labels, newKey)) {
      newKey = `label_${i++}`;
    }
    onChange({ labels: { ...labels, [newKey]: '' } });
  };

  const handleUpdateLabel = (oldKey: string, newKey: string, value: string) => {
    const labels = config.labels || {};
    const updated: Record<string, string> = {};
    for (const [k, v] of Object.entries(labels)) {
      if (k === oldKey) {
        updated[newKey] = value;
      } else {
        updated[k] = v;
      }
    }
    onChange({ labels: Object.keys(updated).length > 0 ? updated : undefined });
  };

  const handleRemoveLabel = (key: string) => {
    const { [key]: _, ...rest } = config.labels || {};
    onChange({ labels: Object.keys(rest).length > 0 ? rest : undefined });
  };

  return (
    <div className={cn('rounded-lg border', 'border-zinc-200 dark:border-zinc-700')}>
      <div className="flex items-center justify-between px-3 py-2">
        <button
          type="button"
          onClick={onToggle}
          className={cn(
            'flex items-center gap-2 text-sm font-medium',
            'text-zinc-700 dark:text-zinc-300',
            'hover:text-zinc-900 dark:hover:text-white'
          )}
        >
          {expanded ? (
            <ChevronDownIcon className="w-4 h-4" />
          ) : (
            <ChevronRightIcon className="w-4 h-4" />
          )}
          <span className="font-mono">{name}</span>
          {config.external && (
            <span
              className={cn(
                'text-xs px-1.5 py-0.5 rounded',
                'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'
              )}
            >
              external
            </span>
          )}
        </button>
        <button
          type="button"
          onClick={onRemove}
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

      {expanded && (
        <div className="px-3 pb-3 pt-1 space-y-4 border-t border-zinc-200 dark:border-zinc-700">
          {/* External Toggle */}
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={config.external || false}
              onChange={(e) => onChange({ external: e.target.checked || undefined })}
              disabled={disabled}
              className="rounded border-zinc-300 text-teal-600 focus:ring-teal-500"
            />
            <span className={cn('text-sm', theme.text.standard)}>External network</span>
          </label>

          {!config.external && (
            <>
              {/* Driver */}
              <div>
                <label className={cn('block text-xs mb-1', theme.text.subtle)}>Driver</label>
                <select
                  value={config.driver || ''}
                  onChange={(e) => onChange({ driver: e.target.value || undefined })}
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
                  <option value="">Default</option>
                  {NETWORK_DRIVERS.map((d) => (
                    <option key={d.value} value={d.value}>
                      {d.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Driver Options */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className={cn('text-xs font-medium', theme.text.subtle)}>
                    Driver Options
                  </label>
                  <button
                    type="button"
                    onClick={handleAddDriverOpt}
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
                {!config.driver_opts || Object.keys(config.driver_opts).length === 0 ? (
                  <p className={cn('text-sm italic', theme.text.muted)}>No driver options</p>
                ) : (
                  <div className="space-y-2">
                    {Object.entries(config.driver_opts).map(([key, value]) => (
                      <KeyValueRow
                        key={key}
                        keyValue={key}
                        value={value}
                        onUpdate={(newKey, newValue) =>
                          handleUpdateDriverOpt(key, newKey, newValue)
                        }
                        onRemove={() => handleRemoveDriverOpt(key)}
                        disabled={disabled}
                      />
                    ))}
                  </div>
                )}
              </div>

              {/* IPAM Configuration */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className={cn('text-xs font-medium', theme.text.subtle)}>
                    IPAM Configuration
                  </label>
                  <button
                    type="button"
                    onClick={handleAddIpamConfig}
                    disabled={disabled}
                    className={cn(
                      'inline-flex items-center gap-1 px-2 py-1 text-xs font-medium rounded',
                      'bg-teal-100 text-teal-700 hover:bg-teal-200',
                      'dark:bg-teal-900/30 dark:text-teal-400 dark:hover:bg-teal-900/50',
                      'disabled:opacity-50 disabled:cursor-not-allowed'
                    )}
                  >
                    <PlusIcon className="w-3 h-3" />
                    Add Subnet
                  </button>
                </div>
                {!config.ipam?.config || config.ipam.config.length === 0 ? (
                  <p className={cn('text-sm italic', theme.text.muted)}>No IPAM configuration</p>
                ) : (
                  <div className="space-y-3">
                    {config.ipam.config.map((ipamConfig, index) => (
                      <div
                        key={index}
                        className={cn(
                          'p-2 rounded border space-y-2',
                          'border-zinc-200 dark:border-zinc-700',
                          'bg-zinc-50 dark:bg-zinc-800/50'
                        )}
                      >
                        <div className="flex justify-between items-center">
                          <span className={cn('text-xs font-medium', theme.text.subtle)}>
                            Subnet {index + 1}
                          </span>
                          <button
                            type="button"
                            onClick={() => handleRemoveIpamConfig(index)}
                            disabled={disabled}
                            className={cn(
                              'p-1 rounded',
                              'text-zinc-400 hover:text-rose-500',
                              'disabled:opacity-50'
                            )}
                          >
                            <TrashIcon className="w-3 h-3" />
                          </button>
                        </div>
                        <input
                          type="text"
                          value={ipamConfig.subnet || ''}
                          onChange={(e) =>
                            handleUpdateIpamConfig(index, {
                              ...ipamConfig,
                              subnet: e.target.value || undefined,
                            })
                          }
                          disabled={disabled}
                          placeholder="Subnet (e.g., 172.28.0.0/16)"
                          className={cn(
                            'w-full px-2 py-1 text-sm rounded border font-mono',
                            'bg-white text-zinc-900 placeholder:text-zinc-400',
                            'dark:bg-zinc-900 dark:text-white dark:placeholder:text-zinc-500',
                            'border-zinc-200 dark:border-zinc-700',
                            'focus:border-teal-500 focus:ring-1 focus:ring-teal-500',
                            'disabled:opacity-50'
                          )}
                        />
                        <input
                          type="text"
                          value={ipamConfig.gateway || ''}
                          onChange={(e) =>
                            handleUpdateIpamConfig(index, {
                              ...ipamConfig,
                              gateway: e.target.value || undefined,
                            })
                          }
                          disabled={disabled}
                          placeholder="Gateway (e.g., 172.28.0.1)"
                          className={cn(
                            'w-full px-2 py-1 text-sm rounded border font-mono',
                            'bg-white text-zinc-900 placeholder:text-zinc-400',
                            'dark:bg-zinc-900 dark:text-white dark:placeholder:text-zinc-500',
                            'border-zinc-200 dark:border-zinc-700',
                            'focus:border-teal-500 focus:ring-1 focus:ring-teal-500',
                            'disabled:opacity-50'
                          )}
                        />
                        <input
                          type="text"
                          value={ipamConfig.ip_range || ''}
                          onChange={(e) =>
                            handleUpdateIpamConfig(index, {
                              ...ipamConfig,
                              ip_range: e.target.value || undefined,
                            })
                          }
                          disabled={disabled}
                          placeholder="IP Range (e.g., 172.28.5.0/24)"
                          className={cn(
                            'w-full px-2 py-1 text-sm rounded border font-mono',
                            'bg-white text-zinc-900 placeholder:text-zinc-400',
                            'dark:bg-zinc-900 dark:text-white dark:placeholder:text-zinc-500',
                            'border-zinc-200 dark:border-zinc-700',
                            'focus:border-teal-500 focus:ring-1 focus:ring-teal-500',
                            'disabled:opacity-50'
                          )}
                        />
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Labels */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className={cn('text-xs font-medium', theme.text.subtle)}>Labels</label>
                  <button
                    type="button"
                    onClick={handleAddLabel}
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
                {!config.labels || Object.keys(config.labels).length === 0 ? (
                  <p className={cn('text-sm italic', theme.text.muted)}>No labels</p>
                ) : (
                  <div className="space-y-2">
                    {Object.entries(config.labels).map(([key, value]) => (
                      <KeyValueRow
                        key={key}
                        keyValue={key}
                        value={value}
                        onUpdate={(newKey, newValue) => handleUpdateLabel(key, newKey, newValue)}
                        onRemove={() => handleRemoveLabel(key)}
                        disabled={disabled}
                      />
                    ))}
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
};

interface KeyValueRowProps {
  keyValue: string;
  value: string;
  onUpdate: (key: string, value: string) => void;
  onRemove: () => void;
  disabled?: boolean;
}

const KeyValueRow: React.FC<KeyValueRowProps> = ({
  keyValue,
  value,
  onUpdate,
  onRemove,
  disabled,
}) => (
  <div className="flex items-center gap-2">
    <input
      type="text"
      value={keyValue}
      onChange={(e) => onUpdate(e.target.value, value)}
      disabled={disabled}
      placeholder="key"
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
      onChange={(e) => onUpdate(keyValue, e.target.value)}
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
      onClick={onRemove}
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
