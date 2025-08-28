import React from 'react';

interface FileIconProps {
  fileName: string;
  isDirectory: boolean;
  className?: string;
}

export const FileIcon: React.FC<FileIconProps> = ({
  fileName,
  isDirectory,
  className = 'w-5 h-5',
}) => {
  if (isDirectory) {
    return (
      <svg className={`${className} text-blue-500`} fill="currentColor" viewBox="0 0 20 20">
        <path d="M2 6a2 2 0 012-2h5l2 2h5a2 2 0 012 2v6a2 2 0 01-2 2H4a2 2 0 01-2-2V6z" />
      </svg>
    );
  }

  const extension = fileName.split('.').pop()?.toLowerCase();

  const getFileIcon = () => {
    switch (extension) {
      case 'js':
      case 'ts':
      case 'jsx':
      case 'tsx':
        return (
          <svg className={`${className} text-yellow-500`} fill="currentColor" viewBox="0 0 20 20">
            <path
              fillRule="evenodd"
              d="M3 4a1 1 0 011-1h12a1 1 0 011 1v12a1 1 0 01-1 1H4a1 1 0 01-1-1V4zm1 0v12h12V4H4z"
              clipRule="evenodd"
            />
            <path d="M6 8h8v1H6V8zM6 10h8v1H6v-1zM6 12h5v1H6v-1z" />
          </svg>
        );

      case 'json':
      case 'yml':
      case 'yaml':
      case 'xml':
        return (
          <svg className={`${className} text-orange-500`} fill="currentColor" viewBox="0 0 20 20">
            <path
              fillRule="evenodd"
              d="M3 4a1 1 0 011-1h12a1 1 0 011 1v12a1 1 0 01-1 1H4a1 1 0 01-1-1V4zm1 0v12h12V4H4z"
              clipRule="evenodd"
            />
            <path d="M7 8l1.5 1.5L7 11h1l1.5-1.5L11 11h1L10.5 9.5 12 8h-1L9.5 9.5 8 8H7z" />
          </svg>
        );

      case 'md':
      case 'txt':
      case 'log':
        return (
          <svg className={`${className} text-gray-500`} fill="currentColor" viewBox="0 0 20 20">
            <path
              fillRule="evenodd"
              d="M4 4a2 2 0 00-2 2v8a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2H4zm0 2v8h12V6H4z"
              clipRule="evenodd"
            />
            <path d="M6 8h8v1H6V8zM6 10h8v1H6v-1zM6 12h5v1H6v-1z" />
          </svg>
        );

      case 'png':
      case 'jpg':
      case 'jpeg':
      case 'gif':
      case 'svg':
      case 'webp':
        return (
          <svg className={`${className} text-green-500`} fill="currentColor" viewBox="0 0 20 20">
            <path
              fillRule="evenodd"
              d="M4 3a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V5a2 2 0 00-2-2H4zm12 12H4l4-8 3 6 2-4 3 6z"
              clipRule="evenodd"
            />
          </svg>
        );

      case 'zip':
      case 'tar':
      case 'gz':
      case '7z':
        return (
          <svg className={`${className} text-purple-500`} fill="currentColor" viewBox="0 0 20 20">
            <path d="M3 4a1 1 0 011-1h12a1 1 0 011 1v12a1 1 0 01-1 1H4a1 1 0 01-1-1V4z" />
            <path
              fillRule="evenodd"
              d="M8 6h1v1H8V6zM9 7h1v1H9V7zM8 8h1v1H8V8zM9 9h1v1H9V9z"
              clipRule="evenodd"
            />
          </svg>
        );

      case 'pdf':
        return (
          <svg className={`${className} text-red-500`} fill="currentColor" viewBox="0 0 20 20">
            <path
              fillRule="evenodd"
              d="M4 4a2 2 0 00-2 2v8a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2H4zm0 2v8h12V6H4z"
              clipRule="evenodd"
            />
            <path d="M7 8h2v1H7V8zM7 10h6v1H7v-1zM7 12h4v1H7v-1z" />
          </svg>
        );

      default:
        return (
          <svg
            className={`${className} text-gray-400`}
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
        );
    }
  };

  return getFileIcon();
};
