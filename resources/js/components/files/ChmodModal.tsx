import React, { useState, useEffect } from 'react';
import { FileEntry, ChmodRequest } from '../../types/files';
import { XMarkIcon } from '@heroicons/react/24/outline';

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

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex min-h-screen items-center justify-center p-4">
        <div className="fixed inset-0 bg-black/25 backdrop-blur-sm" onClick={onClose}></div>

        <div className="relative w-full max-w-md bg-white dark:bg-slate-800 rounded-2xl shadow-2xl">
          <div className="flex items-center justify-between p-6 border-b border-slate-200 dark:border-slate-700">
            <div>
              <h3 className="text-lg font-semibold text-slate-900 dark:text-white">
                Change Permissions
              </h3>
              <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">{entry.name}</p>
            </div>
            <button
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-slate-500 dark:hover:text-slate-300 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
            >
              <XMarkIcon className="w-5 h-5" />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="p-6">
            {/* Octal Input */}
            <div className="mb-6">
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                Octal Notation
              </label>
              <input
                type="text"
                value={octalMode}
                onChange={(e) => handleOctalChange(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="755"
                maxLength={3}
              />
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                Enter 3-digit octal permissions (e.g., 755, 644)
              </p>
            </div>

            {/* Visual Permission Editor */}
            <div className="space-y-4">
              <div className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-3">
                Permissions
              </div>

              {/* User/Owner */}
              <div className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-700/50 rounded-lg">
                <div className="text-sm font-medium text-slate-700 dark:text-slate-300">Owner</div>
                <div className="flex space-x-4">
                  <label className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      checked={userRead}
                      onChange={(e) => setUserRead(e.target.checked)}
                      className="rounded border-slate-300 dark:border-slate-600 text-blue-600 focus:ring-blue-500"
                    />
                    <span className="text-xs text-slate-600 dark:text-slate-400">Read</span>
                  </label>
                  <label className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      checked={userWrite}
                      onChange={(e) => setUserWrite(e.target.checked)}
                      className="rounded border-slate-300 dark:border-slate-600 text-blue-600 focus:ring-blue-500"
                    />
                    <span className="text-xs text-slate-600 dark:text-slate-400">Write</span>
                  </label>
                  <label className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      checked={userExecute}
                      onChange={(e) => setUserExecute(e.target.checked)}
                      className="rounded border-slate-300 dark:border-slate-600 text-blue-600 focus:ring-blue-500"
                    />
                    <span className="text-xs text-slate-600 dark:text-slate-400">Execute</span>
                  </label>
                </div>
              </div>

              {/* Group */}
              <div className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-700/50 rounded-lg">
                <div className="text-sm font-medium text-slate-700 dark:text-slate-300">Group</div>
                <div className="flex space-x-4">
                  <label className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      checked={groupRead}
                      onChange={(e) => setGroupRead(e.target.checked)}
                      className="rounded border-slate-300 dark:border-slate-600 text-blue-600 focus:ring-blue-500"
                    />
                    <span className="text-xs text-slate-600 dark:text-slate-400">Read</span>
                  </label>
                  <label className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      checked={groupWrite}
                      onChange={(e) => setGroupWrite(e.target.checked)}
                      className="rounded border-slate-300 dark:border-slate-600 text-blue-600 focus:ring-blue-500"
                    />
                    <span className="text-xs text-slate-600 dark:text-slate-400">Write</span>
                  </label>
                  <label className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      checked={groupExecute}
                      onChange={(e) => setGroupExecute(e.target.checked)}
                      className="rounded border-slate-300 dark:border-slate-600 text-blue-600 focus:ring-blue-500"
                    />
                    <span className="text-xs text-slate-600 dark:text-slate-400">Execute</span>
                  </label>
                </div>
              </div>

              {/* Others */}
              <div className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-700/50 rounded-lg">
                <div className="text-sm font-medium text-slate-700 dark:text-slate-300">Others</div>
                <div className="flex space-x-4">
                  <label className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      checked={otherRead}
                      onChange={(e) => setOtherRead(e.target.checked)}
                      className="rounded border-slate-300 dark:border-slate-600 text-blue-600 focus:ring-blue-500"
                    />
                    <span className="text-xs text-slate-600 dark:text-slate-400">Read</span>
                  </label>
                  <label className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      checked={otherWrite}
                      onChange={(e) => setOtherWrite(e.target.checked)}
                      className="rounded border-slate-300 dark:border-slate-600 text-blue-600 focus:ring-blue-500"
                    />
                    <span className="text-xs text-slate-600 dark:text-slate-400">Write</span>
                  </label>
                  <label className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      checked={otherExecute}
                      onChange={(e) => setOtherExecute(e.target.checked)}
                      className="rounded border-slate-300 dark:border-slate-600 text-blue-600 focus:ring-blue-500"
                    />
                    <span className="text-xs text-slate-600 dark:text-slate-400">Execute</span>
                  </label>
                </div>
              </div>
            </div>

            {/* Recursive Option for Directories */}
            {entry.is_directory && (
              <div className="mt-6 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
                <label className="flex items-center space-x-3">
                  <input
                    type="checkbox"
                    checked={recursive}
                    onChange={(e) => setRecursive(e.target.checked)}
                    className="rounded border-blue-300 dark:border-blue-600 text-blue-600 focus:ring-blue-500"
                  />
                  <div>
                    <span className="text-sm font-medium text-blue-900 dark:text-blue-100">
                      Apply recursively
                    </span>
                    <p className="text-xs text-blue-700 dark:text-blue-300 mt-1">
                      Change permissions for all files and subdirectories within this directory
                    </p>
                  </div>
                </label>
              </div>
            )}

            <div className="flex items-center justify-end space-x-3 mt-6 pt-4 border-t border-slate-200 dark:border-slate-700">
              <button
                type="button"
                onClick={onClose}
                disabled={loading}
                className="px-4 py-2 text-sm font-medium text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading || octalMode.length !== 3}
                className="px-4 py-2 bg-orange-600 hover:bg-orange-700 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
              >
                {loading && (
                  <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin"></div>
                )}
                <span>Change Permissions</span>
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};
