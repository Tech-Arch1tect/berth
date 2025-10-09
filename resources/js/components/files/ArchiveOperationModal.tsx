import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import {
  CreateArchiveRequest,
  ExtractArchiveRequest,
  ArchiveFormat,
  FileEntry,
} from '../../types/files';
import { cn } from '../../utils/cn';
import { theme } from '../../theme';

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
    <div className="fixed inset-0 flex items-center justify-center p-4 z-50">
      <div className={theme.modal.overlay} onClick={onClose}></div>
      <div
        className={cn(theme.modal.content, 'max-w-md w-full max-h-[90vh] overflow-y-auto relative')}
      >
        <div className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className={cn('text-lg font-semibold', theme.text.strong)}>
              {operation === 'create' ? 'Create Archive' : 'Extract Archive'}
            </h3>
            <button onClick={onClose} className={theme.buttons.icon}>
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
                  <label className={cn(theme.forms.label, 'mb-2')}>Archive Format</label>
                  <select
                    value={format}
                    onChange={(e) => setFormat(e.target.value as ArchiveFormat)}
                    className={cn(theme.forms.select, 'w-full')}
                  >
                    <option value="zip">ZIP</option>
                    <option value="tar">TAR</option>
                    <option value="tar.gz">TAR.GZ</option>
                  </select>
                </div>

                <div>
                  <label className={cn(theme.forms.label, 'mb-2')}>Output Path</label>
                  <input
                    type="text"
                    value={outputPath}
                    onChange={(e) => setOutputPath(e.target.value)}
                    placeholder="archive.tar.gz"
                    className={cn(theme.forms.input, 'w-full')}
                    required
                  />
                </div>

                <div>
                  <label className={cn(theme.forms.label, 'mb-2')}>
                    Include Paths (comma-separated, leave empty to include all)
                  </label>
                  <input
                    type="text"
                    value={includePaths}
                    onChange={(e) => setIncludePaths(e.target.value)}
                    placeholder="file1.txt, folder1, *.pdf"
                    className={cn(theme.forms.input, 'w-full')}
                  />
                </div>

                <div>
                  <label className={cn(theme.forms.label, 'mb-2')}>
                    Exclude Patterns (comma-separated)
                  </label>
                  <input
                    type="text"
                    value={excludePatterns}
                    onChange={(e) => setExcludePatterns(e.target.value)}
                    placeholder="*.log, temp*, .git"
                    className={cn(theme.forms.input, 'w-full')}
                  />
                  <p className={cn('mt-1 text-xs', theme.text.subtle)}>
                    Note: The output file is automatically excluded to prevent self-reference
                  </p>
                </div>
              </>
            ) : (
              <>
                <div>
                  <label className={cn(theme.forms.label, 'mb-2')}>Archive File</label>
                  <input
                    type="text"
                    value={selectedFile?.name || ''}
                    disabled
                    className={cn(theme.forms.input, 'w-full opacity-60')}
                  />
                </div>

                <div>
                  <label className={cn(theme.forms.label, 'mb-2')}>
                    Destination Path (leave empty for current directory)
                  </label>
                  <input
                    type="text"
                    value={destinationPath}
                    onChange={(e) => setDestinationPath(e.target.value)}
                    placeholder="extracted/"
                    className={cn(theme.forms.input, 'w-full')}
                  />
                </div>

                <div className="space-y-2">
                  <label className="flex items-center">
                    <input
                      type="checkbox"
                      checked={overwrite}
                      onChange={(e) => setOverwrite(e.target.checked)}
                      className={theme.forms.checkbox}
                    />
                    <span className={cn('ml-2 text-sm', theme.text.standard)}>
                      Overwrite existing files
                    </span>
                  </label>

                  <label className="flex items-center">
                    <input
                      type="checkbox"
                      checked={createDirs}
                      onChange={(e) => setCreateDirs(e.target.checked)}
                      className={theme.forms.checkbox}
                    />
                    <span className={cn('ml-2 text-sm', theme.text.standard)}>
                      Create directories if they don't exist
                    </span>
                  </label>
                </div>
              </>
            )}

            <div className={theme.modal.footer}>
              <button
                type="button"
                onClick={onClose}
                className={cn(theme.buttons.secondary, 'flex-1')}
              >
                Cancel
              </button>
              <button type="submit" className={cn(theme.buttons.primary, 'flex-1')}>
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
