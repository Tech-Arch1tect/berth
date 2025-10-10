import React, { useState, useEffect } from 'react';
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

export const ChmodModal: React.FC<ChmodModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  entry,
  loading,
}) => {
  const [octalMode, setOctalMode] = useState('');
  const [userRead, setUserRead] = useState(false);
  const [userWrite, setUserWrite] = useState(false);
  const [userExecute, setUserExecute] = useState(false);
  const [groupRead, setGroupRead] = useState(false);
  const [groupWrite, setGroupWrite] = useState(false);
  const [groupExecute, setGroupExecute] = useState(false);
  const [otherRead, setOtherRead] = useState(false);
  const [otherWrite, setOtherWrite] = useState(false);
  const [otherExecute, setOtherExecute] = useState(false);
  const [recursive, setRecursive] = useState(false);

  useEffect(() => {
    if (entry?.mode) {
      parsePermissions(entry.mode);
    }
  }, [entry]);

  useEffect(() => {
    const userValue = (userRead ? 4 : 0) + (userWrite ? 2 : 0) + (userExecute ? 1 : 0);
    const groupValue = (groupRead ? 4 : 0) + (groupWrite ? 2 : 0) + (groupExecute ? 1 : 0);
    const otherValue = (otherRead ? 4 : 0) + (otherWrite ? 2 : 0) + (otherExecute ? 1 : 0);

    const octal = `${userValue}${groupValue}${otherValue}`;
    setOctalMode(octal);
  }, [
    userRead,
    userWrite,
    userExecute,
    groupRead,
    groupWrite,
    groupExecute,
    otherRead,
    otherWrite,
    otherExecute,
  ]);

  const parsePermissions = (mode: string) => {
    if (mode.length >= 9) {
      const permissions = mode.slice(-9);

      setUserRead(permissions[0] === 'r');
      setUserWrite(permissions[1] === 'w');
      setUserExecute(permissions[2] === 'x' || permissions[2] === 's');

      setGroupRead(permissions[3] === 'r');
      setGroupWrite(permissions[4] === 'w');
      setGroupExecute(permissions[5] === 'x' || permissions[5] === 's');

      setOtherRead(permissions[6] === 'r');
      setOtherWrite(permissions[7] === 'w');
      setOtherExecute(permissions[8] === 'x' || permissions[8] === 't');
    } else if (mode.match(/^\d{3,4}$/)) {
      const octal = mode.length === 3 ? mode : mode.slice(1);
      setOctalMode(octal);
      parseFromOctal(octal);
    }
  };

  const parseFromOctal = (octal: string) => {
    if (octal.length !== 3) return;

    const userValue = parseInt(octal[0]);
    const groupValue = parseInt(octal[1]);
    const otherValue = parseInt(octal[2]);

    setUserRead((userValue & 4) !== 0);
    setUserWrite((userValue & 2) !== 0);
    setUserExecute((userValue & 1) !== 0);

    setGroupRead((groupValue & 4) !== 0);
    setGroupWrite((groupValue & 2) !== 0);
    setGroupExecute((groupValue & 1) !== 0);

    setOtherRead((otherValue & 4) !== 0);
    setOtherWrite((otherValue & 2) !== 0);
    setOtherExecute((otherValue & 1) !== 0);
  };

  const handleOctalChange = (value: string) => {
    // Only allow 3-digit numbers
    if (value.match(/^\d{0,3}$/)) {
      setOctalMode(value);
      if (value.length === 3) {
        parseFromOctal(value);
      }
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (entry && octalMode.length === 3) {
      onConfirm({
        path: entry.path,
        mode: octalMode,
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
        className={cn(theme.buttons.ghost, 'disabled:opacity-50')}
      >
        Cancel
      </button>
      <button
        type="submit"
        form="chmod-form"
        disabled={loading || octalMode.length !== 3}
        className={cn(
          'bg-orange-600 hover:bg-orange-700 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2 px-4 py-2'
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
        {/* Octal Input */}
        <div className="mb-6">
          <label className={cn(theme.forms.label, 'mb-2')}>Octal Notation</label>
          <input
            type="text"
            value={octalMode}
            onChange={(e) => handleOctalChange(e.target.value)}
            className={cn(theme.forms.input, 'w-full')}
            placeholder="755"
            maxLength={3}
          />
          <p className={cn('text-xs mt-1', theme.text.subtle)}>
            Enter 3-digit octal permissions (e.g., 755, 644)
          </p>
        </div>

        {/* Visual Permission Editor */}
        <div className="space-y-4">
          <div className={cn('text-sm font-medium mb-3', theme.text.standard)}>Permissions</div>

          {/* User/Owner */}
          <div
            className={cn(theme.surface.muted, 'flex items-center justify-between p-3 rounded-lg')}
          >
            <div className={cn('text-sm font-medium', theme.text.standard)}>Owner</div>
            <div className="flex space-x-4">
              <label className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  checked={userRead}
                  onChange={(e) => setUserRead(e.target.checked)}
                  className={theme.forms.checkbox}
                />
                <span className={cn('text-xs', theme.text.muted)}>Read</span>
              </label>
              <label className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  checked={userWrite}
                  onChange={(e) => setUserWrite(e.target.checked)}
                  className={theme.forms.checkbox}
                />
                <span className={cn('text-xs', theme.text.muted)}>Write</span>
              </label>
              <label className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  checked={userExecute}
                  onChange={(e) => setUserExecute(e.target.checked)}
                  className={theme.forms.checkbox}
                />
                <span className={cn('text-xs', theme.text.muted)}>Execute</span>
              </label>
            </div>
          </div>

          {/* Group */}
          <div
            className={cn(theme.surface.muted, 'flex items-center justify-between p-3 rounded-lg')}
          >
            <div className={cn('text-sm font-medium', theme.text.standard)}>Group</div>
            <div className="flex space-x-4">
              <label className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  checked={groupRead}
                  onChange={(e) => setGroupRead(e.target.checked)}
                  className={theme.forms.checkbox}
                />
                <span className={cn('text-xs', theme.text.muted)}>Read</span>
              </label>
              <label className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  checked={groupWrite}
                  onChange={(e) => setGroupWrite(e.target.checked)}
                  className={theme.forms.checkbox}
                />
                <span className={cn('text-xs', theme.text.muted)}>Write</span>
              </label>
              <label className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  checked={groupExecute}
                  onChange={(e) => setGroupExecute(e.target.checked)}
                  className={theme.forms.checkbox}
                />
                <span className={cn('text-xs', theme.text.muted)}>Execute</span>
              </label>
            </div>
          </div>

          {/* Others */}
          <div
            className={cn(theme.surface.muted, 'flex items-center justify-between p-3 rounded-lg')}
          >
            <div className={cn('text-sm font-medium', theme.text.standard)}>Others</div>
            <div className="flex space-x-4">
              <label className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  checked={otherRead}
                  onChange={(e) => setOtherRead(e.target.checked)}
                  className={theme.forms.checkbox}
                />
                <span className={cn('text-xs', theme.text.muted)}>Read</span>
              </label>
              <label className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  checked={otherWrite}
                  onChange={(e) => setOtherWrite(e.target.checked)}
                  className={theme.forms.checkbox}
                />
                <span className={cn('text-xs', theme.text.muted)}>Write</span>
              </label>
              <label className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  checked={otherExecute}
                  onChange={(e) => setOtherExecute(e.target.checked)}
                  className={theme.forms.checkbox}
                />
                <span className={cn('text-xs', theme.text.muted)}>Execute</span>
              </label>
            </div>
          </div>
        </div>

        {/* Recursive Option for Directories */}
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
