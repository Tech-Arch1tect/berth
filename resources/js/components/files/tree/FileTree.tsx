import React from 'react';
import { FileEntry } from '../../../types/files';
import { FileTreeNode } from './FileTreeNode';
import { cn } from '../../../utils/cn';
import { theme } from '../../../theme';

interface FileTreeProps {
  entries: FileEntry[];
  rootPath: string;
  onSelect: (entry: FileEntry) => void;
  onContextMenu: (e: React.MouseEvent, entry: FileEntry) => void;
  isExpanded: (path: string) => boolean;
  isSelected: (path: string) => boolean;
  isLoading: (path: string) => boolean;
  getChildren: (path: string) => FileEntry[];
}

export const FileTree: React.FC<FileTreeProps> = ({
  entries,
  rootPath,
  onSelect,
  onContextMenu,
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

  return (
    <div className="py-1">
      {rootPath && (
        <div
          className={cn(
            'flex items-center h-7 select-none px-2',
            'border-b border-zinc-100 dark:border-zinc-800',
            'mb-1'
          )}
        >
          <span className={cn('text-xs font-medium truncate', theme.text.subtle)} title={rootPath}>
            {rootPath}
          </span>
        </div>
      )}

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
