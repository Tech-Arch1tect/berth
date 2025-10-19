import React from 'react';
import { ArrowUpCircleIcon } from '@heroicons/react/24/outline';
import { cn } from '../../utils/cn';
import { theme } from '../../theme';

interface UpdateAvailableBadgeProps {
  count: number;
  variant?: 'default' | 'compact';
  className?: string;
}

export const UpdateAvailableBadge: React.FC<UpdateAvailableBadgeProps> = ({
  count,
  variant = 'default',
  className,
}) => {
  if (count === 0) return null;

  return (
    <span
      className={cn(
        theme.badges.tag.base,
        theme.badges.tag.warning,
        variant === 'compact' ? 'text-xs px-2 py-0.5' : 'text-sm px-2.5 py-1',
        className
      )}
      title={`${count} update${count !== 1 ? 's' : ''} available`}
    >
      <ArrowUpCircleIcon className="h-3.5 w-3.5" />
      <span>
        {count} update{count !== 1 ? 's' : ''}
      </span>
    </span>
  );
};
