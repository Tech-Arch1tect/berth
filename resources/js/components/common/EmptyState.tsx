import React from 'react';
import { cn } from '../../utils/cn';
import { theme } from '../../theme';

export interface EmptyStateProps {
  icon?: React.ComponentType<{ className?: string }>;
  title: string;
  description?: string;
  action?: {
    label: string;
    onClick: () => void;
  };
  variant?: 'default' | 'error' | 'warning' | 'info';
  size?: 'sm' | 'md' | 'lg';
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  icon: Icon,
  title,
  description,
  action,
  variant = 'default',
  size = 'md',
}) => {
  const sizeClasses = {
    sm: 'py-8',
    md: 'py-12',
    lg: 'py-16',
  };

  const iconSizeClasses = {
    sm: 'h-12 w-12',
    md: 'h-16 w-16',
    lg: 'h-20 w-20',
  };

  const variantClasses = {
    default: theme.intent.neutral,
    error: theme.intent.danger,
    warning: theme.intent.warning,
    info: theme.intent.info,
  };

  const colors = variantClasses[variant];

  return (
    <div className={cn('text-center', sizeClasses[size])}>
      {Icon && (
        <div className="relative mb-6">
          <div className="absolute inset-0 flex items-center justify-center">
            <div
              className={cn(
                'rounded-full opacity-50',
                theme.effects.emptyAura,
                iconSizeClasses[size]
              )}
            />
          </div>
          <div className="relative">
            <div className={cn(theme.icon.emptyState, 'mx-auto')}>
              <Icon className={cn(iconSizeClasses[size], colors.textStrong)} />
            </div>
          </div>
        </div>
      )}

      <h3 className={cn('text-xl font-semibold mb-2', theme.text.strong)}>{title}</h3>

      {description && (
        <p className={cn('mb-6 max-w-md mx-auto', theme.text.muted)}>{description}</p>
      )}

      {action && (
        <button onClick={action.onClick} className={theme.buttons.primary}>
          {action.label}
        </button>
      )}
    </div>
  );
};
