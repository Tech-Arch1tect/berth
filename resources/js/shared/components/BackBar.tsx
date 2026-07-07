import React from 'react';
import { ChevronLeftIcon } from '@heroicons/react/24/outline';
import { cn } from '../utils/cn';
import { theme } from '../theme';

export interface BackBarProps {
  label: string;
  onBack: () => void;
  className?: string;
}

export const BackBar: React.FC<BackBarProps> = ({ label, onBack, className }) => (
  <button
    onClick={onBack}
    className={cn(
      'flex min-h-[44px] w-full flex-shrink-0 items-center gap-1 border-b px-3 text-sm font-medium',
      'border-zinc-200 dark:border-zinc-800',
      theme.text.standard,
      'hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors',
      className
    )}
  >
    <ChevronLeftIcon className="h-4 w-4" />
    {label}
  </button>
);
