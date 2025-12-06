import React from 'react';
import { cn } from '../../../utils/cn';

interface ResourceItemProps {
  label: string;
  icon?: React.ReactNode;
  isSelected: boolean;
  onSelect: () => void;
  isActive?: boolean;
}

export const ResourceItem: React.FC<ResourceItemProps> = ({
  label,
  icon,
  isSelected,
  onSelect,
  isActive = true,
}) => {
  return (
    <button
      onClick={onSelect}
      className={cn(
        'w-full flex items-center gap-2 px-3 py-1.5 pl-7 text-left',
        'hover:bg-zinc-100 dark:hover:bg-zinc-800',
        'transition-colors',
        isSelected && 'bg-teal-50 dark:bg-teal-900/30 text-teal-700 dark:text-teal-300'
      )}
    >
      {icon && <span className="w-4 h-4 flex-shrink-0 text-zinc-400">{icon}</span>}
      <span
        className={cn('flex-1 text-sm truncate', !isActive && 'text-zinc-400 dark:text-zinc-500')}
      >
        {label}
      </span>
      {!isActive && (
        <span className="text-xs text-zinc-400 dark:text-zinc-500 italic">not created</span>
      )}
    </button>
  );
};
