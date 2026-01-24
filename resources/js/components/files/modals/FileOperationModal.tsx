import React, { useState, useEffect } from 'react';
import type {
  GetApiV1ServersServeridStacksStacknameFiles200EntriesItem,
  PostApiV1ServersServeridStacksStacknameFilesMkdirBody,
  PostApiV1ServersServeridStacksStacknameFilesWriteBody,
  PostApiV1ServersServeridStacksStacknameFilesRenameBody,
  PostApiV1ServersServeridStacksStacknameFilesCopyBody,
  DeleteApiV1ServersServeridStacksStacknameFilesDeleteBody,
  GetApiV1ServersServeridStacksStacknameFilesStats200,
} from '../../../api/generated/models';
import { FileOperation } from '../../../types/files';
import { cn } from '../../../utils/cn';
import { theme } from '../../../theme';
import { Modal } from '../../common/Modal';

interface FileOperationModalProps {
  isOpen: boolean;
  operation: FileOperation | null;
  selectedFile: GetApiV1ServersServeridStacksStacknameFiles200EntriesItem | null;
  targetDirectory: string;
  onClose: () => void;
  onConfirm: (
    data:
      | PostApiV1ServersServeridStacksStacknameFilesMkdirBody
      | PostApiV1ServersServeridStacksStacknameFilesWriteBody
      | PostApiV1ServersServeridStacksStacknameFilesRenameBody
      | PostApiV1ServersServeridStacksStacknameFilesCopyBody
      | DeleteApiV1ServersServeridStacksStacknameFilesDeleteBody
  ) => Promise<void>;
  getDirectoryStats?: (
    path?: string
  ) => Promise<GetApiV1ServersServeridStacksStacknameFilesStats200>;
}

export const FileOperationModal: React.FC<FileOperationModalProps> = ({
  isOpen,
  operation,
  selectedFile,
  targetDirectory,
  onClose,
  onConfirm,
  getDirectoryStats,
}) => {
  const [inputValue, setInputValue] = useState('');
  const [targetValue, setTargetValue] = useState('');
  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState('');
  const [ownerId, setOwnerId] = useState('');
  const [groupId, setGroupId] = useState('');
  const [showAdvanced, setShowAdvanced] = useState(false);

  useEffect(() => {
    const loadSmartDefaults = async () => {
      if (!isOpen || !operation || (operation !== 'mkdir' && operation !== 'create')) {
        return;
      }

      try {
        if (getDirectoryStats) {
          const stats = await getDirectoryStats(targetDirectory || '.');

          let defaultMode: string;
          if (operation === 'mkdir') {
            // Ensure directories have execute bits (644 -> 755)
            const baseMode = stats.most_common_mode || '755';
            defaultMode = baseMode
              .split('')
              .map((digit) => {
                const d = parseInt(digit, 10);
                if (isNaN(d)) return digit;
                return (d & 4 ? d | 1 : d).toString();
              })
              .join('');
          } else {
            defaultMode =
              stats.most_common_mode === '755' ? '644' : stats.most_common_mode || '644';
          }

          setMode(defaultMode);
          setOwnerId(stats.most_common_owner?.toString() || '');
          setGroupId(stats.most_common_group?.toString() || '');
        } else {
          setMode(operation === 'mkdir' ? '755' : '644');
          setOwnerId('');
          setGroupId('');
        }
      } catch (error) {
        console.warn('Failed to load directory stats, using basic defaults:', error);
        setMode(operation === 'mkdir' ? '755' : '644');
        setOwnerId('');
        setGroupId('');
      }
    };

    if (isOpen && operation) {
      switch (operation) {
        case 'mkdir':
          setInputValue('');
          setTargetValue('');
          setShowAdvanced(false);
          loadSmartDefaults();
          break;
        case 'create':
          setInputValue('');
          setTargetValue('');
          setShowAdvanced(false);
          loadSmartDefaults();
          break;
        case 'rename':
          setInputValue(selectedFile?.name || '');
          setTargetValue('');
          setMode('');
          setOwnerId('');
          setGroupId('');
          setShowAdvanced(false);
          break;
        case 'copy':
          setInputValue(selectedFile?.path || '');
          setTargetValue('');
          setMode('');
          setOwnerId('');
          setGroupId('');
          setShowAdvanced(false);
          break;
        default:
          setInputValue('');
          setTargetValue('');
          setMode('');
          setOwnerId('');
          setGroupId('');
          setShowAdvanced(false);
      }
    }
  }, [isOpen, operation, selectedFile, targetDirectory, getDirectoryStats]);

  const handleConfirm = async () => {
    if (!operation) return;

    try {
      setLoading(true);

      switch (operation) {
        case 'mkdir': {
          const dirPath = targetDirectory ? `${targetDirectory}/${inputValue}` : inputValue;
          const request: PostApiV1ServersServeridStacksStacknameFilesMkdirBody = { path: dirPath };
          if (mode.trim()) request.mode = mode.trim();
          if (ownerId.trim()) request.owner_id = parseInt(ownerId.trim());
          if (groupId.trim()) request.group_id = parseInt(groupId.trim());
          await onConfirm(request);
          break;
        }

        case 'create': {
          const filePath = targetDirectory ? `${targetDirectory}/${inputValue}` : inputValue;
          const request: PostApiV1ServersServeridStacksStacknameFilesWriteBody = {
            path: filePath,
            content: '',
            encoding: 'utf-8',
          };
          if (mode.trim()) request.mode = mode.trim();
          if (ownerId.trim()) request.owner_id = parseInt(ownerId.trim());
          if (groupId.trim()) request.group_id = parseInt(groupId.trim());
          await onConfirm(request);
          break;
        }

        case 'rename': {
          if (!selectedFile) return;
          const newPath = selectedFile.path.replace(selectedFile.name, inputValue);
          await onConfirm({
            old_path: selectedFile.path,
            new_path: newPath,
          } as PostApiV1ServersServeridStacksStacknameFilesRenameBody);
          break;
        }

        case 'copy': {
          if (!selectedFile) return;
          const copyTarget = targetValue || `${selectedFile.name}_copy`;
          const sourceDirectory = selectedFile.path.substring(
            0,
            selectedFile.path.lastIndexOf('/')
          );
          const copyPath = sourceDirectory ? `${sourceDirectory}/${copyTarget}` : copyTarget;
          await onConfirm({
            source_path: selectedFile.path,
            target_path: copyPath,
          } as PostApiV1ServersServeridStacksStacknameFilesCopyBody);
          break;
        }

        case 'delete':
          if (!selectedFile) return;
          await onConfirm({ path: selectedFile.path });
          break;
      }

      onClose();
    } finally {
      setLoading(false);
    }
  };

  const getModalTitle = () => {
    switch (operation) {
      case 'mkdir':
        return 'Create New Directory';
      case 'create':
        return 'Create New File';
      case 'rename':
        return `Rename ${selectedFile?.is_directory ? 'Directory' : 'File'}`;
      case 'copy':
        return `Copy ${selectedFile?.is_directory ? 'Directory' : 'File'}`;
      case 'delete':
        return `Delete ${selectedFile?.is_directory ? 'Directory' : 'File'}`;
      default:
        return 'File Operation';
    }
  };

  const getConfirmButtonText = () => {
    switch (operation) {
      case 'mkdir':
        return 'Create Directory';
      case 'create':
        return 'Create File';
      case 'rename':
        return 'Rename';
      case 'copy':
        return 'Copy';
      case 'delete':
        return 'Delete';
      default:
        return 'Confirm';
    }
  };

  if (!isOpen || !operation) return null;

  const footer = (
    <>
      <button
        onClick={onClose}
        disabled={loading}
        className={cn(theme.buttons.secondary, 'disabled:opacity-50')}
      >
        Cancel
      </button>
      <button
        onClick={handleConfirm}
        disabled={loading || (operation !== 'delete' && !inputValue.trim())}
        className={cn(
          operation === 'delete' ? theme.buttons.danger : theme.buttons.primary,
          'disabled:opacity-50 disabled:cursor-not-allowed'
        )}
      >
        {loading ? (
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
            Processing...
          </>
        ) : (
          getConfirmButtonText()
        )}
      </button>
    </>
  );

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={getModalTitle()} size="sm" footer={footer}>
      <div className="space-y-4">
        {operation === 'delete' ? (
          <div>
            <p className={cn(theme.text.standard, 'mb-4')}>
              Are you sure you want to delete <strong>{selectedFile?.name}</strong>?
              {selectedFile?.is_directory && (
                <span className={cn('block text-sm mt-2', theme.text.danger)}>
                  This will permanently delete the directory and all its contents.
                </span>
              )}
            </p>
          </div>
        ) : (
          <>
            <div>
              <label className={cn(theme.forms.label, 'mb-2')}>
                {operation === 'mkdir'
                  ? 'Directory Name'
                  : operation === 'create'
                    ? 'File Name'
                    : operation === 'rename'
                      ? 'New Name'
                      : 'Source'}
              </label>
              <input
                type="text"
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                className={cn(theme.forms.input, 'w-full')}
                placeholder={
                  operation === 'mkdir'
                    ? 'my-directory'
                    : operation === 'create'
                      ? 'my-file.txt'
                      : 'New name'
                }
                disabled={operation === 'copy'}
              />
            </div>

            {operation === 'copy' && (
              <div>
                <label className={cn(theme.forms.label, 'mb-2')}>Target Name</label>
                <input
                  type="text"
                  value={targetValue}
                  onChange={(e) => setTargetValue(e.target.value)}
                  className={cn(theme.forms.input, 'w-full')}
                  placeholder={selectedFile ? `${selectedFile.name}_copy` : 'copy-name'}
                />
              </div>
            )}

            {targetDirectory && (
              <div className={cn('text-sm', theme.text.muted)}>
                <strong>Location:</strong> /{targetDirectory}
              </div>
            )}

            {(operation === 'mkdir' || operation === 'create') && (
              <div className="space-y-4 pt-4 border-t border-zinc-200 dark:border-zinc-800">
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
                    className={cn(
                      'w-4 h-4 transform transition-transform',
                      showAdvanced && 'rotate-180'
                    )}
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
                        placeholder={operation === 'mkdir' ? '755' : '644'}
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
                    <p className={cn('text-xs', theme.text.subtle)}>
                      Leave empty to use server defaults
                    </p>
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </Modal>
  );
};
