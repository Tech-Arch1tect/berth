import type { FC } from 'react';
import { cn } from '../utils/cn';
import type { Tab } from './Tabs';

interface SectionTabsProps {
  tabs: Tab[];
  activeTab: string;
  onTabChange: (tabId: string) => void;
  className?: string;
  'aria-label'?: string;
}

export const SectionTabs: FC<SectionTabsProps> = ({
  tabs,
  activeTab,
  onTabChange,
  className,
  'aria-label': ariaLabel,
}) => {
  return (
    <div
      role="tablist"
      aria-label={ariaLabel}
      className={cn(
        'flex flex-wrap items-center gap-x-1 gap-y-0.5',
        'border-b border-zinc-200 dark:border-zinc-800 px-2',
        className
      )}
    >
      {tabs
        .filter((tab) => !tab.hidden)
        .map((tab) => {
          const Icon = tab.icon;
          const active = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={active}
              disabled={tab.disabled}
              onClick={() => !tab.disabled && onTabChange(tab.id)}
              className={cn(
                'inline-flex flex-shrink-0 items-center gap-2 whitespace-nowrap',
                'min-h-[44px] border-b-2 -mb-px px-3 text-sm font-medium transition-colors',
                active
                  ? 'border-teal-500 text-teal-600 dark:text-teal-400'
                  : 'border-transparent text-zinc-500 hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-100',
                tab.disabled && 'cursor-not-allowed opacity-40 hover:text-zinc-500'
              )}
            >
              {Icon && <Icon className="h-4 w-4" />}
              <span>{tab.label}</span>
              {tab.badge !== undefined && (
                <span
                  className={cn(
                    'ml-0.5 rounded-full px-1.5 py-0.5 text-xs',
                    active
                      ? 'bg-teal-100 text-teal-700 dark:bg-teal-900/40 dark:text-teal-300'
                      : 'bg-zinc-200 text-zinc-600 dark:bg-zinc-700 dark:text-zinc-300'
                  )}
                >
                  {tab.badge}
                </span>
              )}
            </button>
          );
        })}
    </div>
  );
};
