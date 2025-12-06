import React from 'react';
import { createPortal } from 'react-dom';
import { cn } from '../../../utils/cn';
import { theme } from '../../../theme';

export interface ContextMenuItem {
  id: string;
  label: string;
  icon?: React.ReactNode;
  disabled?: boolean;
  danger?: boolean;
  separator?: boolean;
  onClick?: () => void;
}

interface ContextMenuProps {
  isOpen: boolean;
  position: { x: number; y: number };
  items: ContextMenuItem[];
  onClose: () => void;
}

export const ContextMenu: React.FC<ContextMenuProps> = ({ isOpen, position, items, onClose }) => {
  if (!isOpen) return null;

  const handleItemClick = (item: ContextMenuItem) => {
    if (item.disabled || item.separator) return;
    item.onClick?.();
    onClose();
  };

  return createPortal(
    <div
      className={cn(
        'fixed z-50 min-w-[180px] py-1.5 rounded-xl shadow-xl',
        'bg-white dark:bg-zinc-900',
        'border border-zinc-200 dark:border-zinc-800',
        'animate-in fade-in zoom-in-95 duration-100'
      )}
      style={{
        left: position.x,
        top: position.y,
      }}
      onClick={(e) => e.stopPropagation()}
    >
      {items.map((item, index) => {
        if (item.separator) {
          return (
            <div
              key={item.id || `sep-${index}`}
              className="my-1.5 border-t border-zinc-200 dark:border-zinc-800"
            />
          );
        }

        return (
          <button
            key={item.id}
            onClick={() => handleItemClick(item)}
            disabled={item.disabled}
            className={cn(
              'w-full px-3 py-2 flex items-center gap-2.5 text-sm text-left',
              'transition-colors',
              item.disabled
                ? cn(theme.text.subtle, 'cursor-not-allowed')
                : item.danger
                  ? cn(theme.text.danger, 'hover:bg-rose-50 dark:hover:bg-rose-900/20')
                  : cn(theme.text.standard, 'hover:bg-zinc-100 dark:hover:bg-zinc-800')
            )}
          >
            {item.icon && (
              <span className="w-4 h-4 flex items-center justify-center flex-shrink-0">
                {item.icon}
              </span>
            )}
            <span>{item.label}</span>
          </button>
        );
      })}
    </div>,
    document.body
  );
};
