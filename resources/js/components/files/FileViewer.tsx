import React, { useMemo, useState } from 'react';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { oneDark, oneLight } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { FileContent } from '../../types/files';

interface FileViewerProps {
  file: FileContent;
  className?: string;
}

const getFileType = (path: string, encoding: string) => {
  const ext = path.split('.').pop()?.toLowerCase() || '';

  if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'bmp'].includes(ext)) {
    return 'image';
  }

  if (
    [
      'js',
      'jsx',
      'ts',
      'tsx',
      'json',
      'html',
      'css',
      'scss',
      'sass',
      'less',
      'xml',
      'yaml',
      'yml',
      'toml',
      'ini',
      'conf',
      'config',
      'go',
      'py',
      'php',
      'rb',
      'rs',
      'java',
      'c',
      'cpp',
      'cs',
      'sh',
      'sql',
      'dockerfile',
      'env',
      'gitignore',
      'makefile',
    ].includes(ext)
  ) {
    return 'code';
  }

  if (['md', 'markdown', 'txt', 'log', 'csv', 'tsv'].includes(ext)) {
    return 'text';
  }

  if (['pdf'].includes(ext)) {
    return 'pdf';
  }

  if (['zip', 'tar', 'gz', 'rar', '7z', 'bz2', 'xz'].includes(ext)) {
    return 'archive';
  }

  if (['mp4', 'avi', 'mov', 'wmv', 'flv', 'webm', 'mkv'].includes(ext)) {
    return 'video';
  }

  if (['mp3', 'wav', 'flac', 'aac', 'ogg', 'm4a'].includes(ext)) {
    return 'audio';
  }

  if (encoding === 'base64') {
    return 'binary';
  }

  return 'text';
};

const getLanguageFromExtension = (path: string) => {
  const ext = path.split('.').pop()?.toLowerCase() || '';
  const filename = path.split('/').pop()?.toLowerCase() || '';

  const languageMap: Record<string, string> = {
    js: 'javascript',
    jsx: 'jsx',
    ts: 'typescript',
    tsx: 'tsx',
    json: 'json',
    html: 'html',
    css: 'css',
    scss: 'scss',
    sass: 'sass',
    less: 'less',
    xml: 'xml',
    yaml: 'yaml',
    yml: 'yaml',
    toml: 'toml',
    ini: 'ini',
    conf: 'nginx',
    config: 'nginx',
    md: 'markdown',
    py: 'python',
    go: 'go',
    php: 'php',
    rb: 'ruby',
    rs: 'rust',
    java: 'java',
    c: 'c',
    cpp: 'cpp',
    cs: 'csharp',
    sh: 'bash',
    sql: 'sql',
    dockerfile: 'dockerfile',
    env: 'bash',
    gitignore: 'git',
    makefile: 'makefile',
  };

  // Special filename mappings
  const filenameMap: Record<string, string> = {
    dockerfile: 'dockerfile',
    makefile: 'makefile',
    '.gitignore': 'git',
    '.env': 'bash',
    '.env.local': 'bash',
    '.env.production': 'bash',
    '.env.development': 'bash',
  };

  return filenameMap[filename] || languageMap[ext] || 'text';
};

const formatFileSize = (bytes: number) => {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

export const FileViewer: React.FC<FileViewerProps> = ({ file, className = '' }) => {
  const [isDarkTheme] = useState(() => document.documentElement.classList.contains('dark'));
  const [showLineNumbers, setShowLineNumbers] = useState(true);
  const [copied, setCopied] = useState(false);

  const fileType = useMemo(() => {
    return getFileType(file.path, file.encoding);
  }, [file.path, file.encoding]);

  const language = useMemo(() => getLanguageFromExtension(file.path), [file.path]);
  const lineCount = useMemo(() => file.content.split('\n').length, [file.content]);

  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(file.content);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy text: ', err);
    }
  };

  const renderCodeViewer = () => {
    return (
      <div className="relative group">
        {/* Header with file info and actions */}
        <div className="flex items-center justify-between px-4 py-3 bg-slate-100/50 dark:bg-slate-800/50 border-b border-slate-200/50 dark:border-slate-700/50">
          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-2">
              <div className="w-3 h-3 rounded-full bg-red-400"></div>
              <div className="w-3 h-3 rounded-full bg-yellow-400"></div>
              <div className="w-3 h-3 rounded-full bg-green-400"></div>
            </div>
            <div className="text-sm text-slate-600 dark:text-slate-400">
              <span className="font-mono">{file.path.split('/').pop()}</span>
              <span className="mx-2">•</span>
              <span>{language}</span>
              <span className="mx-2">•</span>
              <span>{lineCount} lines</span>
              <span className="mx-2">•</span>
              <span>{formatFileSize(file.size)}</span>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <button
              onClick={() => setShowLineNumbers(!showLineNumbers)}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all duration-200 ${
                showLineNumbers
                  ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300'
                  : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-600'
              }`}
            >
              Line Numbers
            </button>

            <button
              onClick={copyToClipboard}
              className="px-3 py-1.5 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-600 dark:text-slate-400 text-xs font-medium rounded-md transition-all duration-200 flex items-center space-x-1.5"
            >
              {copied ? (
                <>
                  <svg
                    className="w-3 h-3 text-green-500"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M5 13l4 4L19 7"
                    />
                  </svg>
                  <span>Copied!</span>
                </>
              ) : (
                <>
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
                    />
                  </svg>
                  <span>Copy</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Code content */}
        <div className="relative bg-white dark:bg-slate-900">
          <SyntaxHighlighter
            language={language}
            style={isDarkTheme ? oneDark : oneLight}
            showLineNumbers={showLineNumbers}
            customStyle={{
              margin: 0,
              padding: '1.5rem',
              fontSize: '14px',
              lineHeight: '1.5',
              background: 'transparent',
            }}
            lineNumberStyle={{
              minWidth: '3em',
              paddingRight: '1em',
              color: isDarkTheme ? '#64748b' : '#94a3b8',
              userSelect: 'none',
            }}
            codeTagProps={{
              style: {
                fontFamily:
                  'ui-monospace, SFMono-Regular, "SF Mono", Consolas, "Liberation Mono", Menlo, monospace',
              },
            }}
          >
            {file.content}
          </SyntaxHighlighter>
        </div>
      </div>
    );
  };

  const renderTextViewer = () => {
    return (
      <div className="relative group">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 bg-slate-100/50 dark:bg-slate-800/50 border-b border-slate-200/50 dark:border-slate-700/50">
          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-2">
              <div className="w-8 h-8 bg-gradient-to-r from-slate-400 to-slate-500 rounded-lg flex items-center justify-center">
                <svg
                  className="w-4 h-4 text-white"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                  />
                </svg>
              </div>
            </div>
            <div className="text-sm text-slate-600 dark:text-slate-400">
              <span className="font-mono">{file.path.split('/').pop()}</span>
              <span className="mx-2">•</span>
              <span>{lineCount} lines</span>
              <span className="mx-2">•</span>
              <span>{formatFileSize(file.size)}</span>
            </div>
          </div>

          <button
            onClick={copyToClipboard}
            className="px-3 py-1.5 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-600 dark:text-slate-400 text-xs font-medium rounded-md transition-all duration-200 flex items-center space-x-1.5"
          >
            {copied ? (
              <>
                <svg
                  className="w-3 h-3 text-green-500"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M5 13l4 4L19 7"
                  />
                </svg>
                <span>Copied!</span>
              </>
            ) : (
              <>
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
                  />
                </svg>
                <span>Copy</span>
              </>
            )}
          </button>
        </div>

        {/* Text content */}
        <div className="p-6 bg-white dark:bg-slate-900">
          <pre className="whitespace-pre-wrap text-sm font-mono text-slate-800 dark:text-slate-200 leading-relaxed">
            {file.content}
          </pre>
        </div>
      </div>
    );
  };

  const renderContent = () => {
    switch (fileType) {
      case 'image':
        if (file.encoding === 'base64') {
          const ext = file.path.split('.').pop()?.toLowerCase() || '';
          const getMimeType = (extension: string) => {
            const mimeMap: Record<string, string> = {
              jpg: 'image/jpeg',
              jpeg: 'image/jpeg',
              png: 'image/png',
              gif: 'image/gif',
              webp: 'image/webp',
              svg: 'image/svg+xml',
              bmp: 'image/bmp',
            };
            return mimeMap[extension] || 'image/jpeg';
          };

          return (
            <div className="flex flex-col items-center justify-center p-8 bg-slate-50/50 dark:bg-slate-800/50 rounded-xl">
              <img
                src={`data:${getMimeType(ext)};base64,${file.content}`}
                alt={file.path}
                className="max-w-full max-h-96 object-contain rounded-lg shadow-lg border border-slate-200/50 dark:border-slate-700/50"
                onError={(e) => {
                  console.error('Failed to load image:', file.path);
                  e.currentTarget.style.display = 'none';
                }}
              />
              <div className="mt-4 text-center text-sm text-slate-600 dark:text-slate-400">
                <span className="font-mono">{file.path.split('/').pop()}</span>
                <span className="mx-2">•</span>
                <span>{formatFileSize(file.size)}</span>
              </div>
            </div>
          );
        }
        return (
          <div className="flex justify-center p-8">
            <div className="text-center text-slate-500 dark:text-slate-400">
              <div className="inline-flex items-center justify-center w-16 h-16 bg-blue-100 dark:bg-blue-900/20 rounded-2xl mb-4">
                <svg
                  className="w-8 h-8 text-blue-600 dark:text-blue-400"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
                  />
                </svg>
              </div>
              <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-2">
                Image File
              </h3>
              <p className="text-slate-600 dark:text-slate-400 mb-2">Image preview not available</p>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                File encoding: {file.encoding} (expected: base64)
              </p>
            </div>
          </div>
        );

      case 'code':
        return renderCodeViewer();

      case 'text':
        return renderTextViewer();

      case 'binary': {
        const ext = file.path.split('.').pop()?.toLowerCase() || '';
        return (
          <div className="text-center py-12">
            <div className="inline-flex items-center justify-center w-20 h-20 bg-gradient-to-br from-slate-100 to-slate-200 dark:from-slate-800 dark:to-slate-700 rounded-2xl mb-6">
              <svg
                className="w-10 h-10 text-slate-500 dark:text-slate-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                />
              </svg>
            </div>
            <h3 className="text-xl font-semibold text-slate-900 dark:text-white mb-3">
              Binary File
            </h3>
            <p className="text-slate-600 dark:text-slate-400 mb-6 max-w-md">
              This is a binary file that cannot be displayed as text. Download the file to view its
              contents.
            </p>
            <div className="inline-flex flex-col space-y-2 text-sm text-slate-500 dark:text-slate-400 bg-slate-50/50 dark:bg-slate-800/50 px-4 py-3 rounded-lg">
              <div>
                <strong>File type:</strong> .{ext}
              </div>
              <div>
                <strong>Size:</strong> {formatFileSize(file.size)}
              </div>
              <div>
                <strong>Encoding:</strong> {file.encoding}
              </div>
            </div>
          </div>
        );
      }

      case 'pdf':
      case 'archive':
      case 'video':
      case 'audio': {
        const icons = {
          pdf: {
            bg: 'from-red-500 to-pink-500',
            icon: 'M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z',
          },
          archive: {
            bg: 'from-yellow-500 to-orange-500',
            icon: 'M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4',
          },
          video: {
            bg: 'from-purple-500 to-indigo-500',
            icon: 'M14.828 14.828a4 4 0 01-5.656 0M9 10h1.586a1 1 0 01.707.293l2.414 2.414a1 1 0 00.707.293H15M9 10v4a2 2 0 002 2h2a2 2 0 002-2v-4M9 10V8a2 2 0 012-2h2a2 2 0 012 2v2',
          },
          audio: {
            bg: 'from-green-500 to-teal-500',
            icon: 'M14.828 14.828a4 4 0 01-5.656 0M9 10h1.586a1 1 0 01.707.293l2.414 2.414a1 1 0 00.707.293H15M9 10v4a2 2 0 002 2h2a2 2 0 002-2v-4M9 10V8a2 2 0 012-2h2a2 2 0 012 2v2',
          },
        };

        const iconData = icons[fileType as keyof typeof icons];
        const typeNames = {
          pdf: 'PDF Document',
          archive: 'Archive File',
          video: 'Video File',
          audio: 'Audio File',
        };

        return (
          <div className="text-center py-12">
            <div
              className={`inline-flex items-center justify-center w-20 h-20 bg-gradient-to-br ${iconData.bg} rounded-2xl mb-6`}
            >
              <svg
                className="w-10 h-10 text-white"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d={iconData.icon}
                />
              </svg>
            </div>
            <h3 className="text-xl font-semibold text-slate-900 dark:text-white mb-3">
              {typeNames[fileType as keyof typeof typeNames]}
            </h3>
            <p className="text-slate-600 dark:text-slate-400 mb-6 max-w-md">
              This file type cannot be previewed in the browser. Download the file to view its
              contents.
            </p>
            <div className="inline-flex flex-col space-y-2 text-sm text-slate-500 dark:text-slate-400 bg-slate-50/50 dark:bg-slate-800/50 px-4 py-3 rounded-lg">
              <div>
                <strong>File type:</strong> .{file.path.split('.').pop()?.toLowerCase()}
              </div>
              <div>
                <strong>Size:</strong> {formatFileSize(file.size)}
              </div>
            </div>
          </div>
        );
      }

      default:
        return renderTextViewer();
    }
  };

  return (
    <div
      className={`${className} h-full bg-slate-50/30 dark:bg-slate-800/30 rounded-xl border border-slate-200/50 dark:border-slate-700/50 overflow-auto`}
    >
      {renderContent()}
    </div>
  );
};
