import React from 'react';
import { OpenTab } from '../../types/files';
import { cn } from '../../utils/cn';
import { theme } from '../../theme';

interface StatusBarProps {
  activeTab: OpenTab | null;
  canWrite: boolean;
}

const getLanguage = (filename: string): string => {
  const ext = filename.split('.').pop()?.toLowerCase() || '';
  const languageMap: Record<string, string> = {
    ts: 'TypeScript',
    tsx: 'TypeScript React',
    js: 'JavaScript',
    jsx: 'JavaScript React',
    json: 'JSON',
    md: 'Markdown',
    css: 'CSS',
    scss: 'SCSS',
    less: 'LESS',
    html: 'HTML',
    xml: 'XML',
    yaml: 'YAML',
    yml: 'YAML',
    py: 'Python',
    go: 'Go',
    rs: 'Rust',
    java: 'Java',
    c: 'C',
    cpp: 'C++',
    h: 'C Header',
    hpp: 'C++ Header',
    php: 'PHP',
    rb: 'Ruby',
    sh: 'Shell',
    bash: 'Bash',
    zsh: 'Zsh',
    sql: 'SQL',
    graphql: 'GraphQL',
    vue: 'Vue',
    svelte: 'Svelte',
    dockerfile: 'Dockerfile',
    makefile: 'Makefile',
    toml: 'TOML',
    ini: 'INI',
    conf: 'Config',
    env: 'Environment',
    gitignore: 'Git Ignore',
    txt: 'Plain Text',
  };

  const specialFiles: Record<string, string> = {
    dockerfile: 'Dockerfile',
    makefile: 'Makefile',
    '.gitignore': 'Git Ignore',
    '.env': 'Environment',
    '.env.local': 'Environment',
    '.env.example': 'Environment',
  };

  const lowerFilename = filename.toLowerCase();
  if (specialFiles[lowerFilename]) {
    return specialFiles[lowerFilename];
  }

  return languageMap[ext] || ext.toUpperCase() || 'Plain Text';
};

const formatSize = (bytes: number): string => {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
};

const countLines = (content: string): number => {
  if (!content) return 0;
  return content.split('\n').length;
};

export const StatusBar: React.FC<StatusBarProps> = ({ activeTab, canWrite }) => {
  if (!activeTab) {
    return (
      <div
        className={cn(
          'flex-shrink-0 flex items-center justify-between px-4 py-1.5',
          theme.surface.muted,
          theme.text.subtle,
          'text-xs'
        )}
      >
        <span>No file open</span>
      </div>
    );
  }

  const lineCount = countLines(activeTab.content);
  const language = getLanguage(activeTab.name);

  return (
    <div
      className={cn(
        'flex-shrink-0 flex items-center justify-between px-4 py-1.5',
        theme.surface.muted
      )}
    >
      <div className="flex items-center gap-4">
        <span className={cn('text-xs', theme.text.muted)}>
          {lineCount} {lineCount === 1 ? 'line' : 'lines'}
        </span>
      </div>

      <div className="flex items-center gap-4">
        <span className={cn('text-xs uppercase', theme.text.muted)}>{activeTab.encoding}</span>

        <span className="text-zinc-300 dark:text-zinc-600">|</span>

        <span className={cn('text-xs', theme.text.muted)}>{language}</span>

        <span className="text-zinc-300 dark:text-zinc-600">|</span>

        <span className={cn('text-xs', theme.text.muted)}>{formatSize(activeTab.size)}</span>

        {!canWrite && (
          <>
            <span className="text-zinc-300 dark:text-zinc-600">|</span>
            <span className={cn('text-xs flex items-center gap-1', theme.text.warning)}>
              <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                <path
                  fillRule="evenodd"
                  d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z"
                  clipRule="evenodd"
                />
              </svg>
              Read-only
            </span>
          </>
        )}
      </div>
    </div>
  );
};
