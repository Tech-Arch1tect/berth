import React from 'react';
import { OpenTab } from '../../../types/files';
import { ContextMenu, ContextMenuItem } from './ContextMenu';

interface TabContextMenuProps {
  isOpen: boolean;
  position: { x: number; y: number };
  tab: OpenTab | null;
  onClose: () => void;
  onCloseTab: (tab: OpenTab) => void;
  onCloseOthers: (tab: OpenTab) => void;
  onCloseAll: () => void;
  onCopyPath: (tab: OpenTab) => void;
}

export const TabContextMenu: React.FC<TabContextMenuProps> = ({
  isOpen,
  position,
  tab,
  onClose,
  onCloseTab,
  onCloseOthers,
  onCloseAll,
  onCopyPath,
}) => {
  if (!tab) return null;

  const items: ContextMenuItem[] = [
    {
      id: 'close',
      label: 'Close',
      icon: (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M6 18L18 6M6 6l12 12"
          />
        </svg>
      ),
      onClick: () => onCloseTab(tab),
    },
    {
      id: 'close-others',
      label: 'Close Others',
      icon: (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
          />
        </svg>
      ),
      onClick: () => onCloseOthers(tab),
    },
    {
      id: 'close-all',
      label: 'Close All',
      icon: (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
          />
        </svg>
      ),
      onClick: () => onCloseAll(),
    },
    { id: 'sep-1', label: '', separator: true },
    {
      id: 'copy-path',
      label: 'Copy Path',
      icon: (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
          />
        </svg>
      ),
      onClick: () => onCopyPath(tab),
    },
  ];

  return <ContextMenu isOpen={isOpen} position={position} items={items} onClose={onClose} />;
};
