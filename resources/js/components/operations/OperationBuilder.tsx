import React, { useState, useEffect } from 'react';
import { OperationRequest } from '../../types/operations';

interface OperationBuilderProps {
  onOperationBuild: (operation: OperationRequest) => void;
  disabled?: boolean;
  className?: string;
  services?: Array<{ name: string; service_name?: string }>;
}

const commandOptions: Record<OperationRequest['command'], string[]> = {
  up: ['--build', '--force-recreate', '--no-recreate', '--remove-orphans', '--pull', '--wait'],
  down: ['--remove-orphans', '--volumes', '-t', '--timeout'],
  start: [],
  stop: ['-t', '--timeout'],
  restart: ['-t', '--timeout', '--no-deps'],
  pull: ['-q', '--quiet', '--ignore-pull-failures'],
};

const commandDescriptions: Record<OperationRequest['command'], string> = {
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
  const [command, setCommand] = useState<OperationRequest['command']>('up');
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

    const operation: OperationRequest = {
      command,
      options: finalOptions,
      services: selectedServices,
    };

    onOperationBuild(operation);
  };

  const availableOptions = commandOptions[command] || [];
  const needsTimeout = ['down', 'stop', 'restart'].includes(command);

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Command Selection */}
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          Command
        </label>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
          {(Object.keys(commandDescriptions) as OperationRequest['command'][]).map((cmd) => (
            <button
              key={cmd}
              onClick={() => setCommand(cmd)}
              className={`
                p-3 text-left rounded-lg border transition-all duration-200
                ${
                  command === cmd
                    ? 'border-blue-500 bg-blue-50 text-blue-800 dark:bg-blue-900/20 dark:border-blue-400 dark:text-blue-200'
                    : 'border-gray-200 bg-white hover:bg-gray-50 text-gray-700 dark:border-gray-600 dark:bg-gray-800 dark:hover:bg-gray-700 dark:text-gray-300'
                }
              `}
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
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Options
          </label>
          <div className="space-y-2">
            {availableOptions
              .filter((option) => !['--timeout', '-t'].includes(option))
              .map((option) => (
                <label
                  key={option}
                  className="flex items-start gap-3 p-2 rounded hover:bg-gray-50 dark:hover:bg-gray-800"
                >
                  <input
                    type="checkbox"
                    checked={selectedOptions.includes(option)}
                    onChange={() => handleOptionToggle(option)}
                    disabled={disabled}
                    className="mt-1 h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded dark:border-gray-600 dark:bg-gray-700"
                  />
                  <div>
                    <div className="text-sm font-medium text-gray-900 dark:text-gray-100">
                      {option}
                    </div>
                    <div className="text-xs text-gray-500 dark:text-gray-400">
                      {optionDescriptions[option] || 'No description available'}
                    </div>
                  </div>
                </label>
              ))}

            {/* Timeout Option */}
            {needsTimeout && (
              <label className="flex items-start gap-3 p-2 rounded hover:bg-gray-50 dark:hover:bg-gray-800">
                <input
                  type="checkbox"
                  checked={selectedOptions.includes('-t') || selectedOptions.includes('--timeout')}
                  onChange={() => handleOptionToggle('--timeout')}
                  disabled={disabled}
                  className="mt-1 h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded dark:border-gray-600 dark:bg-gray-700"
                />
                <div className="flex-1">
                  <div className="text-sm font-medium text-gray-900 dark:text-gray-100">
                    --timeout
                  </div>
                  <div className="text-xs text-gray-500 dark:text-gray-400 mb-2">
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
                      className="w-20 px-2 py-1 text-sm border border-gray-300 rounded focus:ring-1 focus:ring-blue-500 focus:border-blue-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
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
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
              Services (leave empty for all)
            </label>
            {selectedServices.length > 0 && (
              <button
                type="button"
                onClick={() => setSelectedServices([])}
                disabled={disabled}
                className="text-sm text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 disabled:opacity-50"
              >
                Clear all
              </button>
            )}
          </div>

          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
            {services.map((service) => {
              const serviceName = service.service_name || service.name;
              const isSelected = selectedServices.includes(serviceName);

              return (
                <button
                  key={service.name}
                  onClick={() => handleServiceToggle(serviceName)}
                  disabled={disabled}
                  className={`
                    p-2 text-left rounded-lg border transition-all duration-200 text-sm
                    ${
                      isSelected
                        ? 'border-blue-500 bg-blue-50 text-blue-800 dark:bg-blue-900/20 dark:border-blue-400 dark:text-blue-200'
                        : 'border-gray-200 bg-white hover:bg-gray-50 text-gray-700 dark:border-gray-600 dark:bg-gray-800 dark:hover:bg-gray-700 dark:text-gray-300'
                    }
                    ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
                  `}
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
          className={`
            px-4 py-2 rounded-lg font-medium transition-colors duration-200
            ${
              disabled
                ? 'bg-gray-300 text-gray-500 cursor-not-allowed dark:bg-gray-600 dark:text-gray-400'
                : 'bg-blue-600 text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:focus:ring-offset-gray-900'
            }
          `}
        >
          Run Operation
        </button>
      </div>
    </div>
  );
};
