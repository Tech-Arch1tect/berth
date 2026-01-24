import React, { useState, useCallback } from 'react';
import type { GetApiV1ServersServeridStacksStacknameFiles200EntriesItem } from '../../../api/generated/models';
import { FileTreeNode } from './FileTreeNode';
import { cn } from '../../../utils/cn';
import { theme } from '../../../theme';

interface FileTreeProps {
  entries: GetApiV1ServersServeridStacksStacknameFiles200EntriesItem[];
  rootPath: string;
  onSelect: (entry: GetApiV1ServersServeridStacksStacknameFiles200EntriesItem) => void;
  onContextMenu: (
    e: React.MouseEvent,
    entry: GetApiV1ServersServeridStacksStacknameFiles200EntriesItem
  ) => void;
  onBackgroundContextMenu?: (e: React.MouseEvent) => void;
  onMove?: (sourcePath: string, targetDirectory: string) => void;
  canWrite?: boolean;
  isExpanded: (path: string) => boolean;
  isSelected: (path: string) => boolean;
  isLoading: (path: string) => boolean;
  getChildren: (path: string) => GetApiV1ServersServeridStacksStacknameFiles200EntriesItem[];
}

export const FileTree: React.FC<FileTreeProps> = ({
  entries,
  rootPath,
  onSelect,
  onContextMenu,
  onBackgroundContextMenu,
  onMove,
  canWrite = false,
  isExpanded,
  isSelected,
  isLoading,
  getChildren,
}) => {
  const sortedEntries = React.useMemo(() => {
    return [...entries].sort((a, b) => {
      if (a.is_directory && !b.is_directory) return -1;
      if (!a.is_directory && b.is_directory) return 1;
      return a.name.localeCompare(b.name);
    });
  }, [entries]);

  const [isRootDragOver, setIsRootDragOver] = useState(false);

  const handleRootDragOver = useCallback(
    (e: React.DragEvent) => {
      if (!canWrite) return;
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
    },
    [canWrite]
  );

  const handleRootDragEnter = useCallback(
    (e: React.DragEvent) => {
      if (!canWrite) return;
      e.preventDefault();
      setIsRootDragOver(true);
    },
    [canWrite]
  );

  const handleRootDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsRootDragOver(false);
  }, []);

  const handleRootDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsRootDragOver(false);

      if (!canWrite || !onMove) return;

      const sourcePath = e.dataTransfer.getData('text/plain');
      if (!sourcePath) return;

      onMove(sourcePath, '');
    },
    [canWrite, onMove]
  );

  const handleBackgroundContextMenu = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      onBackgroundContextMenu?.(e);
    },
    [onBackgroundContextMenu]
  );

  return (
    <div className="py-1 h-full" onContextMenu={handleBackgroundContextMenu}>
      <div
        className={cn(
          'flex items-center h-7 select-none px-2',
          'border-b border-zinc-100 dark:border-zinc-800',
          'mb-1',
          isRootDragOver && 'bg-blue-100 dark:bg-blue-900/30 ring-1 ring-blue-400'
        )}
        onDragOver={handleRootDragOver}
        onDragEnter={handleRootDragEnter}
        onDragLeave={handleRootDragLeave}
        onDrop={handleRootDrop}
      >
        <span
          className={cn('text-xs font-medium truncate', theme.text.subtle)}
          title={rootPath || '/'}
        >
          {rootPath || '/'}
        </span>
      </div>

      {sortedEntries.map((entry) => (
        <FileTreeNode
          key={entry.path}
          entry={entry}
          depth={0}
          isExpanded={isExpanded(entry.path)}
          isSelected={isSelected(entry.path)}
          isLoading={isLoading(entry.path)}
          children={getChildren(entry.path)}
          onSelect={onSelect}
          onContextMenu={onContextMenu}
          onMove={onMove}
          canWrite={canWrite}
          getChildren={getChildren}
          checkExpanded={isExpanded}
          checkSelected={isSelected}
          checkLoading={isLoading}
        />
      ))}

      {sortedEntries.length === 0 && (
        <div className="px-4 py-8 text-center">
          <svg
            className="w-12 h-12 mx-auto text-zinc-300 dark:text-zinc-600 mb-3"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z"
            />
          </svg>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">No files found</p>
        </div>
      )}
    </div>
  );
};
