import React from 'react';
import { ContextMenu, ContextMenuItem } from './ContextMenu';

interface TreeContextMenuProps {
  isOpen: boolean;
  position: { x: number; y: number };
  canWrite: boolean;
  onClose: () => void;
  onNewFile: () => void;
  onNewFolder: () => void;
  onUpload: () => void;
  onCreateArchive: () => void;
}

export const TreeContextMenu: React.FC<TreeContextMenuProps> = ({
  isOpen,
  position,
  canWrite,
  onClose,
  onNewFile,
  onNewFolder,
  onUpload,
  onCreateArchive,
}) => {
  const items: ContextMenuItem[] = [
    {
      id: 'new-file',
      label: 'New File',
      icon: (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M9 13h6m-3-3v6m5 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
          />
        </svg>
      ),
      disabled: !canWrite,
      onClick: onNewFile,
    },
    {
      id: 'new-folder',
      label: 'New Folder',
      icon: (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M9 13h6m-3-3v6m-9 1V7a2 2 0 012-2h6l2 2h6a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2z"
          />
        </svg>
      ),
      disabled: !canWrite,
      onClick: onNewFolder,
    },
    {
      id: 'upload',
      label: 'Upload Files',
      icon: (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"
          />
        </svg>
      ),
      disabled: !canWrite,
      onClick: onUpload,
    },
    { id: 'sep-1', label: '', separator: true },
    {
      id: 'create-archive',
      label: 'Create Archive of Root',
      icon: (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4"
          />
        </svg>
      ),
      disabled: !canWrite,
      onClick: onCreateArchive,
    },
  ];

  return <ContextMenu isOpen={isOpen} position={position} items={items} onClose={onClose} />;
};
