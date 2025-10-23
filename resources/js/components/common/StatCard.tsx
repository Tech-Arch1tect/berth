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
        'group relative overflow-hidden rounded-xl border transition-all duration-200',
        'bg-white dark:bg-zinc-900',
        'border-zinc-200 dark:border-zinc-800',
        'shadow-sm hover:shadow-lg',
        onClick &&
          'cursor-pointer hover:border-teal-300 hover:-translate-y-0.5 dark:hover:border-teal-700',
        className
      )}
      onClick={onClick}
    >
      <div className="absolute inset-0 bg-gradient-to-br from-transparent via-transparent to-zinc-50/50 dark:to-zinc-800/30 opacity-50" />

      <div className="relative p-5">
        <div className="flex items-start justify-between mb-3">
          <div className={cn('p-2.5 rounded-xl shadow-sm', iconBg)}>
            <Icon className={cn('h-5 w-5', iconColor)} />
          </div>
        </div>

        <div className="space-y-1">
          <p className={cn('text-xs font-semibold uppercase tracking-wide', theme.text.subtle)}>
            {label}
          </p>
          <p className={cn('text-3xl font-bold', theme.text.strong)}>{value}</p>
          {subtext && (
            <p className={cn('text-xs font-medium', subtextColor || theme.text.muted)}>{subtext}</p>
          )}
        </div>
      </div>
    </div>
  );
};
