import React from 'react';
import { OperationPreset, OperationRequest } from '../../types/operations';
import { theme } from '../../theme';
import { cn } from '../../utils/cn';

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
  const variantStyles: Record<
    NonNullable<OperationPreset['variant']>,
    { surface: string; border: string; text: string }
  > = {
    primary: {
      surface: theme.intent.info.surface,
      border: theme.intent.info.border,
      text: theme.intent.info.textStrong,
    },
    secondary: {
      surface: theme.intent.neutral.surface,
      border: theme.intent.neutral.border,
      text: theme.intent.neutral.textStrong,
    },
    success: {
      surface: theme.intent.success.surface,
      border: theme.intent.success.border,
      text: theme.intent.success.textStrong,
    },
    warning: {
      surface: theme.intent.warning.surface,
      border: theme.intent.warning.border,
      text: theme.intent.warning.textStrong,
    },
    danger: {
      surface: theme.intent.danger.surface,
      border: theme.intent.danger.border,
      text: theme.intent.danger.textStrong,
    },
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
    <div className={cn('grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3', className)}>
      {defaultPresets.map((preset) => (
        <button
          key={preset.id}
          onClick={() => handlePresetClick(preset)}
          disabled={disabled}
          type="button"
          className={cn(
            theme.cards.shell,
            theme.cards.padded,
            'border-2 text-left transition-transform duration-200',
            preset.variant ? variantStyles[preset.variant].surface : variantStyles.primary.surface,
            preset.variant ? variantStyles[preset.variant].border : variantStyles.primary.border,
            preset.variant ? variantStyles[preset.variant].text : variantStyles.primary.text,
            !disabled && 'hover:scale-[1.02] hover:shadow-md',
            disabled && theme.selectable.tileDisabled
          )}
        >
          <div className="flex items-center gap-3 mb-2">
            <span className="text-xl">{preset.icon}</span>
            <h3 className="font-semibold text-sm">{preset.name}</h3>
          </div>
          <p className={cn('mb-2 text-xs', theme.text.muted)}>{preset.description}</p>
          <div className="flex flex-wrap gap-1">
            <span className={cn(theme.selectable.pill, 'text-xs uppercase tracking-wide')}>
              {preset.command}
            </span>
            {preset.options.map((option, index) => (
              <span key={index} className={cn(theme.selectable.pill, 'text-xs')}>
                {option}
              </span>
            ))}
          </div>
        </button>
      ))}
    </div>
  );
};
