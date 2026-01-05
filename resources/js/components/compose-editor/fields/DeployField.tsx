import React, { useState } from 'react';
import {
  ChevronDownIcon,
  ChevronRightIcon,
  PlusIcon,
  TrashIcon,
} from '@heroicons/react/24/outline';
import { cn } from '../../../utils/cn';
import { theme } from '../../../theme';
import { DeployChange, UpdateRollbackConfig } from '../../../types/compose';
import { DurationInput } from '../primitives/DurationInput';
import { MemorySizeInput } from '../primitives/MemorySizeInput';

interface DeployFieldProps {
  deploy: DeployChange | null;
  onChange: (deploy: DeployChange | null) => void;
  disabled?: boolean;
}

const MODES = [
  { value: 'replicated', label: 'Replicated' },
  { value: 'global', label: 'Global' },
];

const RESTART_CONDITIONS = [
  { value: 'none', label: 'None' },
  { value: 'on-failure', label: 'On Failure' },
  { value: 'any', label: 'Any' },
];

const FAILURE_ACTIONS = [
  { value: 'pause', label: 'Pause' },
  { value: 'continue', label: 'Continue' },
  { value: 'rollback', label: 'Rollback' },
];

const UPDATE_ORDERS = [
  { value: 'stop-first', label: 'Stop First' },
  { value: 'start-first', label: 'Start First' },
];

export const DeployField: React.FC<DeployFieldProps> = ({ deploy, onChange, disabled }) => {
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set(['mode']));

  const toggleSection = (section: string) => {
    const next = new Set(expandedSections);
    if (next.has(section)) {
      next.delete(section);
    } else {
      next.add(section);
    }
    setExpandedSections(next);
  };

  const handleUpdate = (updates: Partial<DeployChange>) => {
    onChange({ ...deploy, ...updates });
  };

  const handleClear = () => {
    onChange(null);
  };

  const hasAnyConfig = deploy !== null && Object.keys(deploy).length > 0;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <label className={cn('text-sm font-medium', theme.text.muted)}>Deploy Configuration</label>
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

      <div className="space-y-2">
        {/* Mode & Replicas Section */}
        <CollapsibleSection
          title="Mode & Replicas"
          expanded={expandedSections.has('mode')}
          onToggle={() => toggleSection('mode')}
        >
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={cn('block text-xs mb-1', theme.text.subtle)}>Mode</label>
              <select
                value={deploy?.mode || 'replicated'}
                onChange={(e) => handleUpdate({ mode: e.target.value })}
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
                {MODES.map((m) => (
                  <option key={m.value} value={m.value}>
                    {m.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className={cn('block text-xs mb-1', theme.text.subtle)}>Replicas</label>
              <input
                type="number"
                value={deploy?.replicas ?? ''}
                onChange={(e) =>
                  handleUpdate({
                    replicas: e.target.value ? parseInt(e.target.value) : undefined,
                  })
                }
                disabled={disabled || deploy?.mode === 'global'}
                placeholder="1"
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
          </div>
        </CollapsibleSection>

        {/* Resources Section */}
        <CollapsibleSection
          title="Resources"
          expanded={expandedSections.has('resources')}
          onToggle={() => toggleSection('resources')}
        >
          <div className="space-y-3">
            <div>
              <label className={cn('block text-xs mb-2 font-medium', theme.text.subtle)}>
                Limits
              </label>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={cn('block text-xs mb-1', theme.text.subtle)}>CPUs</label>
                  <input
                    type="text"
                    value={deploy?.resources?.limits?.cpus || ''}
                    onChange={(e) =>
                      handleUpdate({
                        resources: {
                          ...deploy?.resources,
                          limits: {
                            ...deploy?.resources?.limits,
                            cpus: e.target.value || undefined,
                          },
                        },
                      })
                    }
                    disabled={disabled}
                    placeholder="0.5"
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
                <MemorySizeInput
                  label="Memory"
                  value={deploy?.resources?.limits?.memory}
                  onChange={(memory) =>
                    handleUpdate({
                      resources: {
                        ...deploy?.resources,
                        limits: { ...deploy?.resources?.limits, memory },
                      },
                    })
                  }
                  disabled={disabled}
                  placeholder="512"
                />
              </div>
            </div>
            <div>
              <label className={cn('block text-xs mb-2 font-medium', theme.text.subtle)}>
                Reservations
              </label>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={cn('block text-xs mb-1', theme.text.subtle)}>CPUs</label>
                  <input
                    type="text"
                    value={deploy?.resources?.reservations?.cpus || ''}
                    onChange={(e) =>
                      handleUpdate({
                        resources: {
                          ...deploy?.resources,
                          reservations: {
                            ...deploy?.resources?.reservations,
                            cpus: e.target.value || undefined,
                          },
                        },
                      })
                    }
                    disabled={disabled}
                    placeholder="0.25"
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
                <MemorySizeInput
                  label="Memory"
                  value={deploy?.resources?.reservations?.memory}
                  onChange={(memory) =>
                    handleUpdate({
                      resources: {
                        ...deploy?.resources,
                        reservations: { ...deploy?.resources?.reservations, memory },
                      },
                    })
                  }
                  disabled={disabled}
                  placeholder="256"
                />
              </div>
            </div>
          </div>
        </CollapsibleSection>

        {/* Restart Policy Section */}
        <CollapsibleSection
          title="Restart Policy"
          expanded={expandedSections.has('restart')}
          onToggle={() => toggleSection('restart')}
        >
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={cn('block text-xs mb-1', theme.text.subtle)}>Condition</label>
              <select
                value={deploy?.restart_policy?.condition || ''}
                onChange={(e) =>
                  handleUpdate({
                    restart_policy: {
                      ...deploy?.restart_policy,
                      condition: e.target.value || undefined,
                    },
                  })
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
                <option value="">Default</option>
                {RESTART_CONDITIONS.map((c) => (
                  <option key={c.value} value={c.value}>
                    {c.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className={cn('block text-xs mb-1', theme.text.subtle)}>Max Attempts</label>
              <input
                type="number"
                value={deploy?.restart_policy?.max_attempts ?? ''}
                onChange={(e) =>
                  handleUpdate({
                    restart_policy: {
                      ...deploy?.restart_policy,
                      max_attempts: e.target.value ? parseInt(e.target.value) : undefined,
                    },
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
            <DurationInput
              label="Delay"
              value={deploy?.restart_policy?.delay}
              onChange={(delay) =>
                handleUpdate({
                  restart_policy: { ...deploy?.restart_policy, delay },
                })
              }
              disabled={disabled}
              allowedUnits={['ms', 's', 'm']}
            />
            <DurationInput
              label="Window"
              value={deploy?.restart_policy?.window}
              onChange={(window) =>
                handleUpdate({
                  restart_policy: { ...deploy?.restart_policy, window },
                })
              }
              disabled={disabled}
              allowedUnits={['s', 'm', 'h']}
            />
          </div>
        </CollapsibleSection>

        {/* Placement Constraints Section */}
        <CollapsibleSection
          title="Placement Constraints"
          expanded={expandedSections.has('placement')}
          onToggle={() => toggleSection('placement')}
        >
          <ConstraintsList
            constraints={deploy?.placement?.constraints || []}
            onChange={(constraints) =>
              handleUpdate({
                placement: {
                  ...deploy?.placement,
                  constraints: constraints.length > 0 ? constraints : undefined,
                },
              })
            }
            disabled={disabled}
          />
        </CollapsibleSection>

        {/* Placement Preferences Section */}
        <CollapsibleSection
          title="Placement Preferences"
          expanded={expandedSections.has('preferences')}
          onToggle={() => toggleSection('preferences')}
        >
          <PreferencesList
            preferences={deploy?.placement?.preferences || []}
            onChange={(preferences) =>
              handleUpdate({
                placement: {
                  ...deploy?.placement,
                  preferences: preferences.length > 0 ? preferences : undefined,
                },
              })
            }
            disabled={disabled}
          />
        </CollapsibleSection>

        {/* Update Config Section */}
        <CollapsibleSection
          title="Update Config"
          expanded={expandedSections.has('update')}
          onToggle={() => toggleSection('update')}
        >
          <UpdateRollbackConfigEditor
            config={deploy?.update_config || null}
            onChange={(update_config) =>
              handleUpdate({ update_config: update_config || undefined })
            }
            disabled={disabled}
          />
        </CollapsibleSection>

        {/* Rollback Config Section */}
        <CollapsibleSection
          title="Rollback Config"
          expanded={expandedSections.has('rollback')}
          onToggle={() => toggleSection('rollback')}
        >
          <UpdateRollbackConfigEditor
            config={deploy?.rollback_config || null}
            onChange={(rollback_config) =>
              handleUpdate({ rollback_config: rollback_config || undefined })
            }
            disabled={disabled}
          />
        </CollapsibleSection>
      </div>
    </div>
  );
};

interface CollapsibleSectionProps {
  title: string;
  expanded: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}

const CollapsibleSection: React.FC<CollapsibleSectionProps> = ({
  title,
  expanded,
  onToggle,
  children,
}) => (
  <div className={cn('rounded-lg border', 'border-zinc-200 dark:border-zinc-700')}>
    <button
      type="button"
      onClick={onToggle}
      className={cn(
        'w-full flex items-center gap-2 px-3 py-2 text-sm font-medium text-left',
        'text-zinc-700 dark:text-zinc-300',
        'hover:bg-zinc-50 dark:hover:bg-zinc-800/50',
        'rounded-lg transition-colors'
      )}
    >
      {expanded ? (
        <ChevronDownIcon className="w-4 h-4" />
      ) : (
        <ChevronRightIcon className="w-4 h-4" />
      )}
      {title}
    </button>
    {expanded && <div className="px-3 pb-3">{children}</div>}
  </div>
);

interface ConstraintsListProps {
  constraints: string[];
  onChange: (constraints: string[]) => void;
  disabled?: boolean;
}

const ConstraintsList: React.FC<ConstraintsListProps> = ({ constraints, onChange, disabled }) => {
  const handleAdd = () => {
    onChange([...constraints, '']);
  };

  const handleRemove = (index: number) => {
    onChange(constraints.filter((_, i) => i !== index));
  };

  const handleUpdate = (index: number, value: string) => {
    const updated = [...constraints];
    updated[index] = value;
    onChange(updated);
  };

  return (
    <div className="space-y-2">
      {constraints.length === 0 ? (
        <p className={cn('text-sm italic', theme.text.muted)}>No placement constraints</p>
      ) : (
        constraints.map((constraint, index) => (
          <div key={index} className="flex items-center gap-2">
            <input
              type="text"
              value={constraint}
              onChange={(e) => handleUpdate(index, e.target.value)}
              disabled={disabled}
              placeholder="node.role==manager"
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
              onClick={() => handleRemove(index)}
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
        ))
      )}
      <button
        type="button"
        onClick={handleAdd}
        disabled={disabled}
        className={cn(
          'inline-flex items-center gap-1 px-2 py-1 text-xs font-medium rounded',
          'bg-teal-100 text-teal-700 hover:bg-teal-200',
          'dark:bg-teal-900/30 dark:text-teal-400 dark:hover:bg-teal-900/50',
          'disabled:opacity-50 disabled:cursor-not-allowed'
        )}
      >
        <PlusIcon className="w-3 h-3" />
        Add Constraint
      </button>
    </div>
  );
};

interface PreferencesListProps {
  preferences: { spread: string }[];
  onChange: (preferences: { spread: string }[]) => void;
  disabled?: boolean;
}

const PreferencesList: React.FC<PreferencesListProps> = ({ preferences, onChange, disabled }) => {
  const handleAdd = () => {
    onChange([...preferences, { spread: '' }]);
  };

  const handleRemove = (index: number) => {
    onChange(preferences.filter((_, i) => i !== index));
  };

  const handleUpdate = (index: number, value: string) => {
    const updated = [...preferences];
    updated[index] = { spread: value };
    onChange(updated);
  };

  return (
    <div className="space-y-2">
      {preferences.length === 0 ? (
        <p className={cn('text-sm italic', theme.text.muted)}>No placement preferences</p>
      ) : (
        preferences.map((pref, index) => (
          <div key={index} className="flex items-center gap-2">
            <span className={cn('text-xs shrink-0', theme.text.subtle)}>spread:</span>
            <input
              type="text"
              value={pref.spread}
              onChange={(e) => handleUpdate(index, e.target.value)}
              disabled={disabled}
              placeholder="node.labels.zone"
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
              onClick={() => handleRemove(index)}
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
        ))
      )}
      <button
        type="button"
        onClick={handleAdd}
        disabled={disabled}
        className={cn(
          'inline-flex items-center gap-1 px-2 py-1 text-xs font-medium rounded',
          'bg-teal-100 text-teal-700 hover:bg-teal-200',
          'dark:bg-teal-900/30 dark:text-teal-400 dark:hover:bg-teal-900/50',
          'disabled:opacity-50 disabled:cursor-not-allowed'
        )}
      >
        <PlusIcon className="w-3 h-3" />
        Add Preference
      </button>
    </div>
  );
};

interface UpdateRollbackConfigEditorProps {
  config: UpdateRollbackConfig | null;
  onChange: (config: UpdateRollbackConfig | null) => void;
  disabled?: boolean;
}

const UpdateRollbackConfigEditor: React.FC<UpdateRollbackConfigEditorProps> = ({
  config,
  onChange,
  disabled,
}) => {
  const handleUpdate = (updates: Partial<UpdateRollbackConfig>) => {
    const newConfig = { ...config, ...updates };
    const hasValues = Object.values(newConfig).some((v) => v !== undefined);
    onChange(hasValues ? newConfig : null);
  };

  return (
    <div className="grid grid-cols-2 gap-3">
      <div>
        <label className={cn('block text-xs mb-1', theme.text.subtle)}>Parallelism</label>
        <input
          type="number"
          value={config?.parallelism ?? ''}
          onChange={(e) =>
            handleUpdate({
              parallelism: e.target.value ? parseInt(e.target.value) : undefined,
            })
          }
          disabled={disabled}
          placeholder="1"
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
      <DurationInput
        label="Delay"
        value={config?.delay}
        onChange={(delay) => handleUpdate({ delay })}
        disabled={disabled}
        allowedUnits={['ms', 's', 'm']}
      />
      <div>
        <label className={cn('block text-xs mb-1', theme.text.subtle)}>Failure Action</label>
        <select
          value={config?.failure_action || ''}
          onChange={(e) => handleUpdate({ failure_action: e.target.value || undefined })}
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
          {FAILURE_ACTIONS.map((a) => (
            <option key={a.value} value={a.value}>
              {a.label}
            </option>
          ))}
        </select>
      </div>
      <DurationInput
        label="Monitor"
        value={config?.monitor}
        onChange={(monitor) => handleUpdate({ monitor })}
        disabled={disabled}
        allowedUnits={['s', 'm']}
      />
      <div>
        <label className={cn('block text-xs mb-1', theme.text.subtle)}>Max Failure Ratio</label>
        <input
          type="number"
          value={config?.max_failure_ratio ?? ''}
          onChange={(e) =>
            handleUpdate({
              max_failure_ratio: e.target.value ? parseFloat(e.target.value) : undefined,
            })
          }
          disabled={disabled}
          placeholder="0"
          min={0}
          max={1}
          step={0.1}
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
        <label className={cn('block text-xs mb-1', theme.text.subtle)}>Order</label>
        <select
          value={config?.order || ''}
          onChange={(e) => handleUpdate({ order: e.target.value || undefined })}
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
          {UPDATE_ORDERS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
};
