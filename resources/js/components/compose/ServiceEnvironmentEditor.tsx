import React, { useState, useEffect } from 'react';
import { ComposeService } from '../../types/stack';
import { useStackEnvironmentVariables } from '../../hooks/useStackEnvironmentVariables';
import {
  ArrowLeftIcon,
  CheckIcon,
  PlusIcon,
  TrashIcon,
  EyeIcon,
  EyeSlashIcon,
} from '@heroicons/react/24/outline';
import { cn } from '../../utils/cn';
import { theme } from '../../theme';

interface ServiceEnvironmentEditorProps {
  service: ComposeService;
  serverid: number;
  stackname: string;
  onUpdate: (serviceName: string, variables?: Record<string, string>, remove?: string[]) => void;
  onBack: () => void;
}

export const ServiceEnvironmentEditor: React.FC<ServiceEnvironmentEditorProps> = ({
  service,
  serverid,
  stackname,
  onUpdate,
  onBack,
}) => {
  const { data: envData, isLoading } = useStackEnvironmentVariables({
    serverid,
    stackname,
  });

  const [variables, setVariables] = useState<Record<string, string>>({});
  const [toRemove, setToRemove] = useState<Set<string>>(new Set());
  const [newKey, setNewKey] = useState('');
  const [newValue, setNewValue] = useState('');
  const [showValues, setShowValues] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (envData && envData[service.name]) {
      const serviceEnv = envData[service.name][0];
      if (serviceEnv) {
        const vars: Record<string, string> = {};
        serviceEnv.variables.forEach((v) => {
          vars[v.key] = v.value;
        });
        setVariables(vars);
      }
    }
  }, [envData, service.name]);

  const handleAddNew = () => {
    if (newKey.trim() && newValue.trim()) {
      setVariables((prev) => ({
        ...prev,
        [newKey.trim()]: newValue.trim(),
      }));
      setNewKey('');
      setNewValue('');
      // Remove from toRemove if it was marked for removal
      setToRemove((prev) => {
        const next = new Set(prev);
        next.delete(newKey.trim());
        return next;
      });
    }
  };

  const handleUpdate = (key: string, value: string) => {
    setVariables((prev) => ({
      ...prev,
      [key]: value,
    }));
  };

  const handleRemove = (key: string) => {
    setToRemove((prev) => new Set(prev).add(key));
    setVariables((prev) => {
      const next = { ...prev };
      delete next[key];
      return next;
    });
  };

  const toggleShowValue = (key: string) => {
    setShowValues((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  };

  const handleApply = () => {
    const updates = Object.entries(variables).reduce(
      (acc, [key, value]) => {
        acc[key] = value;
        return acc;
      },
      {} as Record<string, string>
    );

    onUpdate(
      service.name,
      Object.keys(updates).length > 0 ? updates : undefined,
      toRemove.size > 0 ? Array.from(toRemove) : undefined
    );
    onBack();
  };

  const isSensitive = (key: string) => {
    const sensitiveKeywords = ['password', 'secret', 'token', 'key', 'api_key', 'auth'];
    return sensitiveKeywords.some((keyword) => key.toLowerCase().includes(keyword));
  };

  return (
    <div className="p-8">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <button
          onClick={onBack}
          className={cn(
            'flex items-center gap-2 transition-colors mb-6',
            theme.text.muted,
            'hover:' + theme.text.strong
          )}
        >
          <ArrowLeftIcon className="h-5 w-5" />
          Back
        </button>

        <div className="mb-8">
          <h3 className={cn('text-2xl font-bold mb-2', theme.text.strong)}>
            Environment Variables
          </h3>
          <p className={theme.text.muted}>
            Service: <span className="font-semibold">{service.name}</span>
          </p>
        </div>

        {/* Add New Variable */}
        <div className="mb-6 p-6 rounded-xl bg-gradient-to-br from-emerald-50 to-teal-50 dark:from-emerald-900/20 dark:to-teal-900/20 border border-emerald-200 dark:border-emerald-800">
          <h4 className="text-sm font-semibold text-emerald-900 dark:text-emerald-300 mb-4">
            Add New Variable
          </h4>
          <div className="grid grid-cols-2 gap-3">
            <input
              type="text"
              value={newKey}
              onChange={(e) => setNewKey(e.target.value)}
              placeholder="Variable name (e.g., API_KEY)"
              className={cn(
                'px-4 py-2 rounded-lg border border-emerald-300 dark:border-emerald-700 focus:ring-2 focus:ring-emerald-500 focus:border-transparent',
                theme.forms.input
              )}
              onKeyPress={(e) => e.key === 'Enter' && handleAddNew()}
            />
            <div className="flex gap-2">
              <input
                type="text"
                value={newValue}
                onChange={(e) => setNewValue(e.target.value)}
                placeholder="Value"
                className={cn(
                  'flex-1 px-4 py-2 rounded-lg border border-emerald-300 dark:border-emerald-700 focus:ring-2 focus:ring-emerald-500 focus:border-transparent',
                  theme.forms.input
                )}
                onKeyPress={(e) => e.key === 'Enter' && handleAddNew()}
              />
              <button
                onClick={handleAddNew}
                disabled={!newKey.trim() || !newValue.trim()}
                className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <PlusIcon className="h-5 w-5" />
              </button>
            </div>
          </div>
        </div>

        {/* Existing Variables */}
        <div className="space-y-3">
          {isLoading ? (
            <div className={cn('text-center py-8', theme.text.muted)}>Loading variables...</div>
          ) : Object.keys(variables).length === 0 ? (
            <div className={cn('text-center py-8', theme.text.muted)}>
              No environment variables defined
            </div>
          ) : (
            Object.entries(variables).map(([key, value]) => (
              <div
                key={key}
                className={cn(
                  'group p-4 rounded-lg border hover:border-slate-300 dark:hover:border-slate-600 transition-all',
                  theme.containers.card
                )}
              >
                <div className="grid grid-cols-12 gap-3 items-center">
                  <div className="col-span-4">
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        value={key}
                        disabled
                        className={cn(
                          'w-full px-3 py-2 rounded border font-mono text-sm',
                          theme.surface.muted,
                          theme.text.strong,
                          'border-slate-300 dark:border-slate-600'
                        )}
                      />
                      {isSensitive(key) && (
                        <span
                          className={cn(
                            'px-2 py-1 text-xs font-medium rounded',
                            theme.badges.tag.warning
                          )}
                        >
                          Sensitive
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="col-span-7">
                    <div className="relative">
                      <input
                        type={isSensitive(key) && !showValues.has(key) ? 'password' : 'text'}
                        value={value}
                        onChange={(e) => handleUpdate(key, e.target.value)}
                        className={cn(
                          'w-full px-3 py-2 pr-10 rounded border font-mono text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent',
                          theme.forms.input
                        )}
                      />
                      {isSensitive(key) && (
                        <button
                          onClick={() => toggleShowValue(key)}
                          className={cn(
                            'absolute right-2 top-1/2 -translate-y-1/2',
                            theme.text.subtle,
                            'hover:' + theme.text.muted
                          )}
                        >
                          {showValues.has(key) ? (
                            <EyeSlashIcon className="h-5 w-5" />
                          ) : (
                            <EyeIcon className="h-5 w-5" />
                          )}
                        </button>
                      )}
                    </div>
                  </div>
                  <div className="col-span-1 flex justify-end">
                    <button
                      onClick={() => handleRemove(key)}
                      className={cn(
                        'p-2 rounded-lg transition-colors opacity-0 group-hover:opacity-100',
                        theme.text.danger,
                        'hover:bg-red-50 dark:hover:bg-red-900/20'
                      )}
                    >
                      <TrashIcon className="h-5 w-5" />
                    </button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Removed Variables Info */}
        {toRemove.size > 0 && (
          <div className={cn('mt-6 p-4 rounded-lg', theme.alerts.variants.error)}>
            <p className={cn('text-sm', theme.text.danger)}>
              {toRemove.size} variable(s) will be removed: {Array.from(toRemove).join(', ')}
            </p>
          </div>
        )}

        {/* Actions */}
        <div className="mt-8 flex items-center justify-end gap-3">
          <button onClick={onBack} className={theme.buttons.ghost}>
            Cancel
          </button>
          <button
            onClick={handleApply}
            className={cn('inline-flex items-center gap-2 px-6 py-2.5', theme.brand.composeAccent)}
          >
            <CheckIcon className="h-5 w-5" />
            Apply Changes
          </button>
        </div>
      </div>
    </div>
  );
};
