import React from 'react';
import { OpenTab } from '../../../types/files';
import { WelcomeScreen } from './WelcomeScreen';
import { EditorHeader } from './EditorHeader';
import { EditorContent } from './EditorContent';
import { cn } from '../../../utils/cn';

interface EditorAreaProps {
  activeTab: OpenTab | null;
  canWrite: boolean;
  isSaving: boolean;
  onSave: () => void;
  onContentChange: (content: string) => void;
}

export const EditorArea: React.FC<EditorAreaProps> = ({
  activeTab,
  canWrite,
  isSaving,
  onSave,
  onContentChange,
}) => {
  if (!activeTab) {
    return (
      <div className={cn('flex-1 flex flex-col', 'bg-white dark:bg-zinc-900')}>
        <WelcomeScreen />
      </div>
    );
  }

  return (
    <div className={cn('flex-1 flex flex-col overflow-hidden', 'bg-white dark:bg-zinc-900')}>
      <EditorHeader tab={activeTab} canWrite={canWrite} isSaving={isSaving} onSave={onSave} />
      <EditorContent
        tab={activeTab}
        canWrite={canWrite}
        onContentChange={onContentChange}
        onSave={onSave}
      />
    </div>
  );
};
