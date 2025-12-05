import React, { useState, useCallback, useEffect } from 'react';
import { cn } from '../../../utils/cn';

interface ResizableDividerProps {
  onResize: (delta: number) => void;
}

export const ResizableDivider: React.FC<ResizableDividerProps> = ({ onResize }) => {
  const [isDragging, setIsDragging] = useState(false);
  const [startX, setStartX] = useState(0);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsDragging(true);
    setStartX(e.clientX);
  }, []);

  const handleMouseMove = useCallback(
    (e: MouseEvent) => {
      if (!isDragging) return;

      const delta = e.clientX - startX;
      onResize(delta);
      setStartX(e.clientX);
    },
    [isDragging, startX, onResize]
  );

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  useEffect(() => {
    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      document.body.style.userSelect = 'none';
      document.body.style.cursor = 'col-resize';
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      document.body.style.userSelect = '';
      document.body.style.cursor = '';
    };
  }, [isDragging, handleMouseMove, handleMouseUp]);

  return (
    <div
      className={cn(
        'flex-shrink-0 w-1 cursor-col-resize relative group',
        'bg-zinc-200 dark:bg-zinc-700',
        'hover:bg-teal-400 dark:hover:bg-teal-600',
        'transition-colors duration-150',
        isDragging && 'bg-teal-500 dark:bg-teal-500'
      )}
      onMouseDown={handleMouseDown}
    >
      <div className="absolute inset-y-0 -left-1 -right-1" />

      <div
        className={cn(
          'absolute inset-y-0 left-1/2 -translate-x-1/2 w-0.5',
          'bg-transparent group-hover:bg-teal-500 dark:group-hover:bg-teal-400',
          'transition-colors duration-150',
          isDragging && 'bg-teal-600 dark:bg-teal-400'
        )}
      />
    </div>
  );
};
