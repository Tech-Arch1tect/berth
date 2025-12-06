import React from 'react';
import { OpenTab } from '../../../types/files';
import { FileViewer } from '../FileViewer';
import { MonacoEditor } from './MonacoEditor';
import { cn } from '../../../utils/cn';
import { theme } from '../../../theme';

interface EditorContentProps {
  tab: OpenTab;
  canWrite: boolean;
  onContentChange: (content: string) => void;
  onSave?: () => void;
}

const isTextFile = (encoding: string): boolean => {
  return encoding === 'utf-8';
};

export const EditorContent: React.FC<EditorContentProps> = ({
  tab,
  canWrite,
  onContentChange,
  onSave,
}) => {
  const isText = isTextFile(tab.encoding);

  if (!isText) {
    return (
      <div className="flex-1 overflow-auto">
        <FileViewer
          file={{
            path: tab.path,
            content: tab.content,
            size: tab.size,
            encoding: tab.encoding,
          }}
        />
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <div className="flex-1 min-h-0">
        <MonacoEditor
          value={tab.content}
          path={tab.path}
          readOnly={!canWrite}
          onChange={onContentChange}
          onSave={onSave}
        />
      </div>

      {!canWrite && (
        <div
          className={cn(
            'flex-shrink-0 px-4 py-2',
            theme.intent.warning.surface,
            'border-t',
            theme.intent.warning.border
          )}
        >
          <p className={cn('text-sm flex items-center gap-2', theme.intent.warning.textStrong)}>
            <svg className="w-4 h-4 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
              <path
                fillRule="evenodd"
                d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
                clipRule="evenodd"
              />
            </svg>
            Read-only: You don't have write permissions for this file.
          </p>
        </div>
      )}
    </div>
  );
};
