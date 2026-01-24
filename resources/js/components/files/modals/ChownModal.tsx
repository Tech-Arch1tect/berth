import React, { useState } from 'react';
import type {
  GetApiV1ServersServeridStacksStacknameFiles200EntriesItem,
  PostApiV1ServersServeridStacksStacknameFilesChownBody,
} from '../../../api/generated/models';
import { cn } from '../../../utils/cn';
import { theme } from '../../../theme';
import { Modal } from '../../common/Modal';

interface ChownModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (request: PostApiV1ServersServeridStacksStacknameFilesChownBody) => void;
  entry: GetApiV1ServersServeridStacksStacknameFiles200EntriesItem | null;
  loading: boolean;
}

export const ChownModal: React.FC<ChownModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  entry,
  loading,
}) => {
  const [ownerID, setOwnerID] = useState(() => entry?.owner_id?.toString() || '');
  const [groupID, setGroupID] = useState(() => entry?.group_id?.toString() || '');
  const [recursive, setRecursive] = useState(false);
  const [prevEntry, setPrevEntry] = useState(entry);

  if (entry !== prevEntry) {
    setPrevEntry(entry);
    if (entry) {
      setOwnerID(entry.owner_id?.toString() || '');
      setGroupID(entry.group_id?.toString() || '');
      setRecursive(false);
    }
  }

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
        form="chown-form"
        disabled={loading || (!ownerID.trim() && !groupID.trim())}
        className={cn(
          theme.buttons.primary,
          'disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2'
        )}
      >
        {loading && (
          <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin"></div>
        )}
        <span>Change Ownership</span>
      </button>
    </>
  );

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Change Ownership"
      subtitle={entry.name}
      size="sm"
      footer={footer}
    >
      <form id="chown-form" onSubmit={handleSubmit} className="space-y-4">
        <div className={cn(theme.surface.muted, 'mb-6 p-4 rounded-lg')}>
          <div className={cn('text-sm font-medium mb-2', theme.text.standard)}>
            Current Ownership
          </div>
          <div className={cn('space-y-1 text-sm', theme.text.muted)}>
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

        <div className="mb-4">
          <label className={cn(theme.forms.label, 'mb-2')}>New Owner ID</label>
          <input
            type="number"
            value={ownerID}
            onChange={(e) => setOwnerID(e.target.value)}
            className={cn(theme.forms.input, 'w-full')}
            placeholder="User ID (leave empty to keep current)"
          />
          <p className={cn('text-xs mt-1', theme.text.subtle)}>
            Enter numeric user ID or leave empty to keep current owner
          </p>
        </div>

        <div className="mb-6">
          <label className={cn(theme.forms.label, 'mb-2')}>New Group ID</label>
          <input
            type="number"
            value={groupID}
            onChange={(e) => setGroupID(e.target.value)}
            className={cn(theme.forms.input, 'w-full')}
            placeholder="Group ID (leave empty to keep current)"
          />
          <p className={cn('text-xs mt-1', theme.text.subtle)}>
            Enter numeric group ID or leave empty to keep current group
          </p>
        </div>

        {entry.is_directory && (
          <div
            className={cn(
              theme.intent.info.surface,
              theme.intent.info.border,
              'mb-6 p-4 rounded-lg border'
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
                  Change ownership for all files and subdirectories within this directory
                </p>
              </div>
            </label>
          </div>
        )}
      </form>
    </Modal>
  );
};
