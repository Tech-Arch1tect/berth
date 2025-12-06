import React from 'react';
import { FileEntry } from '../../../types/files';
import { ContextMenu, ContextMenuItem } from './ContextMenu';

interface FileContextMenuProps {
  isOpen: boolean;
  position: { x: number; y: number };
  file: FileEntry | null;
  canWrite: boolean;
  onClose: () => void;
  onOpen: (file: FileEntry) => void;
  onRename: (file: FileEntry) => void;
  onCopy: (file: FileEntry) => void;
  onCopyPath: (file: FileEntry) => void;
  onDownload: (file: FileEntry) => void;
  onChmod: (file: FileEntry) => void;
  onChown: (file: FileEntry) => void;
  onExtractArchive: (file: FileEntry) => void;
  onDelete: (file: FileEntry) => void;
}

const ARCHIVE_EXTENSIONS = ['zip', 'tar', 'gz', 'tgz', 'bz2', 'xz', '7z', 'rar'];

const isArchiveFile = (fileName: string): boolean => {
  const ext = fileName.split('.').pop()?.toLowerCase() || '';
  return ARCHIVE_EXTENSIONS.includes(ext);
};

export const FileContextMenu: React.FC<FileContextMenuProps> = ({
  isOpen,
  position,
  file,
  canWrite,
  onClose,
  onOpen,
  onRename,
  onCopy,
  onCopyPath,
  onDownload,
  onChmod,
  onChown,
  onExtractArchive,
  onDelete,
}) => {
  if (!file) return null;

  const isArchive = isArchiveFile(file.name);

  const items: ContextMenuItem[] = [
    {
      id: 'open',
      label: 'Open',
      icon: (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
          />
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
          />
        </svg>
      ),
      onClick: () => onOpen(file),
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
      onClick: () => onRename(file),
    },
    {
      id: 'copy',
      label: 'Duplicate',
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
      disabled: !canWrite,
      onClick: () => onCopy(file),
    },
    {
      id: 'copy-path',
      label: 'Copy Path',
      icon: (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1"
          />
        </svg>
      ),
      onClick: () => onCopyPath(file),
    },
    {
      id: 'download',
      label: 'Download',
      icon: (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
          />
        </svg>
      ),
      onClick: () => onDownload(file),
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
      onClick: () => onChmod(file),
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
      onClick: () => onChown(file),
    },
    ...(isArchive
      ? [
          { id: 'sep-archive', label: '', separator: true },
          {
            id: 'extract-archive',
            label: 'Extract Archive',
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
            onClick: () => onExtractArchive(file),
          },
        ]
      : []),
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
      onClick: () => onDelete(file),
    },
  ];

  return <ContextMenu isOpen={isOpen} position={position} items={items} onClose={onClose} />;
};
