import React from 'react';
import { cn } from '../../../utils/cn';

interface ToolItemProps {
  label: string;
  icon: React.ReactNode;
  isSelected: boolean;
  onSelect: () => void;
  disabled?: boolean;
}

export const ToolItem: React.FC<ToolItemProps> = ({
  label,
  icon,
  isSelected,
  onSelect,
  disabled = false,
}) => {
  return (
    <button
      onClick={onSelect}
      disabled={disabled}
      className={cn(
        'w-full flex items-center gap-2 px-3 py-1.5 text-left',
        'transition-colors',
        disabled ? 'opacity-50 cursor-not-allowed' : 'hover:bg-zinc-100 dark:hover:bg-zinc-800',
        isSelected && !disabled && 'bg-teal-50 dark:bg-teal-900/30 text-teal-700 dark:text-teal-300'
      )}
    >
      <span className="w-4 h-4 flex-shrink-0 text-zinc-500 dark:text-zinc-400">{icon}</span>
      <span className="flex-1 text-sm">{label}</span>
    </button>
  );
};
