import React, { useState } from 'react';
import { DockerOperationRequest } from '../types';
import {
  buildOptionsPayload,
  commandOptionCatalog,
  optionValueIsValid,
  type CommandOptionSpec,
} from '../utils/operationOptions';
import { theme } from '../../../shared/theme';
import { cn } from '../../../shared/utils/cn';

interface OperationBuilderProps {
  onOperationBuild: (operation: DockerOperationRequest) => void;
  disabled?: boolean;
  className?: string;
  services?: Array<{ name: string; service_name?: string }>;
}

const commandDescriptions: Record<DockerOperationRequest['command'], string> = {
  up: 'Create and start containers',
  down: 'Stop and remove containers, networks',
  start: 'Start existing stopped containers',
  stop: 'Stop running containers',
  restart: 'Restart containers',
  pull: 'Pull service images from registry',
};

const optionValueId = (command: string, flag: string) => `option-value-${command}-${flag}`;

const invalidValueHint = (spec: CommandOptionSpec) => {
  if (spec.value.kind === 'scale') {
    return 'Use the form service=2';
  }
  if (spec.value.kind === 'number') {
    return spec.value.max
      ? `Enter a whole number between ${spec.value.min} and ${spec.value.max}`
      : `Enter a whole number of at least ${spec.value.min}`;
  }
  return 'Enter a value';
};

export const OperationBuilder: React.FC<OperationBuilderProps> = ({
  onOperationBuild,
  disabled = false,
  className = '',
  services = [],
}) => {
  const [command, setCommand] = useState<DockerOperationRequest['command']>('up');
  const [selectedOptions, setSelectedOptions] = useState<string[]>([]);
  const [optionValues, setOptionValues] = useState<Record<string, string>>({});
  const [selectedServices, setSelectedServices] = useState<string[]>([]);
  const [prevCommand, setPrevCommand] = useState(command);

  if (command !== prevCommand) {
    setPrevCommand(command);
    setSelectedOptions([]);
  }

  const handleOptionToggle = (option: string) => {
    setSelectedOptions((prev) =>
      prev.includes(option) ? prev.filter((o) => o !== option) : [...prev, option]
    );
  };

  const handleServiceToggle = (serviceName: string) => {
    setSelectedServices((prev) =>
      prev.includes(serviceName) ? prev.filter((s) => s !== serviceName) : [...prev, serviceName]
    );
  };

  const availableOptions = commandOptionCatalog[command] || [];

  const selectedValueSpecs = availableOptions.filter(
    (spec) => spec.value.kind !== 'none' && selectedOptions.includes(spec.flag)
  );

  const valueFor = (spec: CommandOptionSpec) =>
    optionValues[spec.flag] ??
    (spec.value.kind === 'enum' || spec.value.kind === 'number' ? spec.value.defaultValue : '');

  const hasInvalidValue = availableOptions.some(
    (spec) =>
      selectedOptions.includes(spec.flag) &&
      spec.value.kind !== 'none' &&
      !optionValueIsValid(spec, valueFor(spec))
  );

  const buildOperation = () => {
    const initialValues: Record<string, string> = {};
    for (const spec of availableOptions) {
      if (spec.value.kind !== 'none') {
        initialValues[spec.flag] = valueFor(spec);
      }
    }

    const operation: DockerOperationRequest = {
      command,
      options: buildOptionsPayload(command, selectedOptions, initialValues),
      services: selectedServices,
    };

    onOperationBuild(operation);
  };

  return (
    <div className={cn('space-y-6', className)}>
      {/* Command Selection */}
      <div>
        <label className={cn(theme.forms.label, 'mb-2')}>Command</label>
        <div className="grid grid-cols-2 gap-2 md:grid-cols-3">
          {(Object.keys(commandDescriptions) as DockerOperationRequest['command'][]).map((cmd) => (
            <button
              key={cmd}
              onClick={() => setCommand(cmd)}
              className={cn(
                theme.selectable.tileBase,
                command === cmd ? theme.selectable.tileActive : theme.selectable.tileInactive
              )}
              type="button"
            >
              <div className="font-medium text-sm">{cmd}</div>
              <div className="text-xs opacity-70 mt-1">{commandDescriptions[cmd]}</div>
            </button>
          ))}
        </div>
      </div>

      {/* Options */}
      {availableOptions.length > 0 && (
        <div>
          <label className={cn(theme.forms.label, 'mb-2')}>Options</label>
          <div className="grid grid-cols-2 gap-2 md:grid-cols-3">
            {availableOptions.map((spec) => {
              const isSelected = selectedOptions.includes(spec.flag);

              return (
                <button
                  key={spec.flag}
                  type="button"
                  title={spec.description}
                  aria-label={`${spec.flag}: ${spec.description}`}
                  aria-pressed={isSelected}
                  onClick={() => handleOptionToggle(spec.flag)}
                  disabled={disabled}
                  className={cn(
                    theme.selectable.tileBase,
                    isSelected ? theme.selectable.tileActive : theme.selectable.tileInactive,
                    disabled ? theme.selectable.tileDisabled : 'cursor-pointer'
                  )}
                >
                  <span className="font-mono text-xs font-medium leading-snug break-words">
                    {spec.flag}
                  </span>
                </button>
              );
            })}
          </div>

          {selectedValueSpecs.length > 0 && (
            <div className="mt-3 space-y-2">
              {selectedValueSpecs.map((spec) => {
                const value = valueFor(spec);
                const invalid = !optionValueIsValid(spec, value);

                return (
                  <div key={spec.flag} className="flex flex-wrap items-center gap-2">
                    <span className={cn('font-mono text-xs font-medium', theme.text.strong)}>
                      {spec.flag}
                    </span>

                    {spec.value.kind === 'enum' && (
                      <select
                        id={optionValueId(command, spec.flag)}
                        value={value}
                        onChange={(e) =>
                          setOptionValues((prev) => ({ ...prev, [spec.flag]: e.target.value }))
                        }
                        disabled={disabled}
                        className={cn(theme.forms.input, 'w-32 px-2 py-1 text-sm')}
                      >
                        {spec.value.choices.map((choice) => (
                          <option key={choice} value={choice}>
                            {choice}
                          </option>
                        ))}
                      </select>
                    )}

                    {spec.value.kind === 'number' && (
                      <input
                        id={optionValueId(command, spec.flag)}
                        type="number"
                        value={value}
                        onChange={(e) =>
                          setOptionValues((prev) => ({ ...prev, [spec.flag]: e.target.value }))
                        }
                        disabled={disabled}
                        min={spec.value.min}
                        max={spec.value.max}
                        aria-invalid={invalid}
                        className={cn(
                          theme.forms.input,
                          'w-24 px-2 py-1 text-sm',
                          invalid && 'border-red-500! dark:border-red-500!'
                        )}
                      />
                    )}

                    {spec.value.kind === 'scale' && (
                      <input
                        id={optionValueId(command, spec.flag)}
                        type="text"
                        value={value}
                        placeholder="service=2"
                        onChange={(e) =>
                          setOptionValues((prev) => ({ ...prev, [spec.flag]: e.target.value }))
                        }
                        disabled={disabled}
                        aria-invalid={invalid}
                        className={cn(
                          theme.forms.input,
                          'w-40 px-2 py-1 text-sm font-mono',
                          invalid && 'border-red-500! dark:border-red-500!'
                        )}
                      />
                    )}

                    {invalid && (
                      <span className={cn('text-xs', theme.text.danger)}>
                        {invalidValueHint(spec)}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Service Selection */}
      {services.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className={theme.forms.label}>Services (leave empty for all)</label>
            {selectedServices.length > 0 && (
              <button
                type="button"
                onClick={() => setSelectedServices([])}
                disabled={disabled}
                className={cn(
                  'text-sm transition-colors',
                  theme.link.primary,
                  disabled && 'opacity-50'
                )}
              >
                Clear all
              </button>
            )}
          </div>

          <div className="grid grid-cols-2 gap-2 md:grid-cols-3 lg:grid-cols-4">
            {services.map((service) => {
              const serviceName = service.service_name || service.name;
              const isSelected = selectedServices.includes(serviceName);

              return (
                <button
                  key={service.name}
                  onClick={() => handleServiceToggle(serviceName)}
                  disabled={disabled}
                  className={cn(
                    theme.selectable.tileBase,
                    isSelected ? theme.selectable.tileActive : theme.selectable.tileInactive,
                    disabled ? theme.selectable.tileDisabled : 'cursor-pointer'
                  )}
                >
                  <div className="font-medium truncate" title={service.name}>
                    {service.name}
                  </div>
                  {service.service_name && service.service_name !== service.name && (
                    <div className="text-xs opacity-70 truncate" title={service.service_name}>
                      ({service.service_name})
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Build Button */}
      <div className="flex justify-end">
        <button
          onClick={buildOperation}
          disabled={disabled || hasInvalidValue}
          className={cn(
            theme.buttons.primary,
            (disabled || hasInvalidValue) && 'cursor-not-allowed opacity-60'
          )}
        >
          Run Operation
        </button>
      </div>
    </div>
  );
};
