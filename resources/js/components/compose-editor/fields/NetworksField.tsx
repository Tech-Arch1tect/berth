import React, { useState } from 'react';
import {
  PlusIcon,
  TrashIcon,
  ChevronDownIcon,
  ChevronRightIcon,
} from '@heroicons/react/24/outline';
import { cn } from '../../../utils/cn';
import { theme } from '../../../theme';
import { ServiceNetworkConfig } from '../../../types/compose';

interface NetworksFieldProps {
  networks: Record<string, ServiceNetworkConfig | null>;
  availableNetworks: string[];
  onChange: (networks: Record<string, ServiceNetworkConfig | null>) => void;
  disabled?: boolean;
}

export const NetworksField: React.FC<NetworksFieldProps> = ({
  networks,
  availableNetworks,
  onChange,
  disabled,
}) => {
  const [expandedNetworks, setExpandedNetworks] = useState<Set<string>>(new Set());

  const connectedNetworks = Object.keys(networks).filter((n) => networks[n] !== null);
  const disconnectedNetworks = availableNetworks.filter((n) => !connectedNetworks.includes(n));

  const toggleExpand = (name: string) => {
    const next = new Set(expandedNetworks);
    if (next.has(name)) {
      next.delete(name);
    } else {
      next.add(name);
    }
    setExpandedNetworks(next);
  };

  const handleConnect = (networkName: string) => {
    onChange({ ...networks, [networkName]: {} });
    setExpandedNetworks(new Set([...expandedNetworks, networkName]));
  };

  const handleDisconnect = (networkName: string) => {
    const { [networkName]: _, ...rest } = networks;
    onChange(rest);
    const next = new Set(expandedNetworks);
    next.delete(networkName);
    setExpandedNetworks(next);
  };

  const handleUpdateConfig = (networkName: string, config: ServiceNetworkConfig) => {
    onChange({ ...networks, [networkName]: config });
  };

  const handleAddAlias = (networkName: string) => {
    const config = networks[networkName] || {};
    const aliases = [...(config.aliases || []), ''];
    handleUpdateConfig(networkName, { ...config, aliases });
  };

  const handleUpdateAlias = (networkName: string, index: number, value: string) => {
    const config = networks[networkName] || {};
    const aliases = [...(config.aliases || [])];
    aliases[index] = value;
    handleUpdateConfig(networkName, { ...config, aliases });
  };

  const handleRemoveAlias = (networkName: string, index: number) => {
    const config = networks[networkName] || {};
    const aliases = (config.aliases || []).filter((_, i) => i !== index);
    handleUpdateConfig(networkName, {
      ...config,
      aliases: aliases.length > 0 ? aliases : undefined,
    });
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <label className={cn('text-sm font-medium', theme.text.muted)}>Networks</label>
        {disconnectedNetworks.length > 0 && (
          <select
            onChange={(e) => {
              if (e.target.value) {
                handleConnect(e.target.value);
                e.target.value = '';
              }
            }}
            disabled={disabled}
            className={cn(theme.forms.compact.selectSmall)}
            defaultValue=""
          >
            <option value="" disabled>
              + Connect network
            </option>
            {disconnectedNetworks.map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
          </select>
        )}
      </div>

      {connectedNetworks.length === 0 ? (
        <p className={cn('text-sm italic py-2', theme.text.muted)}>
          {availableNetworks.length === 0
            ? 'No networks defined. Create networks in the Networks tab first.'
            : 'Not connected to any networks. Use the dropdown above to connect.'}
        </p>
      ) : (
        <div className="space-y-2">
          {connectedNetworks.map((networkName) => {
            const config = networks[networkName] || {};
            const isExpanded = expandedNetworks.has(networkName);

            return (
              <div
                key={networkName}
                className={cn('rounded-lg border', 'border-zinc-200 dark:border-zinc-700')}
              >
                <div className="flex items-center justify-between px-3 py-2">
                  <button
                    type="button"
                    onClick={() => toggleExpand(networkName)}
                    className={cn(
                      'flex items-center gap-2 text-sm font-medium',
                      'text-zinc-700 dark:text-zinc-300',
                      'hover:text-zinc-900 dark:hover:text-white'
                    )}
                  >
                    {isExpanded ? (
                      <ChevronDownIcon className="w-4 h-4" />
                    ) : (
                      <ChevronRightIcon className="w-4 h-4" />
                    )}
                    <span className="font-mono">{networkName}</span>
                    {config.aliases && config.aliases.length > 0 && (
                      <span
                        className={cn(
                          'text-xs px-1.5 py-0.5 rounded',
                          'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
                        )}
                      >
                        {config.aliases.length} alias{config.aliases.length > 1 ? 'es' : ''}
                      </span>
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDisconnect(networkName)}
                    disabled={disabled}
                    className={cn(
                      'p-1.5 rounded',
                      'text-zinc-400 hover:text-rose-500 hover:bg-rose-50',
                      'dark:hover:bg-rose-900/20',
                      'disabled:opacity-50 disabled:cursor-not-allowed'
                    )}
                    title="Disconnect from network"
                  >
                    <TrashIcon className="w-4 h-4" />
                  </button>
                </div>

                {isExpanded && (
                  <div className="px-3 pb-3 pt-1 space-y-4 border-t border-zinc-200 dark:border-zinc-700">
                    {/* Aliases */}
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <label className={cn('text-xs font-medium', theme.text.subtle)}>
                          Aliases
                        </label>
                        <button
                          type="button"
                          onClick={() => handleAddAlias(networkName)}
                          disabled={disabled}
                          className={cn(
                            'inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded',
                            'bg-teal-100 text-teal-700 hover:bg-teal-200',
                            'dark:bg-teal-900/30 dark:text-teal-400 dark:hover:bg-teal-900/50',
                            'disabled:opacity-50 disabled:cursor-not-allowed'
                          )}
                        >
                          <PlusIcon className="w-3 h-3" />
                          Add
                        </button>
                      </div>
                      {!config.aliases || config.aliases.length === 0 ? (
                        <p className={cn('text-xs italic', theme.text.muted)}>
                          No aliases. Service is accessible by its name.
                        </p>
                      ) : (
                        <div className="space-y-1">
                          {config.aliases.map((alias, index) => (
                            <div key={index} className="flex items-center gap-2">
                              <input
                                type="text"
                                value={alias}
                                onChange={(e) =>
                                  handleUpdateAlias(networkName, index, e.target.value)
                                }
                                disabled={disabled}
                                placeholder="alias"
                                className={cn(
                                  'flex-1 px-2 py-1 text-sm rounded border font-mono',
                                  'bg-white text-zinc-900 placeholder:text-zinc-400',
                                  'dark:bg-zinc-900 dark:text-white dark:placeholder:text-zinc-500',
                                  'border-zinc-200 dark:border-zinc-700',
                                  'focus:border-teal-500 focus:ring-1 focus:ring-teal-500',
                                  'disabled:opacity-50 disabled:cursor-not-allowed'
                                )}
                              />
                              <button
                                type="button"
                                onClick={() => handleRemoveAlias(networkName, index)}
                                disabled={disabled}
                                className={cn(
                                  'p-1 rounded',
                                  'text-zinc-400 hover:text-rose-500 hover:bg-rose-50',
                                  'dark:hover:bg-rose-900/20',
                                  'disabled:opacity-50 disabled:cursor-not-allowed'
                                )}
                              >
                                <TrashIcon className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* IPv4 Address */}
                    <div>
                      <label className={cn('block text-xs font-medium mb-1', theme.text.subtle)}>
                        IPv4 Address (optional)
                      </label>
                      <input
                        type="text"
                        value={config.ipv4_address || ''}
                        onChange={(e) =>
                          handleUpdateConfig(networkName, {
                            ...config,
                            ipv4_address: e.target.value || undefined,
                          })
                        }
                        disabled={disabled}
                        placeholder="e.g., 172.20.0.10"
                        className={cn(
                          'w-full px-2 py-1 text-sm rounded border font-mono',
                          'bg-white text-zinc-900 placeholder:text-zinc-400',
                          'dark:bg-zinc-900 dark:text-white dark:placeholder:text-zinc-500',
                          'border-zinc-200 dark:border-zinc-700',
                          'focus:border-teal-500 focus:ring-1 focus:ring-teal-500',
                          'disabled:opacity-50 disabled:cursor-not-allowed'
                        )}
                      />
                      <p className={cn('text-xs mt-1', theme.text.subtle)}>
                        Requires network with IPAM subnet configuration
                      </p>
                    </div>

                    {/* IPv6 Address */}
                    <div>
                      <label className={cn('block text-xs font-medium mb-1', theme.text.subtle)}>
                        IPv6 Address (optional)
                      </label>
                      <input
                        type="text"
                        value={config.ipv6_address || ''}
                        onChange={(e) =>
                          handleUpdateConfig(networkName, {
                            ...config,
                            ipv6_address: e.target.value || undefined,
                          })
                        }
                        disabled={disabled}
                        placeholder="e.g., 2001:db8::10"
                        className={cn(
                          'w-full px-2 py-1 text-sm rounded border font-mono',
                          'bg-white text-zinc-900 placeholder:text-zinc-400',
                          'dark:bg-zinc-900 dark:text-white dark:placeholder:text-zinc-500',
                          'border-zinc-200 dark:border-zinc-700',
                          'focus:border-teal-500 focus:ring-1 focus:ring-teal-500',
                          'disabled:opacity-50 disabled:cursor-not-allowed'
                        )}
                      />
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
