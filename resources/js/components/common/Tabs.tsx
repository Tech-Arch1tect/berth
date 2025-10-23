import React from 'react';
import { cn } from '../../utils/cn';
import { theme } from '../../theme';

export interface Tab {
  id: string;
  label: string;
  icon?: React.ComponentType<{ className?: string }>;
  disabled?: boolean;
  hidden?: boolean;
  badge?: string | number;
}

export interface TabsProps {
  tabs: Tab[];
  activeTab: string;
  onTabChange: (tabId: string) => void;
  children: React.ReactNode;
  className?: string;
  noPadding?: boolean;
}

export const Tabs: React.FC<TabsProps> = ({
  tabs,
  activeTab,
  onTabChange,
  children,
  className,
  noPadding = false,
}) => {
  return (
    <div className={cn(theme.containers.cardSoft, 'rounded-2xl overflow-hidden', className)}>
      <div className={theme.cards.sectionDivider}>
        <nav className="flex space-x-1 p-2">
          {tabs
            .filter((tab) => !tab.hidden)
            .map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => !tab.disabled && onTabChange(tab.id)}
                  disabled={tab.disabled}
                  className={cn(
                    'flex items-center space-x-2 px-4 py-2 rounded-xl text-sm font-medium transition-all duration-200',
                    activeTab === tab.id
                      ? cn(
                          theme.effects.emptyAura,
                          theme.text.info,
                          'shadow-sm border border-blue-200/20 dark:border-blue-800/20'
                        )
                      : cn(
                          theme.text.muted,
                          'hover:bg-slate-100/50 dark:hover:bg-slate-800/50 hover:text-slate-900 dark:hover:text-white'
                        ),
                    tab.disabled && 'opacity-50 cursor-not-allowed'
                  )}
                >
                  {Icon && <Icon className="w-4 h-4" />}
                  <span>{tab.label}</span>
                  {tab.badge !== undefined && (
                    <span
                      className={cn(
                        'ml-1 px-2 py-0.5 text-xs font-semibold rounded-full',
                        activeTab === tab.id
                          ? cn(theme.intent.info.icon)
                          : 'bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-300'
                      )}
                    >
                      {tab.badge}
                    </span>
                  )}
                </button>
              );
            })}
        </nav>
      </div>
      <div className={noPadding ? '' : 'p-6'}>{children}</div>
    </div>
  );
};
