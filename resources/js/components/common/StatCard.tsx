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
  iconColor = theme.text.info,
  iconBg = theme.intent.info.surface,
  subtext,
  subtextColor,
  onClick,
  className,
}) => {
  return (
    <div
      className={cn(
        theme.containers.panel,
        'p-4 rounded-lg shadow-sm',
        onClick && 'cursor-pointer hover:shadow-md transition-shadow',
        className
      )}
      onClick={onClick}
    >
      <div className="flex items-center">
        <div className={cn('p-2 rounded-lg', iconBg)}>
          <Icon className={cn('h-6 w-6', iconColor)} />
        </div>
        <div className="ml-3">
          <p className={cn('text-xs font-semibold', theme.text.muted)}>{label}</p>
          <p className={cn('text-xl font-bold', theme.text.strong)}>{value}</p>
          {subtext && <p className={cn('text-xs', subtextColor || theme.text.muted)}>{subtext}</p>}
        </div>
      </div>
    </div>
  );
};
