import React, { useState } from 'react';
import {
  PlusIcon,
  TrashIcon,
  ChevronDownIcon,
  ChevronRightIcon,
} from '@heroicons/react/24/outline';
import { cn } from '../../../utils/cn';
import { theme } from '../../../theme';
import { ComposeSecretConfig, ComposeConfigConfig } from '../../../types/compose';

type ResourceConfig = ComposeSecretConfig | ComposeConfigConfig;

interface SecretsConfigsEditorProps {
  resources: Record<string, ResourceConfig>;
  onChange: (resources: Record<string, ResourceConfig>) => void;
  resourceType: 'secrets' | 'configs';
  disabled?: boolean;
}

const SOURCE_TYPES = [
  { value: 'file', label: 'File' },
  { value: 'environment', label: 'Environment Variable' },
  { value: 'external', label: 'External' },
];

export const SecretsConfigsEditor: React.FC<SecretsConfigsEditorProps> = ({
  resources,
  onChange,
  resourceType,
  disabled,
}) => {
  const [expandedResources, setExpandedResources] = useState<Set<string>>(new Set());
  const [newResourceName, setNewResourceName] = useState('');

  const resourceNames = Object.keys(resources);
  const singularType = resourceType === 'secrets' ? 'secret' : 'config';
  const capitalizedType = resourceType === 'secrets' ? 'Secret' : 'Config';

  const toggleExpand = (name: string) => {
    const next = new Set(expandedResources);
    if (next.has(name)) {
      next.delete(name);
    } else {
      next.add(name);
    }
    setExpandedResources(next);
  };

  const handleAddResource = () => {
    if (!newResourceName.trim()) return;
    if (resources[newResourceName]) return;

    onChange({
      ...resources,
      [newResourceName]: {},
    });
    setExpandedResources(new Set([...expandedResources, newResourceName]));
    setNewResourceName('');
  };

  const handleRemoveResource = (name: string) => {
    const { [name]: _, ...rest } = resources;
    onChange(rest);
    const next = new Set(expandedResources);
    next.delete(name);
    setExpandedResources(next);
  };

  const handleUpdateResource = (name: string, updates: Partial<ResourceConfig>) => {
    onChange({
      ...resources,
      [name]: { ...resources[name], ...updates },
    });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <input
          type="text"
          value={newResourceName}
          onChange={(e) => setNewResourceName(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleAddResource()}
          disabled={disabled}
          placeholder={`New ${singularType} name`}
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
          onClick={handleAddResource}
          disabled={disabled || !newResourceName.trim()}
          className={cn(
            'inline-flex items-center gap-1 px-3 py-2 text-sm font-medium rounded-lg',
            'bg-teal-600 text-white hover:bg-teal-700',
            'disabled:opacity-50 disabled:cursor-not-allowed'
          )}
        >
          <PlusIcon className="w-4 h-4" />
          Add {capitalizedType}
        </button>
      </div>

      {resourceNames.length === 0 ? (
        <p className={cn('text-sm italic py-4', theme.text.muted)}>
          No {resourceType} defined. Add a {singularType} above.
        </p>
      ) : (
        <div className="space-y-2">
          {resourceNames.map((name) => (
            <ResourceItem
              key={name}
              name={name}
              config={resources[name]}
              expanded={expandedResources.has(name)}
              onToggle={() => toggleExpand(name)}
              onChange={(updates) => handleUpdateResource(name, updates)}
              onRemove={() => handleRemoveResource(name)}
              resourceType={resourceType}
              disabled={disabled}
            />
          ))}
        </div>
      )}
    </div>
  );
};

interface ResourceItemProps {
  name: string;
  config: ResourceConfig;
  expanded: boolean;
  onToggle: () => void;
  onChange: (updates: Partial<ResourceConfig>) => void;
  onRemove: () => void;
  resourceType: 'secrets' | 'configs';
  disabled?: boolean;
}

const ResourceItem: React.FC<ResourceItemProps> = ({
  name,
  config,
  expanded,
  onToggle,
  onChange,
  onRemove,
  resourceType,
  disabled,
}) => {
  const getSourceType = (): string => {
    if (config.external) return 'external';
    if (config.environment) return 'environment';
    if (config.file) return 'file';
    return 'file';
  };

  const handleSourceTypeChange = (newType: string) => {
    if (newType === 'external') {
      onChange({ external: true, file: undefined, environment: undefined });
    } else if (newType === 'environment') {
      onChange({ external: undefined, file: undefined, environment: '' });
    } else {
      onChange({ external: undefined, file: '', environment: undefined });
    }
  };

  const sourceType = getSourceType();

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
          {config.file && (
            <span
              className={cn(
                'text-xs px-1.5 py-0.5 rounded',
                'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
              )}
            >
              file
            </span>
          )}
          {config.environment && (
            <span
              className={cn(
                'text-xs px-1.5 py-0.5 rounded',
                'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
              )}
            >
              env
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
          {/* Source Type Selector */}
          <div>
            <label className={cn('block text-xs mb-1', theme.text.subtle)}>Source Type</label>
            <select
              value={sourceType}
              onChange={(e) => handleSourceTypeChange(e.target.value)}
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
              {SOURCE_TYPES.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
          </div>

          {/* File Input */}
          {sourceType === 'file' && (
            <div>
              <label className={cn('block text-xs mb-1', theme.text.subtle)}>File Path</label>
              <input
                type="text"
                value={config.file || ''}
                onChange={(e) => onChange({ file: e.target.value || undefined })}
                disabled={disabled}
                placeholder={`./my_${resourceType === 'secrets' ? 'secret' : 'config'}.txt`}
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
                Path relative to the compose file location
              </p>
            </div>
          )}

          {/* Environment Variable Input */}
          {sourceType === 'environment' && (
            <div>
              <label className={cn('block text-xs mb-1', theme.text.subtle)}>
                Environment Variable Name
              </label>
              <input
                type="text"
                value={config.environment || ''}
                onChange={(e) => onChange({ environment: e.target.value || undefined })}
                disabled={disabled}
                placeholder="MY_SECRET_VAR"
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
                The {resourceType === 'secrets' ? 'secret' : 'config'} value will be read from this
                environment variable
              </p>
            </div>
          )}

          {/* External Name */}
          {sourceType === 'external' && (
            <div>
              <label className={cn('block text-xs mb-1', theme.text.subtle)}>
                External Name (optional)
              </label>
              <input
                type="text"
                value={config.name || ''}
                onChange={(e) => onChange({ name: e.target.value || undefined })}
                disabled={disabled}
                placeholder={name}
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
                If the external {resourceType === 'secrets' ? 'secret' : 'config'} has a different
                name, specify it here
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
