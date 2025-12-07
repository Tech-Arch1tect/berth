import React, { useState, useMemo, useCallback } from 'react';
import { FileEntry, ChmodRequest } from '../../../types/files';
import { cn } from '../../../utils/cn';
import { theme } from '../../../theme';
import { Modal } from '../../common/Modal';

interface ChmodModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (request: ChmodRequest) => void;
  entry: FileEntry | null;
  loading: boolean;
}

interface PermissionState {
  userRead: boolean;
  userWrite: boolean;
  userExecute: boolean;
  groupRead: boolean;
  groupWrite: boolean;
  groupExecute: boolean;
  otherRead: boolean;
  otherWrite: boolean;
  otherExecute: boolean;
}

const parsePermissionsFromMode = (mode: string): PermissionState => {
  const defaultState: PermissionState = {
    userRead: false,
    userWrite: false,
    userExecute: false,
    groupRead: false,
    groupWrite: false,
    groupExecute: false,
    otherRead: false,
    otherWrite: false,
    otherExecute: false,
  };

  if (mode.length >= 9) {
    const permissions = mode.slice(-9);
    return {
      userRead: permissions[0] === 'r',
      userWrite: permissions[1] === 'w',
      userExecute: permissions[2] === 'x' || permissions[2] === 's',
      groupRead: permissions[3] === 'r',
      groupWrite: permissions[4] === 'w',
      groupExecute: permissions[5] === 'x' || permissions[5] === 's',
      otherRead: permissions[6] === 'r',
      otherWrite: permissions[7] === 'w',
      otherExecute: permissions[8] === 'x' || permissions[8] === 't',
    };
  } else if (mode.match(/^\d{3,4}$/)) {
    const octal = mode.length === 3 ? mode : mode.slice(1);
    return parsePermissionsFromOctal(octal);
  }

  return defaultState;
};

const parsePermissionsFromOctal = (octal: string): PermissionState => {
  if (octal.length !== 3) {
    return {
      userRead: false,
      userWrite: false,
      userExecute: false,
      groupRead: false,
      groupWrite: false,
      groupExecute: false,
      otherRead: false,
      otherWrite: false,
      otherExecute: false,
    };
  }

  const userValue = parseInt(octal[0]);
  const groupValue = parseInt(octal[1]);
  const otherValue = parseInt(octal[2]);

  return {
    userRead: (userValue & 4) !== 0,
    userWrite: (userValue & 2) !== 0,
    userExecute: (userValue & 1) !== 0,
    groupRead: (groupValue & 4) !== 0,
    groupWrite: (groupValue & 2) !== 0,
    groupExecute: (groupValue & 1) !== 0,
    otherRead: (otherValue & 4) !== 0,
    otherWrite: (otherValue & 2) !== 0,
    otherExecute: (otherValue & 1) !== 0,
  };
};

const permissionsToOctal = (perms: PermissionState): string => {
  const userValue =
    (perms.userRead ? 4 : 0) + (perms.userWrite ? 2 : 0) + (perms.userExecute ? 1 : 0);
  const groupValue =
    (perms.groupRead ? 4 : 0) + (perms.groupWrite ? 2 : 0) + (perms.groupExecute ? 1 : 0);
  const otherValue =
    (perms.otherRead ? 4 : 0) + (perms.otherWrite ? 2 : 0) + (perms.otherExecute ? 1 : 0);
  return `${userValue}${groupValue}${otherValue}`;
};

export const ChmodModal: React.FC<ChmodModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  entry,
  loading,
}) => {
  const [permissions, setPermissions] = useState<PermissionState>(() =>
    entry?.mode ? parsePermissionsFromMode(entry.mode) : parsePermissionsFromOctal('000')
  );
  const [octalInput, setOctalInput] = useState('');
  const [isEditingOctal, setIsEditingOctal] = useState(false);
  const [recursive, setRecursive] = useState(false);
  const [prevEntryMode, setPrevEntryMode] = useState(entry?.mode);

  if (entry?.mode !== prevEntryMode) {
    setPrevEntryMode(entry?.mode);
    if (entry?.mode) {
      setPermissions(parsePermissionsFromMode(entry.mode));
    }
    setRecursive(false);
    setIsEditingOctal(false);
  }

  const calculatedOctal = useMemo(() => permissionsToOctal(permissions), [permissions]);

  const displayedOctal = isEditingOctal ? octalInput : calculatedOctal;

  const handlePermissionChange = useCallback((key: keyof PermissionState, value: boolean) => {
    setPermissions((prev) => ({ ...prev, [key]: value }));
    setIsEditingOctal(false);
  }, []);

  const handleOctalChange = useCallback((value: string) => {
    if (value.match(/^\d{0,3}$/)) {
      setOctalInput(value);
      setIsEditingOctal(true);
      if (value.length === 3) {
        setPermissions(parsePermissionsFromOctal(value));
        setIsEditingOctal(false);
      }
    }
  }, []);

  const handleOctalBlur = useCallback(() => {
    setIsEditingOctal(false);
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (entry && calculatedOctal.length === 3) {
      onConfirm({
        path: entry.path,
        mode: calculatedOctal,
        recursive: recursive && entry.is_directory,
      });
    }
  };

  if (!isOpen || !entry) return null;

  const footer = (
    <>
      <button
        type="button"
        onClick={onClose}
        disabled={loading}
        className={cn(theme.buttons.secondary, 'disabled:opacity-50')}
      >
        Cancel
      </button>
      <button
        type="submit"
        form="chmod-form"
        disabled={loading || calculatedOctal.length !== 3}
        className={cn(
          theme.buttons.primary,
          'disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2'
        )}
      >
        {loading && (
          <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin"></div>
        )}
        <span>Change Permissions</span>
      </button>
    </>
  );

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Change Permissions"
      subtitle={entry.name}
      size="sm"
      footer={footer}
    >
      <form id="chmod-form" onSubmit={handleSubmit} className="space-y-4">
        <div className="mb-6">
          <label className={cn(theme.forms.label, 'mb-2')}>Octal Notation</label>
          <input
            type="text"
            value={displayedOctal}
            onChange={(e) => handleOctalChange(e.target.value)}
            onBlur={handleOctalBlur}
            className={cn(theme.forms.input, 'w-full')}
            placeholder="755"
            maxLength={3}
          />
          <p className={cn('text-xs mt-1', theme.text.subtle)}>
            Enter 3-digit octal permissions (e.g., 755, 644)
          </p>
        </div>

        <div className="space-y-4">
          <div className={cn('text-sm font-medium mb-3', theme.text.standard)}>Permissions</div>

          <div
            className={cn(theme.surface.muted, 'flex items-center justify-between p-3 rounded-lg')}
          >
            <div className={cn('text-sm font-medium', theme.text.standard)}>Owner</div>
            <div className="flex space-x-4">
              <label className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  checked={permissions.userRead}
                  onChange={(e) => handlePermissionChange('userRead', e.target.checked)}
                  className={theme.forms.checkbox}
                />
                <span className={cn('text-xs', theme.text.muted)}>Read</span>
              </label>
              <label className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  checked={permissions.userWrite}
                  onChange={(e) => handlePermissionChange('userWrite', e.target.checked)}
                  className={theme.forms.checkbox}
                />
                <span className={cn('text-xs', theme.text.muted)}>Write</span>
              </label>
              <label className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  checked={permissions.userExecute}
                  onChange={(e) => handlePermissionChange('userExecute', e.target.checked)}
                  className={theme.forms.checkbox}
                />
                <span className={cn('text-xs', theme.text.muted)}>Execute</span>
              </label>
            </div>
          </div>

          <div
            className={cn(theme.surface.muted, 'flex items-center justify-between p-3 rounded-lg')}
          >
            <div className={cn('text-sm font-medium', theme.text.standard)}>Group</div>
            <div className="flex space-x-4">
              <label className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  checked={permissions.groupRead}
                  onChange={(e) => handlePermissionChange('groupRead', e.target.checked)}
                  className={theme.forms.checkbox}
                />
                <span className={cn('text-xs', theme.text.muted)}>Read</span>
              </label>
              <label className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  checked={permissions.groupWrite}
                  onChange={(e) => handlePermissionChange('groupWrite', e.target.checked)}
                  className={theme.forms.checkbox}
                />
                <span className={cn('text-xs', theme.text.muted)}>Write</span>
              </label>
              <label className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  checked={permissions.groupExecute}
                  onChange={(e) => handlePermissionChange('groupExecute', e.target.checked)}
                  className={theme.forms.checkbox}
                />
                <span className={cn('text-xs', theme.text.muted)}>Execute</span>
              </label>
            </div>
          </div>

          <div
            className={cn(theme.surface.muted, 'flex items-center justify-between p-3 rounded-lg')}
          >
            <div className={cn('text-sm font-medium', theme.text.standard)}>Others</div>
            <div className="flex space-x-4">
              <label className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  checked={permissions.otherRead}
                  onChange={(e) => handlePermissionChange('otherRead', e.target.checked)}
                  className={theme.forms.checkbox}
                />
                <span className={cn('text-xs', theme.text.muted)}>Read</span>
              </label>
              <label className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  checked={permissions.otherWrite}
                  onChange={(e) => handlePermissionChange('otherWrite', e.target.checked)}
                  className={theme.forms.checkbox}
                />
                <span className={cn('text-xs', theme.text.muted)}>Write</span>
              </label>
              <label className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  checked={permissions.otherExecute}
                  onChange={(e) => handlePermissionChange('otherExecute', e.target.checked)}
                  className={theme.forms.checkbox}
                />
                <span className={cn('text-xs', theme.text.muted)}>Execute</span>
              </label>
            </div>
          </div>
        </div>

        {entry.is_directory && (
          <div
            className={cn(
              theme.intent.info.surface,
              theme.intent.info.border,
              'mt-6 p-4 rounded-lg border'
            )}
          >
            <label className="flex items-center space-x-3">
              <input
                type="checkbox"
                checked={recursive}
                onChange={(e) => setRecursive(e.target.checked)}
                className={theme.forms.checkbox}
              />
              <div>
                <span className={cn('text-sm font-medium', theme.intent.info.textStrong)}>
                  Apply recursively
                </span>
                <p className={cn('text-xs mt-1', theme.intent.info.textMuted)}>
                  Change permissions for all files and subdirectories within this directory
                </p>
              </div>
            </label>
          </div>
        )}
      </form>
    </Modal>
  );
};
