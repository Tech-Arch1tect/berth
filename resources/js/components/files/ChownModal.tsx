import React, { useState, useEffect } from 'react';
import { FileEntry, ChownRequest } from '../../types/files';
import { XMarkIcon } from '@heroicons/react/24/outline';

interface ChownModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (request: ChownRequest) => void;
  entry: FileEntry | null;
  loading: boolean;
}

export const ChownModal: React.FC<ChownModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  entry,
  loading,
}) => {
  const [ownerID, setOwnerID] = useState('');
  const [groupID, setGroupID] = useState('');
  const [recursive, setRecursive] = useState(false);

  useEffect(() => {
    if (entry) {
      setOwnerID(entry.owner_id?.toString() || '');
      setGroupID(entry.group_id?.toString() || '');
      setRecursive(false);
    }
  }, [entry]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (entry && (ownerID.trim() || groupID.trim())) {
      onConfirm({
        path: entry.path,
        owner_id: ownerID.trim() ? parseInt(ownerID.trim()) : undefined,
        group_id: groupID.trim() ? parseInt(groupID.trim()) : undefined,
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
                Change Ownership
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
            {/* Current Ownership Display */}
            <div className="mb-6 p-4 bg-slate-50 dark:bg-slate-700/50 rounded-lg">
              <div className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                Current Ownership
              </div>
              <div className="space-y-1 text-sm text-slate-600 dark:text-slate-400">
                <div className="flex items-center justify-between">
                  <span>Owner:</span>
                  <span className="font-mono">
                    {entry.owner
                      ? `${entry.owner} (${entry.owner_id})`
                      : `UID ${entry.owner_id || 'Unknown'}`}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span>Group:</span>
                  <span className="font-mono">
                    {entry.group
                      ? `${entry.group} (${entry.group_id})`
                      : `GID ${entry.group_id || 'Unknown'}`}
                  </span>
                </div>
              </div>
            </div>

            {/* Owner Input */}
            <div className="mb-4">
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                New Owner ID
              </label>
              <input
                type="number"
                value={ownerID}
                onChange={(e) => setOwnerID(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="User ID (leave empty to keep current)"
              />
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                Enter numeric user ID or leave empty to keep current owner
              </p>
            </div>

            {/* Group Input */}
            <div className="mb-6">
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                New Group ID
              </label>
              <input
                type="number"
                value={groupID}
                onChange={(e) => setGroupID(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="Group ID (leave empty to keep current)"
              />
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                Enter numeric group ID or leave empty to keep current group
              </p>
            </div>

            {/* Recursive Option for Directories */}
            {entry.is_directory && (
              <div className="mb-6 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
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
                      Change ownership for all files and subdirectories within this directory
                    </p>
                  </div>
                </label>
              </div>
            )}

            <div className="flex items-center justify-end space-x-3 pt-4 border-t border-slate-200 dark:border-slate-700">
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
                disabled={loading || (!ownerID.trim() && !groupID.trim())}
                className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
              >
                {loading && (
                  <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin"></div>
                )}
                <span>Change Ownership</span>
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};
