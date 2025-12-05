import React from 'react';
import { FileEntry } from '../../../types/files';
import { ContextMenu, ContextMenuItem } from './ContextMenu';

interface FolderContextMenuProps {
  isOpen: boolean;
  position: { x: number; y: number };
  folder: FileEntry | null;
  canWrite: boolean;
  onClose: () => void;
  onNewFile: (folder: FileEntry) => void;
  onNewFolder: (folder: FileEntry) => void;
  onRename: (folder: FileEntry) => void;
  onChmod: (folder: FileEntry) => void;
  onChown: (folder: FileEntry) => void;
  onDelete: (folder: FileEntry) => void;
}

export const FolderContextMenu: React.FC<FolderContextMenuProps> = ({
  isOpen,
  position,
  folder,
  canWrite,
  onClose,
  onNewFile,
  onNewFolder,
  onRename,
  onChmod,
  onChown,
  onDelete,
}) => {
  if (!folder) return null;

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
      onClick: () => onNewFile(folder),
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
      onClick: () => onNewFolder(folder),
    },
    { id: 'sep-1', label: '', separator: true },
    {
      id: 'rename',
      label: 'Rename',
      icon: (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
          />
        </svg>
      ),
      disabled: !canWrite,
      onClick: () => onRename(folder),
    },
    { id: 'sep-2', label: '', separator: true },
    {
      id: 'chmod',
      label: 'Permissions',
      icon: (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
          />
        </svg>
      ),
      disabled: !canWrite,
      onClick: () => onChmod(folder),
    },
    {
      id: 'chown',
      label: 'Ownership',
      icon: (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
          />
        </svg>
      ),
      disabled: !canWrite,
      onClick: () => onChown(folder),
    },
    { id: 'sep-3', label: '', separator: true },
    {
      id: 'delete',
      label: 'Delete',
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
      danger: true,
      disabled: !canWrite,
      onClick: () => onDelete(folder),
    },
  ];

  return <ContextMenu isOpen={isOpen} position={position} items={items} onClose={onClose} />;
};
