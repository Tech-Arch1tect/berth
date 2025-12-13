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
  const [isDragging, setIsDragging] = useState(false);

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

      const dragImage = document.createElement('div');
      dragImage.className =
        'px-3 py-2 bg-blue-500 text-white rounded-lg shadow-lg flex items-center space-x-2 font-medium text-sm';
      dragImage.style.position = 'absolute';
      dragImage.style.top = '-1000px';
      dragImage.innerHTML = `
        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="${
            entry.is_directory
              ? 'M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z'
              : 'M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z'
          }" />
        </svg>
        <span>${entry.name}</span>
      `;
      document.body.appendChild(dragImage);
      e.dataTransfer.setDragImage(dragImage, 0, 0);
      setTimeout(() => document.body.removeChild(dragImage), 0);

      setIsDragging(true);
    },
    [canWrite, entry.path, entry.name, entry.is_directory]
  );

  const isValidDropTarget = useCallback(
    (sourcePath: string): boolean => {
      if (!entry.is_directory || !canWrite) return false;
      if (!sourcePath) return false;

      const normalizedSource = sourcePath.replace(/\/+$/, '');
      const normalizedTarget = entry.path.replace(/\/+$/, '');

      if (normalizedSource === normalizedTarget) return false;

      if (normalizedTarget.startsWith(normalizedSource + '/')) return false;

      return true;
    },
    [entry.is_directory, entry.path, canWrite]
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
      e.stopPropagation();

      setIsDragOver(true);
    },
    [entry.is_directory, canWrite]
  );

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    const relatedTarget = e.relatedTarget as HTMLElement;
    if (!relatedTarget || !e.currentTarget.contains(relatedTarget)) {
      setIsDragOver(false);
    }
  }, []);

  const handleDragEnd = useCallback(() => {
    setIsDragging(false);
    setIsDragOver(false);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragOver(false);
      setIsDragging(false);

      if (!entry.is_directory || !canWrite || !onMove) return;

      const sourcePath = e.dataTransfer.getData('text/plain');
      if (!isValidDropTarget(sourcePath)) return;

      onMove(sourcePath, entry.path);
    },
    [entry.is_directory, entry.path, canWrite, onMove, isValidDropTarget]
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
          'flex items-center h-7 select-none',
          'transition-all duration-150',
          isDragging && 'opacity-40',
          !isDragging && 'cursor-pointer hover:bg-zinc-100 dark:hover:bg-zinc-800',
          isSelected && !isDragOver && theme.intent.info.surface,
          isDragOver &&
            'bg-blue-500/10 dark:bg-blue-500/20 ring-2 ring-blue-500 ring-inset shadow-sm'
        )}
        style={{ paddingLeft: `${paddingLeft}px` }}
        onClick={handleClick}
        onContextMenu={handleContextMenu}
        draggable={canWrite}
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragEnter={handleDragEnter}
        onDragLeave={handleDragLeave}
        onDragEnd={handleDragEnd}
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

        {isDragOver && (
          <div className="flex items-center space-x-1 ml-2 mr-2">
            <svg
              className="w-3 h-3 text-blue-600 dark:text-blue-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
            <span className="text-xs font-medium text-blue-600 dark:text-blue-400 whitespace-nowrap">
              Move here
            </span>
          </div>
        )}
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
