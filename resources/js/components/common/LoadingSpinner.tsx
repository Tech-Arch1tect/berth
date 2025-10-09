import React from 'react';
import { cn } from '../../utils/cn';
import { theme } from '../../theme';

export interface LoadingSpinnerProps {
  size?: 'sm' | 'md' | 'lg';
  text?: string;
  fullScreen?: boolean;
}

export const LoadingSpinner: React.FC<LoadingSpinnerProps> = ({
  size = 'md',
  text,
  fullScreen = false,
}) => {
  const sizeClasses = {
    sm: 'h-4 w-4',
    md: 'h-8 w-8',
    lg: 'h-12 w-12',
  };

  const spinnerClass = size === 'sm' ? theme.effects.spinnerSm : theme.effects.spinner;

  const content = (
    <div className="flex flex-col items-center justify-center gap-4">
      <div className={cn(spinnerClass, sizeClasses[size])} />
      {text && <p className={cn('text-sm', theme.text.muted)}>{text}</p>}
    </div>
  );

  if (fullScreen) {
    return <div className="flex items-center justify-center min-h-screen">{content}</div>;
  }

  return <div className="flex items-center justify-center py-12">{content}</div>;
};
