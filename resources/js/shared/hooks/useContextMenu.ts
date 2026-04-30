import { useState, useCallback, useEffect } from 'react';

interface ContextMenuPosition {
  x: number;
  y: number;
}

interface UseContextMenuReturn<T> {
  isOpen: boolean;
  position: ContextMenuPosition;
  data: T | null;
  open: (e: React.MouseEvent, data: T) => void;
  close: () => void;
}

export function useContextMenu<T>(): UseContextMenuReturn<T> {
  const [isOpen, setIsOpen] = useState(false);
  const [position, setPosition] = useState<ContextMenuPosition>({ x: 0, y: 0 });
  const [data, setData] = useState<T | null>(null);

  const open = useCallback((e: React.MouseEvent, menuData: T) => {
    e.preventDefault();
    e.stopPropagation();

    const x = e.clientX;
    const y = e.clientY;

    const adjustedX = x + 200 > window.innerWidth ? window.innerWidth - 210 : x;
    const adjustedY = y + 300 > window.innerHeight ? window.innerHeight - 310 : y;

    setPosition({ x: adjustedX, y: adjustedY });
    setData(menuData);
    setIsOpen(true);
  }, []);

  const close = useCallback(() => {
    setIsOpen(false);
    setData(null);
  }, []);

  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = () => {
      close();
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        close();
      }
    };

    const timeoutId = setTimeout(() => {
      document.addEventListener('click', handleClickOutside);
      document.addEventListener('keydown', handleKeyDown);
    }, 0);

    return () => {
      clearTimeout(timeoutId);
      document.removeEventListener('click', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, close]);

  return {
    isOpen,
    position,
    data,
    open,
    close,
  };
}
