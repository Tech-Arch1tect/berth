import React, { useState, useRef, useCallback, useEffect } from 'react';
import { DirectoryStats } from '../../types/files';
import { cn } from '../../utils/cn';
import { theme } from '../../theme';
import { Modal } from '../common/Modal';

interface FileUploadModalProps {
  isOpen: boolean;
  currentPath: string;
  onClose: () => void;
  onUpload: (
    file: File,
    path: string,
    options?: { mode?: string; owner_id?: number; group_id?: number }
  ) => Promise<void>;
  getDirectoryStats?: (path?: string) => Promise<DirectoryStats>;
}

export const FileUploadModal: React.FC<FileUploadModalProps> = ({
  isOpen,
  currentPath,
  onClose,
  onUpload,
  getDirectoryStats,
}) => {
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [mode, setMode] = useState('644');
  const [ownerId, setOwnerId] = useState('');
  const [groupId, setGroupId] = useState('');
  const [showAdvanced, setShowAdvanced] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const loadSmartDefaults = async () => {
      if (!isOpen) return;

      try {
        if (getDirectoryStats) {
          const stats = await getDirectoryStats(currentPath || '.');

          const defaultMode =
            stats.most_common_mode === '755' ? '644' : stats.most_common_mode || '644';

          setMode(defaultMode);
          setOwnerId(stats.most_common_owner?.toString() || '');
          setGroupId(stats.most_common_group?.toString() || '');
        } else {
          setMode('644');
          setOwnerId('');
          setGroupId('');
        }
      } catch (error) {
        console.warn('Failed to load directory stats, using basic defaults:', error);
        setMode('644');
        setOwnerId('');
        setGroupId('');
      }
    };

    if (isOpen) {
      setShowAdvanced(false);
      loadSmartDefaults();
    }
  }, [isOpen, currentPath, getDirectoryStats]);

  const handleFileSelect = useCallback((files: FileList | null) => {
    if (files) {
      const fileArray = Array.from(files);
      setSelectedFiles(fileArray);
    }
  }, []);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    handleFileSelect(e.target.files);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    handleFileSelect(e.dataTransfer.files);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(true);
  };

  const handleDragLeave = () => {
    setDragOver(false);
  };

  const handleUpload = async () => {
    if (selectedFiles.length === 0) return;

    try {
      setUploading(true);

      const options: { mode?: string; owner_id?: number; group_id?: number } = {};
      if (mode.trim()) options.mode = mode.trim();
      if (ownerId.trim()) options.owner_id = parseInt(ownerId.trim());
      if (groupId.trim()) options.group_id = parseInt(groupId.trim());

      for (const file of selectedFiles) {
        const filePath = currentPath ? `${currentPath}/${file.name}` : file.name;
        await onUpload(file, filePath, options);
      }
      setSelectedFiles([]);
      onClose();
    } catch (error) {
      console.error('Upload failed:', error);
    } finally {
      setUploading(false);
    }
  };

  const removeFile = (index: number) => {
    setSelectedFiles((files) => files.filter((_, i) => i !== index));
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  if (!isOpen) return null;

  const footer = (
    <>
      <button
        onClick={onClose}
        disabled={uploading}
        className={cn(theme.buttons.secondary, 'disabled:opacity-50')}
      >
        Cancel
      </button>
      <button
        onClick={handleUpload}
        disabled={uploading || selectedFiles.length === 0}
        className={cn(theme.buttons.primary, 'disabled:opacity-50 disabled:cursor-not-allowed')}
      >
        {uploading ? (
          <>
            <svg className="animate-spin -ml-1 mr-2 h-4 w-4" fill="none" viewBox="0 0 24 24">
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
              />
            </svg>
            Uploading...
          </>
        ) : (
          `Upload ${selectedFiles.length} file${selectedFiles.length === 1 ? '' : 's'}`
        )}
      </button>
    </>
  );

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Upload Files"
      subtitle={`Add files to ${currentPath || 'root directory'}`}
      size="lg"
      footer={footer}
    >
      <div className="space-y-4">
        {/* Upload Area */}
        <div
          className={cn(
            'border-2 border-dashed rounded-lg p-8 text-center transition-colors',
            dragOver
              ? 'border-blue-400 bg-blue-50 dark:bg-blue-900/20'
              : 'border-gray-300 dark:border-gray-600'
          )}
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
        >
          <div className="space-y-4">
            <div className="mx-auto flex justify-center">
              <svg
                className="w-12 h-12 text-gray-400"
                stroke="currentColor"
                fill="none"
                viewBox="0 0 48 48"
              >
                <path
                  d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H12a4 4 0 01-4-4v-4m32-4l-3.172-3.172a4 4 0 00-5.656 0L28 28M8 32l9.172-9.172a4 4 0 015.656 0L28 28m0 0l4 4m4-24h8m-4-4v8m-12 4h.02"
                  strokeWidth={2}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </div>
            <div>
              <p className={cn('text-lg', theme.text.muted)}>
                Drop files here, or{' '}
                <button
                  type="button"
                  className={cn('font-medium', theme.text.info, 'hover:opacity-80')}
                  onClick={() => fileInputRef.current?.click()}
                >
                  browse
                </button>
              </p>
              <p className={cn('text-sm mt-2', theme.text.subtle)}>Maximum file size: 100MB</p>
            </div>
          </div>
          <input
            ref={fileInputRef}
            type="file"
            multiple
            className="hidden"
            onChange={handleInputChange}
          />
        </div>

        {/* File List */}
        {selectedFiles.length > 0 && (
          <div className="space-y-2">
            <h4 className={cn('font-medium', theme.text.strong)}>Selected Files:</h4>
            <div className="max-h-48 overflow-y-auto space-y-2">
              {selectedFiles.map((file, index) => (
                <div
                  key={`${file.name}-${index}`}
                  className={cn(
                    theme.surface.muted,
                    'flex items-center justify-between p-3 rounded-md'
                  )}
                >
                  <div className="flex items-center space-x-3">
                    <svg
                      className={cn('w-5 h-5', theme.text.subtle)}
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
                    <div>
                      <p className={cn('text-sm font-medium', theme.text.strong)}>{file.name}</p>
                      <p className={cn('text-xs', theme.text.subtle)}>
                        {formatFileSize(file.size)}
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => removeFile(index)}
                    className={cn(theme.text.danger, 'hover:opacity-80 p-1')}
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M6 18L18 6M6 6l12 12"
                      />
                    </svg>
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Location */}
        {currentPath && (
          <div className={cn('text-sm', theme.text.muted)}>
            <strong>Upload to:</strong> /{currentPath}
          </div>
        )}

        {/* Advanced Options */}
        <div className="space-y-4 pt-4 border-t border-slate-200 dark:border-slate-700">
          <button
            type="button"
            onClick={() => setShowAdvanced(!showAdvanced)}
            className={cn(
              'flex items-center space-x-2 text-sm',
              theme.text.info,
              'hover:opacity-80'
            )}
          >
            <svg
              className={cn('w-4 h-4 transform transition-transform', showAdvanced && 'rotate-180')}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M19 9l-7 7-7-7"
              />
            </svg>
            <span>Permissions & Ownership</span>
          </button>

          {showAdvanced && (
            <div className={cn(theme.surface.muted, 'space-y-3 p-4 rounded-md')}>
              <div>
                <label className={cn(theme.forms.label, 'mb-1')}>Permissions (octal)</label>
                <input
                  type="text"
                  value={mode}
                  onChange={(e) => setMode(e.target.value)}
                  className={cn(theme.forms.input, 'w-full')}
                  placeholder="644"
                />
                <p className={cn('text-xs mt-1', theme.text.subtle)}>
                  Leave empty to use default permissions
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={cn(theme.forms.label, 'mb-1')}>Owner ID</label>
                  <input
                    type="number"
                    value={ownerId}
                    onChange={(e) => setOwnerId(e.target.value)}
                    className={cn(theme.forms.input, 'w-full')}
                    placeholder="1000"
                  />
                </div>
                <div>
                  <label className={cn(theme.forms.label, 'mb-1')}>Group ID</label>
                  <input
                    type="number"
                    value={groupId}
                    onChange={(e) => setGroupId(e.target.value)}
                    className={cn(theme.forms.input, 'w-full')}
                    placeholder="1000"
                  />
                </div>
              </div>
              <p className={cn('text-xs', theme.text.subtle)}>Leave empty to use server defaults</p>
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
};
