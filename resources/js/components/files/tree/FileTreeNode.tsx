import React, { useState, useCallback } from 'react';
import { FileEntry } from '../../../types/files';
import { FileIcon } from '../FileIcon';
import { cn } from '../../../utils/cn';
import { theme } from '../../../theme';

interface FileTreeNodeProps {
  entry: FileEntry;
  depth: number;
  isExpanded: boolean;
  isSelected: boolean;
  isLoading: boolean;
  children: FileEntry[];
  onSelect: (entry: FileEntry) => void;
  onContextMenu: (e: React.MouseEvent, entry: FileEntry) => void;
  onMove?: (sourcePath: string, targetDirectory: string) => void;
  canWrite?: boolean;
  getChildren: (path: string) => FileEntry[];
  checkExpanded: (path: string) => boolean;
  checkSelected: (path: string) => boolean;
  checkLoading: (path: string) => boolean;
}

export const FileTreeNode: React.FC<FileTreeNodeProps> = ({
  entry,
  depth,
  isExpanded,
  isSelected,
  isLoading,
  children,
  onSelect,
  onContextMenu,
  onMove,
  canWrite = false,
  getChildren,
  checkExpanded,
  checkSelected,
  checkLoading,
}) => {
  const paddingLeft = 8 + depth * 16;
  const [isDragOver, setIsDragOver] = useState(false);

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onSelect(entry);
  };

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    onContextMenu(e, entry);
  };

  const handleDragStart = useCallback(
    (e: React.DragEvent) => {
      if (!canWrite) {
        e.preventDefault();
        return;
      }
      e.dataTransfer.setData('text/plain', entry.path);
      e.dataTransfer.effectAllowed = 'move';
    },
    [canWrite, entry.path]
  );

  const handleDragOver = useCallback(
    (e: React.DragEvent) => {
      if (!entry.is_directory || !canWrite) return;
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
    },
    [entry.is_directory, canWrite]
  );

  const handleDragEnter = useCallback(
    (e: React.DragEvent) => {
      if (!entry.is_directory || !canWrite) return;
      e.preventDefault();
      setIsDragOver(true);
    },
    [entry.is_directory, canWrite]
  );

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragOver(false);

      if (!entry.is_directory || !canWrite || !onMove) return;

      const sourcePath = e.dataTransfer.getData('text/plain');
      if (!sourcePath || sourcePath === entry.path) return;

      if (entry.path.startsWith(sourcePath + '/')) return;

      onMove(sourcePath, entry.path);
    },
    [entry.is_directory, entry.path, canWrite, onMove]
  );

  const sortedChildren = React.useMemo(() => {
    return [...children].sort((a, b) => {
      if (a.is_directory && !b.is_directory) return -1;
      if (!a.is_directory && b.is_directory) return 1;
      return a.name.localeCompare(b.name);
    });
  }, [children]);

  return (
    <>
      <div
        className={cn(
          'flex items-center h-7 cursor-pointer select-none',
          'hover:bg-zinc-100 dark:hover:bg-zinc-800',
          'transition-colors duration-75',
          isSelected && theme.intent.info.surface,
          isDragOver && 'bg-blue-100 dark:bg-blue-900/30 ring-1 ring-blue-400'
        )}
        style={{ paddingLeft: `${paddingLeft}px` }}
        onClick={handleClick}
        onContextMenu={handleContextMenu}
        draggable={canWrite}
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragEnter={handleDragEnter}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        <div className="w-4 h-4 flex items-center justify-center flex-shrink-0">
          {entry.is_directory &&
            (isLoading ? (
              <div
                className={cn(
                  'w-3 h-3 border-2 border-t-transparent rounded-full animate-spin',
                  theme.text.subtle
                )}
              />
            ) : (
              <svg
                className={cn(
                  'w-3 h-3 transition-transform duration-150',
                  theme.text.subtle,
                  isExpanded && 'rotate-90'
                )}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 5l7 7-7 7"
                />
              </svg>
            ))}
        </div>

        <div className="w-4 h-4 flex items-center justify-center flex-shrink-0 mr-1.5">
          <FileIcon fileName={entry.name} isDirectory={entry.is_directory} className="w-4 h-4" />
        </div>

        <span
          className={cn(
            'text-sm truncate flex-1',
            isSelected ? cn(theme.intent.info.textStrong, 'font-medium') : theme.text.standard
          )}
          title={entry.name}
        >
          {entry.name}
        </span>
      </div>

      {entry.is_directory && isExpanded && (
        <div>
          {sortedChildren.map((child) => (
            <FileTreeNode
              key={child.path}
              entry={child}
              depth={depth + 1}
              isExpanded={checkExpanded(child.path)}
              isSelected={checkSelected(child.path)}
              isLoading={checkLoading(child.path)}
              children={getChildren(child.path)}
              onSelect={onSelect}
              onContextMenu={onContextMenu}
              onMove={onMove}
              canWrite={canWrite}
              getChildren={getChildren}
              checkExpanded={checkExpanded}
              checkSelected={checkSelected}
              checkLoading={checkLoading}
            />
          ))}
        </div>
      )}
    </>
  );
};
