import React from 'react';
import { cn } from '../../utils/cn';
import { theme } from '../../theme';

export interface StatCardProps {
  label: string;
  value: string | number;
  icon: React.ComponentType<{ className?: string }>;
  iconColor?: string;
  iconBg?: string;
  subtext?: string;
  subtextColor?: string;
  onClick?: () => void;
  className?: string;
}

export const StatCard: React.FC<StatCardProps> = ({
  label,
  value,
  icon: Icon,
  iconColor = 'text-blue-600 dark:text-blue-400',
  iconBg = 'bg-blue-100 dark:bg-blue-900/20',
  subtext,
  subtextColor,
  onClick,
  className,
}) => {
  return (
    <div
      className={cn(
        theme.containers.panel,
        'p-6 rounded-lg shadow-sm',
        onClick && 'cursor-pointer hover:shadow-md transition-shadow',
        className
      )}
      onClick={onClick}
    >
      <div className="flex items-center">
        <div className={cn('p-3 rounded-xl', iconBg)}>
          <Icon className={cn('h-8 w-8', iconColor)} />
        </div>
        <div className="ml-4">
          <p className={cn('text-sm font-medium', theme.text.muted)}>{label}</p>
          <p className={cn('text-2xl font-bold', theme.text.strong)}>{value}</p>
          {subtext && <p className={cn('text-xs', subtextColor || theme.text.muted)}>{subtext}</p>}
        </div>
      </div>
    </div>
  );
};
