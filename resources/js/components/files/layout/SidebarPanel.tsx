import React from 'react';
import { cn } from '../../../utils/cn';
import { theme } from '../../../theme';

interface SidebarPanelProps {
  children: React.ReactNode;
  width: number;
  collapsed: boolean;
  onToggle: () => void;
}

export const SidebarPanel: React.FC<SidebarPanelProps> = ({
  children,
  width,
  collapsed,
  onToggle,
}) => {
  if (collapsed) {
    return null;
  }

  return (
    <div
      className={cn(
        'flex-shrink-0 flex flex-col overflow-hidden',
        'bg-white dark:bg-zinc-900',
        'border-r border-zinc-200 dark:border-zinc-800'
      )}
      style={{ width: `${width}px` }}
    >
      <div
        className={cn(
          'flex-shrink-0 flex items-center justify-between px-3 py-2.5',
          'border-b border-zinc-200 dark:border-zinc-800',
          theme.surface.muted
        )}
      >
        <span className={cn('text-xs font-bold uppercase tracking-wider', theme.text.muted)}>
          Explorer
        </span>
        <button
          onClick={onToggle}
          className={cn(theme.buttons.icon, 'p-1')}
          title="Collapse sidebar"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M15 19l-7-7 7-7"
            />
          </svg>
        </button>
      </div>

      <div className="flex-1 overflow-auto">{children}</div>
    </div>
  );
};
