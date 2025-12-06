import React from 'react';
import { OpenTab } from '../../../types/files';
import { FileIcon } from '../FileIcon';
import { cn } from '../../../utils/cn';
import { theme } from '../../../theme';

interface TabProps {
  tab: OpenTab;
  isActive: boolean;
  onSelect: (tabId: string) => void;
  onClose: (tabId: string) => void;
  onMiddleClick: (tabId: string) => void;
  onContextMenu: (e: React.MouseEvent, tab: OpenTab) => void;
}

export const Tab: React.FC<TabProps> = ({
  tab,
  isActive,
  onSelect,
  onClose,
  onMiddleClick,
  onContextMenu,
}) => {
  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault();
    onSelect(tab.id);
  };

  const handleMiddleClick = (e: React.MouseEvent) => {
    if (e.button === 1) {
      e.preventDefault();
      onMiddleClick(tab.id);
    }
  };

  const handleClose = (e: React.MouseEvent) => {
    e.stopPropagation();
    onClose(tab.id);
  };

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    onContextMenu(e, tab);
  };

  return (
    <div
      className={cn(
        'group flex items-center h-9 px-3 gap-2 cursor-pointer select-none',
        'border-r border-zinc-200 dark:border-zinc-700',
        'transition-colors duration-75',
        isActive
          ? 'bg-white dark:bg-zinc-900 border-b-2 border-b-teal-500'
          : 'bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-850'
      )}
      onClick={handleClick}
      onMouseDown={handleMiddleClick}
      onContextMenu={handleContextMenu}
    >
      <FileIcon fileName={tab.name} isDirectory={false} className="w-4 h-4 flex-shrink-0" />

      <span
        className={cn(
          'text-sm truncate max-w-32',
          isActive ? cn(theme.text.strong, 'font-medium') : theme.text.muted
        )}
        title={tab.path}
      >
        {tab.name}
      </span>

      <div className="w-4 h-4 flex items-center justify-center flex-shrink-0">
        {tab.isDirty ? (
          <div
            className={cn(
              'w-2 h-2 rounded-full',
              'bg-zinc-400 dark:bg-zinc-500',
              'group-hover:hidden'
            )}
          />
        ) : null}

        <button
          onClick={handleClose}
          className={cn(
            'w-4 h-4 rounded flex items-center justify-center',
            'text-zinc-400 hover:text-zinc-600 dark:text-zinc-500 dark:hover:text-zinc-300',
            'hover:bg-zinc-200 dark:hover:bg-zinc-700',
            'transition-colors',
            tab.isDirty ? 'hidden group-hover:flex' : 'opacity-0 group-hover:opacity-100'
          )}
          title="Close"
        >
          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M6 18L18 6M6 6l12 12"
            />
          </svg>
        </button>
      </div>
    </div>
  );
};
