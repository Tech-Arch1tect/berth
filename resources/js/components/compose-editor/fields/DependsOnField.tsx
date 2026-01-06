import React from 'react';
import { TrashIcon } from '@heroicons/react/24/outline';
import { cn } from '../../../utils/cn';
import { theme } from '../../../theme';
import { DependsOnChange } from '../../../types/compose';

interface DependsOnFieldProps {
  dependsOn: Record<string, DependsOnChange>;
  availableServices: string[];
  currentService: string;
  onChange: (dependsOn: Record<string, DependsOnChange>) => void;
  disabled?: boolean;
}

const CONDITIONS = [
  { value: 'service_started', label: 'Service Started' },
  { value: 'service_healthy', label: 'Service Healthy' },
  { value: 'service_completed_successfully', label: 'Service Completed Successfully' },
];

export const DependsOnField: React.FC<DependsOnFieldProps> = ({
  dependsOn,
  availableServices,
  currentService,
  onChange,
  disabled,
}) => {
  const dependencyNames = Object.keys(dependsOn);
  const availableToAdd = availableServices.filter(
    (s) => s !== currentService && !dependencyNames.includes(s)
  );

  const handleAddDependency = (serviceName: string) => {
    onChange({
      ...dependsOn,
      [serviceName]: { condition: 'service_started' },
    });
  };

  const handleRemoveDependency = (serviceName: string) => {
    const { [serviceName]: _, ...rest } = dependsOn;
    onChange(rest);
  };

  const handleUpdateCondition = (serviceName: string, condition: string) => {
    onChange({
      ...dependsOn,
      [serviceName]: { ...dependsOn[serviceName], condition },
    });
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <label className={cn('text-sm font-medium', theme.text.muted)}>Dependencies</label>
        <select
          onChange={(e) => {
            if (e.target.value) {
              handleAddDependency(e.target.value);
              e.target.value = '';
            }
          }}
          disabled={disabled || availableToAdd.length === 0}
          className={cn(theme.forms.compact.selectSmall)}
          defaultValue=""
        >
          <option value="" disabled>
            {availableToAdd.length === 0 ? 'No services available' : '+ Add dependency'}
          </option>
          {availableToAdd.map((service) => (
            <option key={service} value={service}>
              {service}
            </option>
          ))}
        </select>
      </div>

      {dependencyNames.length === 0 ? (
        <p className={cn('text-sm italic', theme.text.muted)}>No dependencies configured</p>
      ) : (
        <div className="space-y-2">
          {dependencyNames.sort().map((serviceName) => {
            const dep = dependsOn[serviceName];
            return (
              <div
                key={serviceName}
                className={cn(
                  'flex items-center gap-3 p-3 rounded-lg',
                  'bg-zinc-50 dark:bg-zinc-800/50'
                )}
              >
                <div className="flex-1 grid grid-cols-2 gap-3">
                  <div>
                    <label className={cn('block text-xs mb-1', theme.text.subtle)}>Service</label>
                    <p className={cn('text-sm font-medium', theme.text.standard)}>{serviceName}</p>
                  </div>
                  <div>
                    <label className={cn('block text-xs mb-1', theme.text.subtle)}>Condition</label>
                    <select
                      value={dep.condition || 'service_started'}
                      onChange={(e) => handleUpdateCondition(serviceName, e.target.value)}
                      disabled={disabled}
                      className={cn(theme.forms.compact.select)}
                    >
                      {CONDITIONS.map((cond) => (
                        <option key={cond.value} value={cond.value}>
                          {cond.label}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => handleRemoveDependency(serviceName)}
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
          })}
        </div>
      )}
    </div>
  );
};
