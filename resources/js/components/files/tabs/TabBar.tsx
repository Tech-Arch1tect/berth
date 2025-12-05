import React, { useRef, useEffect } from 'react';
import { OpenTab } from '../../../types/files';
import { Tab } from './Tab';
import { cn } from '../../../utils/cn';
import { theme } from '../../../theme';

interface TabBarProps {
  tabs: OpenTab[];
  activeTabId: string | null;
  onSelectTab: (tabId: string) => void;
  onCloseTab: (tabId: string) => void;
  onContextMenu: (e: React.MouseEvent, tab: OpenTab) => void;
}

export const TabBar: React.FC<TabBarProps> = ({
  tabs,
  activeTabId,
  onSelectTab,
  onCloseTab,
  onContextMenu,
}) => {
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!activeTabId || !scrollContainerRef.current) return;

    const activeTab = scrollContainerRef.current.querySelector(`[data-tab-id="${activeTabId}"]`);
    if (activeTab) {
      activeTab.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'nearest' });
    }
  }, [activeTabId]);

  if (tabs.length === 0) {
    return null;
  }

  return (
    <div
      className={cn(
        'flex-shrink-0 flex items-stretch',
        theme.surface.muted,
        'border-b border-zinc-200 dark:border-zinc-800',
        'overflow-hidden'
      )}
    >
      <div
        ref={scrollContainerRef}
        className="flex-1 flex overflow-x-auto scrollbar-thin scrollbar-thumb-zinc-300 dark:scrollbar-thumb-zinc-600"
      >
        {tabs.map((tab) => (
          <div key={tab.id} data-tab-id={tab.id}>
            <Tab
              tab={tab}
              isActive={tab.id === activeTabId}
              onSelect={onSelectTab}
              onClose={onCloseTab}
              onMiddleClick={onCloseTab}
              onContextMenu={onContextMenu}
            />
          </div>
        ))}
      </div>
    </div>
  );
};
