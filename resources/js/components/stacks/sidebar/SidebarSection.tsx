import React, { useState } from 'react';
import { cn } from '../../../utils/cn';
import { theme } from '../../../theme';
import { ChevronDownIcon, ChevronRightIcon } from '@heroicons/react/24/outline';

interface SidebarSectionProps {
  title: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
  defaultExpanded?: boolean;
  count?: number;
}

export const SidebarSection: React.FC<SidebarSectionProps> = ({
  title,
  icon,
  children,
  defaultExpanded = true,
  count,
}) => {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);

  return (
    <div className="border-b border-zinc-200 dark:border-zinc-800 last:border-b-0">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className={cn(
          'w-full flex items-center gap-2 px-3 py-2',
          'hover:bg-zinc-100 dark:hover:bg-zinc-800',
          'transition-colors text-left'
        )}
      >
        {isExpanded ? (
          <ChevronDownIcon className="w-4 h-4 text-zinc-400 flex-shrink-0" />
        ) : (
          <ChevronRightIcon className="w-4 h-4 text-zinc-400 flex-shrink-0" />
        )}
        {icon && <span className="flex-shrink-0">{icon}</span>}
        <span
          className={cn('text-xs font-semibold uppercase tracking-wider flex-1', theme.text.muted)}
        >
          {title}
        </span>
        {count !== undefined && (
          <span className={cn('text-xs tabular-nums', theme.text.subtle)}>{count}</span>
        )}
      </button>
      {isExpanded && <div className="pb-1">{children}</div>}
    </div>
  );
};
