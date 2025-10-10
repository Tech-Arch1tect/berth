import React, { useState, useEffect } from 'react';
import { DockerOperationRequest } from '../../types/operations';
import { theme } from '../../theme';
import { cn } from '../../utils/cn';

interface OperationBuilderProps {
  onOperationBuild: (operation: DockerOperationRequest) => void;
  disabled?: boolean;
  className?: string;
  services?: Array<{ name: string; service_name?: string }>;
}

const commandOptions: Record<DockerOperationRequest['command'], string[]> = {
  up: ['--build', '--force-recreate', '--no-recreate', '--remove-orphans', '--pull', '--wait'],
  down: ['--remove-orphans', '--volumes', '-t', '--timeout'],
  start: [],
  stop: ['-t', '--timeout'],
  restart: ['-t', '--timeout', '--no-deps'],
  pull: ['-q', '--quiet', '--ignore-pull-failures'],
};

const commandDescriptions: Record<DockerOperationRequest['command'], string> = {
  up: 'Create and start containers',
  down: 'Stop and remove containers, networks',
  start: 'Start existing stopped containers',
  stop: 'Stop running containers',
  restart: 'Restart containers',
  pull: 'Pull service images from registry',
};

const optionDescriptions: Record<string, string> = {
  '--build': 'Build images before starting',
  '--force-recreate': 'Recreate containers even if unchanged',
  '--no-recreate': "Don't recreate existing containers",
  '--remove-orphans': 'Remove containers not in compose file',
  '--pull': 'Pull images before starting',
  '--wait': 'Wait for services to be running/healthy',
  '--volumes': 'Remove named and anonymous volumes',
  '-t': 'Shutdown timeout',
  '--timeout': 'Shutdown timeout',
  '--no-deps': "Don't restart dependent services",
  '-q': 'Pull without progress information',
  '--quiet': 'Pull without progress information',
  '--ignore-pull-failures': 'Continue despite pull failures',
};

export const OperationBuilder: React.FC<OperationBuilderProps> = ({
  onOperationBuild,
  disabled = false,
  className = '',
  services = [],
}) => {
  const [command, setCommand] = useState<DockerOperationRequest['command']>('up');
  const [selectedOptions, setSelectedOptions] = useState<string[]>([]);
  const [selectedServices, setSelectedServices] = useState<string[]>([]);
  const [timeoutValue, setTimeoutValue] = useState('30');
  const [showAdvanced, setShowAdvanced] = useState(true);

  useEffect(() => {
    setSelectedOptions([]);
  }, [command]);

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

  const buildOperation = () => {
    let finalOptions = [...selectedOptions];

    if (
      ['down', 'stop', 'restart'].includes(command) &&
      selectedOptions.some((opt) => opt === '-t' || opt === '--timeout')
    ) {
      finalOptions = finalOptions.filter((opt) => opt !== '-t' && opt !== '--timeout');
      finalOptions.push('--timeout', timeoutValue);
    }

    const operation: DockerOperationRequest = {
      command,
      options: finalOptions,
      services: selectedServices,
    };

    onOperationBuild(operation);
  };

  const availableOptions = commandOptions[command] || [];
  const needsTimeout = ['down', 'stop', 'restart'].includes(command);

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

      {/* Common Options */}
      {availableOptions.length > 0 && (
        <div>
          <label className={cn(theme.forms.label, 'mb-2')}>Options</label>
          <div className="space-y-2">
            {availableOptions
              .filter((option) => !['--timeout', '-t'].includes(option))
              .map((option) => (
                <label
                  key={option}
                  className="flex items-start gap-3 rounded px-2 py-2 transition-colors hover:bg-slate-50 dark:hover:bg-slate-800"
                >
                  <input
                    type="checkbox"
                    checked={selectedOptions.includes(option)}
                    onChange={() => handleOptionToggle(option)}
                    disabled={disabled}
                    className={cn('mt-1', theme.forms.checkbox)}
                  />
                  <div>
                    <div className={cn('text-sm font-medium', theme.text.strong)}>{option}</div>
                    <div className={cn('text-xs', theme.text.subtle)}>
                      {optionDescriptions[option] || 'No description available'}
                    </div>
                  </div>
                </label>
              ))}

            {/* Timeout Option */}
            {needsTimeout && (
              <label className="flex items-start gap-3 rounded px-2 py-2 transition-colors hover:bg-slate-50 dark:hover:bg-slate-800">
                <input
                  type="checkbox"
                  checked={selectedOptions.includes('-t') || selectedOptions.includes('--timeout')}
                  onChange={() => handleOptionToggle('--timeout')}
                  disabled={disabled}
                  className={cn('mt-1', theme.forms.checkbox)}
                />
                <div className="flex-1">
                  <div className={cn('text-sm font-medium', theme.text.strong)}>--timeout</div>
                  <div className={cn('mb-2 text-xs', theme.text.subtle)}>
                    Shutdown timeout in seconds
                  </div>
                  {(selectedOptions.includes('-t') || selectedOptions.includes('--timeout')) && (
                    <input
                      type="number"
                      value={timeoutValue}
                      onChange={(e) => setTimeoutValue(e.target.value)}
                      disabled={disabled}
                      min="1"
                      max="300"
                      className={cn(theme.forms.input, 'w-20 px-2 py-1 text-sm')}
                    />
                  )}
                </div>
              </label>
            )}
          </div>
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
          disabled={disabled}
          className={cn(theme.buttons.primary, disabled && 'cursor-not-allowed opacity-60')}
        >
          Run Operation
        </button>
      </div>
    </div>
  );
};
