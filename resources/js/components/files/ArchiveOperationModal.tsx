import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import {
  CreateArchiveRequest,
  ExtractArchiveRequest,
  ArchiveFormat,
  FileEntry,
} from '../../types/files';

interface ArchiveOperationModalProps {
  isOpen: boolean;
  onClose: () => void;
  operation: 'create' | 'extract';
  currentPath: string;
  selectedFile?: FileEntry;
  onCreateArchive: (request: CreateArchiveRequest) => void;
  onExtractArchive: (request: ExtractArchiveRequest) => void;
}

export const ArchiveOperationModal: React.FC<ArchiveOperationModalProps> = ({
  isOpen,
  onClose,
  operation,
  currentPath,
  selectedFile,
  onCreateArchive,
  onExtractArchive,
}) => {
  const [format, setFormat] = useState<ArchiveFormat>('tar.gz');
  const [outputPath, setOutputPath] = useState('archive.tar.gz');
  const [includePaths, setIncludePaths] = useState('');
  const [excludePatterns, setExcludePatterns] = useState('');
  const [destinationPath, setDestinationPath] = useState('');
  const [overwrite, setOverwrite] = useState(false);
  const [createDirs, setCreateDirs] = useState(true);

  useEffect(() => {
    if (
      outputPath === 'archive.zip' ||
      outputPath === 'archive.tar' ||
      outputPath === 'archive.tar.gz' ||
      outputPath === ''
    ) {
      setOutputPath(`archive.${format}`);
    }
  }, [format]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (operation === 'create') {
      const includePathsArray = includePaths
        ? includePaths.split(',').map((p) => p.trim())
        : undefined;
      let excludePatternsArray = excludePatterns
        ? excludePatterns.split(',').map((p) => p.trim())
        : [];

      if (outputPath) {
        excludePatternsArray.push(outputPath);
      }

      onCreateArchive({
        format,
        output_path: outputPath,
        include_paths: includePathsArray,
        exclude_patterns: excludePatternsArray.length > 0 ? excludePatternsArray : undefined,
        compression: format === 'tar.gz' ? 'gzip' : undefined,
      });
    } else {
      onExtractArchive({
        archive_path: selectedFile?.name || '',
        destination_path: destinationPath || undefined,
        overwrite,
        create_dirs: createDirs,
      });
    }

    onClose();
  };

  if (!isOpen) return null;

  return createPortal(
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white dark:bg-slate-800 rounded-lg shadow-xl max-w-md w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-slate-900 dark:text-white">
              {operation === 'create' ? 'Create Archive' : 'Extract Archive'}
            </h3>
            <button
              onClick={onClose}
              className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {operation === 'create' ? (
              <>
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                    Archive Format
                  </label>
                  <select
                    value={format}
                    onChange={(e) => setFormat(e.target.value as ArchiveFormat)}
                    className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-md bg-white dark:bg-slate-700 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="zip">ZIP</option>
                    <option value="tar">TAR</option>
                    <option value="tar.gz">TAR.GZ</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                    Output Path
                  </label>
                  <input
                    type="text"
                    value={outputPath}
                    onChange={(e) => setOutputPath(e.target.value)}
                    placeholder="archive.tar.gz"
                    className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-md bg-white dark:bg-slate-700 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                    Include Paths (comma-separated, leave empty to include all)
                  </label>
                  <input
                    type="text"
                    value={includePaths}
                    onChange={(e) => setIncludePaths(e.target.value)}
                    placeholder="file1.txt, folder1, *.pdf"
                    className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-md bg-white dark:bg-slate-700 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                    Exclude Patterns (comma-separated)
                  </label>
                  <input
                    type="text"
                    value={excludePatterns}
                    onChange={(e) => setExcludePatterns(e.target.value)}
                    placeholder="*.log, temp*, .git"
                    className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-md bg-white dark:bg-slate-700 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                    Note: The output file is automatically excluded to prevent self-reference
                  </p>
                </div>
              </>
            ) : (
              <>
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                    Archive File
                  </label>
                  <input
                    type="text"
                    value={selectedFile?.name || ''}
                    disabled
                    className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-md bg-slate-100 dark:bg-slate-600 text-slate-900 dark:text-white"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                    Destination Path (leave empty for current directory)
                  </label>
                  <input
                    type="text"
                    value={destinationPath}
                    onChange={(e) => setDestinationPath(e.target.value)}
                    placeholder="extracted/"
                    className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-md bg-white dark:bg-slate-700 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div className="space-y-2">
                  <label className="flex items-center">
                    <input
                      type="checkbox"
                      checked={overwrite}
                      onChange={(e) => setOverwrite(e.target.checked)}
                      className="rounded border-slate-300 dark:border-slate-600 text-blue-600 focus:ring-blue-500"
                    />
                    <span className="ml-2 text-sm text-slate-700 dark:text-slate-300">
                      Overwrite existing files
                    </span>
                  </label>

                  <label className="flex items-center">
                    <input
                      type="checkbox"
                      checked={createDirs}
                      onChange={(e) => setCreateDirs(e.target.checked)}
                      className="rounded border-slate-300 dark:border-slate-600 text-blue-600 focus:ring-blue-500"
                    />
                    <span className="ml-2 text-sm text-slate-700 dark:text-slate-300">
                      Create directories if they don't exist
                    </span>
                  </label>
                </div>
              </>
            )}

            <div className="flex gap-2 pt-4">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 px-4 py-2 text-slate-700 dark:text-slate-300 bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 rounded-md transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-md transition-colors"
              >
                {operation === 'create' ? 'Create Archive' : 'Extract Archive'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>,
    document.body
  );
};

export default ArchiveOperationModal;
