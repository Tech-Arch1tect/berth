import React from 'react';
import { FileEntry } from '../../../types/files';
import { FileIcon } from '../FileIcon';
import { cn } from '../../../utils/cn';
import { theme } from '../../../theme';

interface FileTreeNodeProps {
  entry: FileEntry;
  depth: number;
  isExpanded: boolean;
  isSelected: boolean;
  onSelect: (entry: FileEntry) => void;
  onContextMenu: (e: React.MouseEvent, entry: FileEntry) => void;
}

export const FileTreeNode: React.FC<FileTreeNodeProps> = ({
  entry,
  depth,
  isExpanded,
  isSelected,
  onSelect,
  onContextMenu,
}) => {
  const paddingLeft = 8 + depth * 16;

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onSelect(entry);
  };

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    onContextMenu(e, entry);
  };

  return (
    <div
      className={cn(
        'flex items-center h-7 cursor-pointer select-none',
        'hover:bg-zinc-100 dark:hover:bg-zinc-800',
        'transition-colors duration-75',
        isSelected && theme.intent.info.surface
      )}
      style={{ paddingLeft: `${paddingLeft}px` }}
      onClick={handleClick}
      onContextMenu={handleContextMenu}
    >
      <div className="w-4 h-4 flex items-center justify-center flex-shrink-0">
        {entry.is_directory && (
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
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        )}
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
  );
};
