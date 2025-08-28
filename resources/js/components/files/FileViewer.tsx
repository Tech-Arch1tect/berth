import React, { useMemo } from 'react';
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

  const languageMap: Record<string, string> = {
    js: 'javascript',
    jsx: 'javascript',
    ts: 'typescript',
    tsx: 'typescript',
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
  };

  return languageMap[ext] || 'plaintext';
};

export const FileViewer: React.FC<FileViewerProps> = ({ file, className = '' }) => {
  const fileType = useMemo(() => {
    const type = getFileType(file.path, file.encoding);
    console.log(`FileViewer: ${file.path} -> type: ${type}, encoding: ${file.encoding}`);
    return type;
  }, [file.path, file.encoding]);
  const language = useMemo(() => getLanguageFromExtension(file.path), [file.path]);

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
            <div className="flex justify-center p-4">
              <img
                src={`data:${getMimeType(ext)};base64,${file.content}`}
                alt={file.path}
                className="max-w-full max-h-96 object-contain rounded shadow-lg"
                onError={(e) => {
                  console.error('Failed to load image:', file.path);
                  e.currentTarget.style.display = 'none';
                }}
              />
            </div>
          );
        }
        return (
          <div className="flex justify-center p-4">
            <div className="text-center text-gray-500 dark:text-gray-400">
              <div className="inline-flex items-center justify-center w-16 h-16 bg-blue-100 dark:bg-blue-900/20 rounded-full mb-4">
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
              <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">Image File</h3>
              <p className="text-gray-600 dark:text-gray-400 mb-2">Image preview not available</p>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                File encoding: {file.encoding} (expected: base64)
              </p>
            </div>
          </div>
        );

      case 'code':
        return (
          <pre className="bg-gray-50 dark:bg-gray-900 p-4 rounded-lg overflow-x-auto text-sm">
            <code className={`language-${language}`}>{file.content}</code>
          </pre>
        );

      case 'text':
        return (
          <div className="bg-gray-50 dark:bg-gray-900 p-4 rounded-lg">
            <pre className="whitespace-pre-wrap text-sm font-mono text-gray-800 dark:text-gray-200">
              {file.content}
            </pre>
          </div>
        );

      case 'binary':
        const ext = file.path.split('.').pop()?.toLowerCase() || '';
        return (
          <div className="text-center py-8">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-gray-100 dark:bg-gray-700 rounded-full mb-4">
              <svg
                className="w-8 h-8 text-gray-400 dark:text-gray-500"
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
            <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">Binary File</h3>
            <p className="text-gray-600 dark:text-gray-400 mb-2">
              This is a binary file that cannot be displayed as text.
            </p>
            <div className="text-sm text-gray-500 dark:text-gray-400 space-y-1">
              <p>
                <strong>File type:</strong> .{ext}
              </p>
              <p>
                <strong>Size:</strong> {file.size.toLocaleString()} bytes
              </p>
              <p>
                <strong>Encoding:</strong> {file.encoding}
              </p>
            </div>
          </div>
        );

      case 'pdf':
        return (
          <div className="text-center py-8">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-red-100 dark:bg-red-900/20 rounded-full mb-4">
              <svg
                className="w-8 h-8 text-red-600 dark:text-red-400"
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
            <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">PDF Document</h3>
            <p className="text-gray-600 dark:text-gray-400 mb-4">
              PDF files cannot be previewed in the file manager. Download the file to view it.
            </p>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              <strong>Size:</strong> {file.size.toLocaleString()} bytes
            </p>
          </div>
        );

      case 'archive':
        return (
          <div className="text-center py-8">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-yellow-100 dark:bg-yellow-900/20 rounded-full mb-4">
              <svg
                className="w-8 h-8 text-yellow-600 dark:text-yellow-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"
                />
              </svg>
            </div>
            <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">Archive File</h3>
            <p className="text-gray-600 dark:text-gray-400 mb-4">
              Archive files cannot be previewed. Download and extract to access the contents.
            </p>
            <div className="text-sm text-gray-500 dark:text-gray-400 space-y-1">
              <p>
                <strong>File type:</strong> .{file.path.split('.').pop()?.toLowerCase()}
              </p>
              <p>
                <strong>Size:</strong> {file.size.toLocaleString()} bytes
              </p>
            </div>
          </div>
        );

      case 'video':
      case 'audio':
        return (
          <div className="text-center py-8">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-purple-100 dark:bg-purple-900/20 rounded-full mb-4">
              <svg
                className="w-8 h-8 text-purple-600 dark:text-purple-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M14.828 14.828a4 4 0 01-5.656 0M9 10h1.586a1 1 0 01.707.293l2.414 2.414a1 1 0 00.707.293H15M9 10v4a2 2 0 002 2h2a2 2 0 002-2v-4M9 10V8a2 2 0 012-2h2a2 2 0 012 2v2"
                />
              </svg>
            </div>
            <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
              {fileType === 'video' ? 'Video' : 'Audio'} File
            </h3>
            <p className="text-gray-600 dark:text-gray-400 mb-4">
              {fileType === 'video' ? 'Video' : 'Audio'} files cannot be previewed in the file
              manager. Download the file to play it.
            </p>
            <div className="text-sm text-gray-500 dark:text-gray-400 space-y-1">
              <p>
                <strong>File type:</strong> .{file.path.split('.').pop()?.toLowerCase()}
              </p>
              <p>
                <strong>Size:</strong> {file.size.toLocaleString()} bytes
              </p>
            </div>
          </div>
        );

      default:
        return (
          <div className="bg-gray-50 dark:bg-gray-900 p-4 rounded-lg">
            <pre className="whitespace-pre-wrap text-sm font-mono text-gray-800 dark:text-gray-200">
              {file.content}
            </pre>
          </div>
        );
    }
  };

  return <div className={`${className}`}>{renderContent()}</div>;
};
