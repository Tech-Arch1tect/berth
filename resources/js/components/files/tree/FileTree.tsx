import React from 'react';
import { FileEntry, FileOperation } from '../../../types/files';
import { FileTreeNode } from './FileTreeNode';
import { cn } from '../../../utils/cn';

interface FileTreeProps {
  entries: FileEntry[];
  currentPath: string;
  expandedNodes: Set<string>;
  selectedNode: string | null;
  onSelect: (entry: FileEntry) => void;
  onContextMenu: (e: React.MouseEvent, entry: FileEntry) => void;
  onNavigateUp?: () => void;
  isExpanded: (path: string) => boolean;
  isSelected: (path: string) => boolean;
}

export const FileTree: React.FC<FileTreeProps> = ({
  entries,
  currentPath,
  onSelect,
  onContextMenu,
  onNavigateUp,
  isExpanded,
  isSelected,
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
      {currentPath && onNavigateUp && (
        <div
          className={cn(
            'flex items-center h-7 cursor-pointer select-none px-2',
            'hover:bg-zinc-100 dark:hover:bg-zinc-800',
            'transition-colors duration-75'
          )}
          onClick={onNavigateUp}
        >
          <div className="w-4 h-4 flex items-center justify-center flex-shrink-0">
            <svg
              className="w-3 h-3 text-zinc-400 dark:text-zinc-500"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M15 19l-7-7 7-7"
              />
            </svg>
          </div>
          <div className="w-4 h-4 flex items-center justify-center flex-shrink-0 mr-1.5">
            <svg className="w-4 h-4 text-zinc-400" fill="currentColor" viewBox="0 0 20 20">
              <path d="M2 6a2 2 0 012-2h5l2 2h5a2 2 0 012 2v6a2 2 0 01-2 2H4a2 2 0 01-2-2V6z" />
            </svg>
          </div>
          <span className="text-sm text-zinc-500 dark:text-zinc-400">..</span>
        </div>
      )}

      {sortedEntries.map((entry) => (
        <FileTreeNode
          key={entry.path}
          entry={entry}
          depth={0}
          isExpanded={isExpanded(entry.path)}
          isSelected={isSelected(entry.path)}
          onSelect={onSelect}
          onContextMenu={onContextMenu}
        />
      ))}

      {sortedEntries.length === 0 && !currentPath && (
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
