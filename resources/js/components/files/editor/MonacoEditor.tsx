import React, { useCallback, useEffect, useState } from 'react';
import Editor, { OnMount } from '@monaco-editor/react';
import * as monaco from 'monaco-editor';
import { cn } from '../../../utils/cn';
import { LoadingSpinner } from '../../common/LoadingSpinner';

interface MonacoEditorProps {
  value: string;
  path: string;
  readOnly?: boolean;
  onChange?: (value: string) => void;
  className?: string;
}

const getLanguageFromPath = (path: string): string => {
  const ext = path.split('.').pop()?.toLowerCase() || '';
  const filename = path.split('/').pop()?.toLowerCase() || '';

  const filenameMap: Record<string, string> = {
    dockerfile: 'dockerfile',
    makefile: 'makefile',
    '.gitignore': 'plaintext',
    '.dockerignore': 'plaintext',
    '.env': 'shell',
    '.env.local': 'shell',
    '.env.production': 'shell',
    '.env.development': 'shell',
  };

  if (filenameMap[filename]) {
    return filenameMap[filename];
  }

  const languageMap: Record<string, string> = {
    js: 'javascript',
    jsx: 'javascript',
    ts: 'typescript',
    tsx: 'typescript',
    json: 'json',
    html: 'html',
    htm: 'html',
    css: 'css',
    scss: 'scss',
    sass: 'scss',
    less: 'less',
    xml: 'xml',
    yaml: 'yaml',
    yml: 'yaml',
    toml: 'plaintext',
    ini: 'ini',
    conf: 'plaintext',
    config: 'plaintext',
    md: 'markdown',
    markdown: 'markdown',
    py: 'python',
    go: 'go',
    php: 'php',
    rb: 'ruby',
    rs: 'rust',
    java: 'java',
    c: 'c',
    h: 'c',
    cpp: 'cpp',
    hpp: 'cpp',
    cs: 'csharp',
    sh: 'shell',
    bash: 'shell',
    zsh: 'shell',
    sql: 'sql',
    dockerfile: 'dockerfile',
    txt: 'plaintext',
    log: 'plaintext',
    csv: 'plaintext',
    tsv: 'plaintext',
    env: 'shell',
    gitignore: 'plaintext',
  };

  return languageMap[ext] || 'plaintext';
};

export const MonacoEditor: React.FC<MonacoEditorProps> = ({
  value,
  path,
  readOnly = false,
  onChange,
  className,
}) => {
  const [isDarkTheme, setIsDarkTheme] = useState(() =>
    document.documentElement.classList.contains('dark')
  );

  useEffect(() => {
    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        if (mutation.attributeName === 'class') {
          setIsDarkTheme(document.documentElement.classList.contains('dark'));
        }
      });
    });

    observer.observe(document.documentElement, { attributes: true });
    return () => observer.disconnect();
  }, []);

  const language = getLanguageFromPath(path);

  const handleChange = useCallback(
    (newValue: string | undefined) => {
      if (onChange && newValue !== undefined) {
        onChange(newValue);
      }
    },
    [onChange]
  );

  const handleMount: OnMount = useCallback(
    (editorInstance: monaco.editor.IStandaloneCodeEditor) => {
      if (!readOnly) {
        editorInstance.focus();
      }
    },
    [readOnly]
  );

  return (
    <div className={cn('h-full w-full', className)}>
      <Editor
        height="100%"
        language={language}
        value={value}
        theme={isDarkTheme ? 'vs-dark' : 'vs'}
        onChange={handleChange}
        onMount={handleMount}
        loading={<LoadingSpinner size="sm" text="Loading editor..." />}
        options={{
          readOnly,
          minimap: { enabled: !readOnly },
          fontSize: 14,
          fontFamily:
            'ui-monospace, SFMono-Regular, "SF Mono", Consolas, "Liberation Mono", Menlo, monospace',
          lineNumbers: 'on',
          scrollBeyondLastLine: false,
          wordWrap: 'on',
          automaticLayout: true,
          tabSize: 2,
          renderWhitespace: 'selection',
          bracketPairColorization: { enabled: true },
          smoothScrolling: true,
          cursorBlinking: 'smooth',
          cursorSmoothCaretAnimation: 'on',
          padding: { top: 16, bottom: 16 },
          scrollbar: {
            vertical: 'auto',
            horizontal: 'auto',
            verticalScrollbarSize: 10,
            horizontalScrollbarSize: 10,
          },

          ...(readOnly && {
            domReadOnly: true,
            contextmenu: false,
          }),
        }}
      />
    </div>
  );
};
