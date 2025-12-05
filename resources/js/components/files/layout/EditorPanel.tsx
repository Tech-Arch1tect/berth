import React from 'react';
import { cn } from '../../../utils/cn';

interface EditorPanelProps {
  children: React.ReactNode;
}

export const EditorPanel: React.FC<EditorPanelProps> = ({ children }) => {
  return (
    <div
      className={cn('flex-1 flex flex-col overflow-hidden min-w-0', 'bg-white dark:bg-zinc-900')}
    >
      {children}
    </div>
  );
};
