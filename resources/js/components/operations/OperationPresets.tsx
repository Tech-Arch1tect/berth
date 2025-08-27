import React from 'react';
import { OperationPreset, OperationRequest } from '../../types/operations';

interface OperationPresetsProps {
  onOperationSelect: (operation: OperationRequest) => void;
  disabled?: boolean;
  className?: string;
}

const defaultPresets: OperationPreset[] = [
  {
    id: 'up-detached',
    name: 'Start Stack',
    description: 'Start all services in detached mode',
    command: 'up',
    options: ['-d'],
    icon: '▶️',
    variant: 'success',
  },
  {
    id: 'up-build',
    name: 'Build & Start',
    description: 'Build images and start stack',
    command: 'up',
    options: ['-d', '--build'],
    icon: '🔨',
    variant: 'primary',
  },
  {
    id: 'down',
    name: 'Stop Stack',
    description: 'Stop and remove containers',
    command: 'down',
    options: [],
    icon: '⏹️',
    variant: 'danger',
  },
  {
    id: 'restart',
    name: 'Restart Stack',
    description: 'Restart all services',
    command: 'restart',
    options: [],
    icon: '🔄',
    variant: 'warning',
  },
  {
    id: 'pull',
    name: 'Update Images',
    description: 'Pull latest images',
    command: 'pull',
    options: [],
    icon: '⬇️',
    variant: 'secondary',
  },
  {
    id: 'up-recreate',
    name: 'Force Recreate',
    description: 'Force recreate containers',
    command: 'up',
    options: ['-d', '--force-recreate'],
    icon: '🔄',
    variant: 'warning',
  },
];

export const OperationPresets: React.FC<OperationPresetsProps> = ({
  onOperationSelect,
  disabled = false,
  className = '',
}) => {
  const getVariantClasses = (variant: OperationPreset['variant']) => {
    switch (variant) {
      case 'success':
        return 'bg-green-50 border-green-200 hover:bg-green-100 text-green-800 dark:bg-green-900/20 dark:border-green-800 dark:hover:bg-green-900/30 dark:text-green-200';
      case 'danger':
        return 'bg-red-50 border-red-200 hover:bg-red-100 text-red-800 dark:bg-red-900/20 dark:border-red-800 dark:hover:bg-red-900/30 dark:text-red-200';
      case 'warning':
        return 'bg-yellow-50 border-yellow-200 hover:bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:border-yellow-800 dark:hover:bg-yellow-900/30 dark:text-yellow-200';
      case 'secondary':
        return 'bg-gray-50 border-gray-200 hover:bg-gray-100 text-gray-800 dark:bg-gray-800 dark:border-gray-700 dark:hover:bg-gray-700 dark:text-gray-200';
      default:
        return 'bg-blue-50 border-blue-200 hover:bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:border-blue-800 dark:hover:bg-blue-900/30 dark:text-blue-200';
    }
  };

  const handlePresetClick = (preset: OperationPreset) => {
    if (disabled) return;

    const operation: OperationRequest = {
      command: preset.command,
      options: preset.options,
      services: [],
    };

    onOperationSelect(operation);
  };

  return (
    <div className={`grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 ${className}`}>
      {defaultPresets.map((preset) => (
        <button
          key={preset.id}
          onClick={() => handlePresetClick(preset)}
          disabled={disabled}
          className={`
            p-4 rounded-lg border-2 transition-all duration-200 text-left
            ${getVariantClasses(preset.variant)}
            ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer transform hover:scale-105'}
            focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:focus:ring-offset-gray-900
          `}
        >
          <div className="flex items-center gap-3 mb-2">
            <span className="text-xl">{preset.icon}</span>
            <h3 className="font-semibold text-sm">{preset.name}</h3>
          </div>
          <p className="text-xs opacity-80 mb-2">{preset.description}</p>
          <div className="flex flex-wrap gap-1">
            <span className="text-xs px-2 py-1 rounded bg-black/10 dark:bg-white/10">
              {preset.command}
            </span>
            {preset.options.map((option, index) => (
              <span key={index} className="text-xs px-2 py-1 rounded bg-black/10 dark:bg-white/10">
                {option}
              </span>
            ))}
          </div>
        </button>
      ))}
    </div>
  );
};
