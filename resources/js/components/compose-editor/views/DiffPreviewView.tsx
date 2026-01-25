import React, { useState, useEffect, useCallback } from 'react';
import ReactDiffViewer from 'react-diff-viewer-continued';
import { cn } from '../../../utils/cn';
import { theme } from '../../../theme';
import { StackService } from '../../../services/stackService';
import { ComposeChanges } from '../../../types/compose';
import { ArrowPathIcon } from '@heroicons/react/24/outline';

interface DiffPreviewViewProps {
  serverId: number;
  stackName: string;
  changes: ComposeChanges;
  csrfToken?: string;
  hasChanges: boolean;
}

export const DiffPreviewView: React.FC<DiffPreviewViewProps> = ({
  serverId,
  stackName,
  changes,
  csrfToken,
  hasChanges,
}) => {
  const [originalYaml, setOriginalYaml] = useState<string>('');
  const [modifiedYaml, setModifiedYaml] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [splitView, setSplitView] = useState(true);

  const fetchPreview = useCallback(async () => {
    if (!hasChanges) {
      setOriginalYaml('');
      setModifiedYaml('');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await StackService.updateCompose(serverId, stackName, {
        changes,
        preview: true,
      });

      if (response.original_yaml && response.modified_yaml) {
        setOriginalYaml(response.original_yaml);
        setModifiedYaml(response.modified_yaml);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate preview');
    } finally {
      setLoading(false);
    }
  }, [hasChanges, serverId, stackName, changes, csrfToken]);

  useEffect(() => {
    fetchPreview();
  }, [fetchPreview]);

  if (!hasChanges) {
    return (
      <div className={cn('flex items-center justify-center h-64', theme.text.muted)}>
        <p className="text-sm italic">No changes to preview</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="flex items-center gap-2">
          <ArrowPathIcon className="w-5 h-5 animate-spin text-teal-500" />
          <span className={theme.text.muted}>Generating preview...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={cn('p-4 rounded-lg', theme.intent.danger.surface)}>
        <p className={theme.intent.danger.textStrong}>{error}</p>
        <button
          onClick={fetchPreview}
          className={cn('mt-2 text-sm underline', theme.intent.danger.textMuted)}
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button
            onClick={() => setSplitView(!splitView)}
            className={cn(theme.forms.compact.selectSmall, 'cursor-pointer')}
          >
            {splitView ? 'Side by Side' : 'Unified'}
          </button>
          <button onClick={fetchPreview} className={cn(theme.forms.compact.addButton)}>
            <ArrowPathIcon className="w-3 h-3" />
            Refresh
          </button>
        </div>
        <div className={cn('text-xs', theme.text.subtle)}>
          {originalYaml === modifiedYaml ? (
            <span>No differences detected</span>
          ) : (
            <span>Changes detected</span>
          )}
        </div>
      </div>

      <div className="rounded-lg overflow-hidden border border-zinc-200 dark:border-zinc-700 [&_pre]:whitespace-pre [&_td]:whitespace-pre [&_span]:whitespace-pre [&_span]:!inline">
        <ReactDiffViewer
          oldValue={originalYaml}
          newValue={modifiedYaml}
          splitView={splitView}
          useDarkTheme={document.documentElement.classList.contains('dark')}
          leftTitle="Current"
          rightTitle="After Changes"
          showDiffOnly={false}
          styles={{
            variables: {
              dark: {
                diffViewerBackground: '#18181b',
                diffViewerColor: '#f4f4f5',
                addedBackground: '#052e16',
                addedColor: '#86efac',
                removedBackground: '#450a0a',
                removedColor: '#fca5a5',
                wordAddedBackground: '#14532d',
                wordRemovedBackground: '#7f1d1d',
                addedGutterBackground: '#052e16',
                removedGutterBackground: '#450a0a',
                gutterBackground: '#27272a',
                gutterBackgroundDark: '#18181b',
                highlightBackground: '#3f3f46',
                highlightGutterBackground: '#52525b',
                codeFoldGutterBackground: '#27272a',
                codeFoldBackground: '#27272a',
                emptyLineBackground: '#27272a',
                gutterColor: '#a1a1aa',
                addedGutterColor: '#86efac',
                removedGutterColor: '#fca5a5',
                codeFoldContentColor: '#71717a',
                diffViewerTitleBackground: '#27272a',
                diffViewerTitleColor: '#f4f4f5',
                diffViewerTitleBorderColor: '#3f3f46',
              },
              light: {
                diffViewerBackground: '#ffffff',
                diffViewerColor: '#18181b',
                addedBackground: '#dcfce7',
                addedColor: '#166534',
                removedBackground: '#fee2e2',
                removedColor: '#991b1b',
                wordAddedBackground: '#bbf7d0',
                wordRemovedBackground: '#fecaca',
                addedGutterBackground: '#dcfce7',
                removedGutterBackground: '#fee2e2',
                gutterBackground: '#f4f4f5',
                gutterBackgroundDark: '#e4e4e7',
                highlightBackground: '#fef9c3',
                highlightGutterBackground: '#fef08a',
                codeFoldGutterBackground: '#f4f4f5',
                codeFoldBackground: '#f4f4f5',
                emptyLineBackground: '#f4f4f5',
                gutterColor: '#71717a',
                addedGutterColor: '#166534',
                removedGutterColor: '#991b1b',
                codeFoldContentColor: '#a1a1aa',
                diffViewerTitleBackground: '#f4f4f5',
                diffViewerTitleColor: '#18181b',
                diffViewerTitleBorderColor: '#e4e4e7',
              },
            },
            contentText: {
              fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
              fontSize: '13px',
              lineHeight: '1.5',
              whiteSpace: 'pre',
            },
          }}
        />
      </div>
    </div>
  );
};
