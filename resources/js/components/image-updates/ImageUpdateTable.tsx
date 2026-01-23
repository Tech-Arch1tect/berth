import React, { useState } from 'react';
import {
  CheckCircleIcon,
  XCircleIcon,
  ClipboardIcon,
  ClipboardDocumentCheckIcon,
} from '@heroicons/react/24/outline';
import { cn } from '../../utils/cn';
import { theme } from '../../theme';
import type { GetApiV1ImageUpdates200UpdatesItem } from '../../api/generated/models';

interface ImageUpdateTableProps {
  updates: GetApiV1ImageUpdates200UpdatesItem[];
}

export const ImageUpdateTable: React.FC<ImageUpdateTableProps> = ({ updates }) => {
  const [copiedDigest, setCopiedDigest] = useState<string | null>(null);

  const handleCopyDigest = async (digest: string, id: string) => {
    try {
      await navigator.clipboard.writeText(digest);
      setCopiedDigest(id);
      setTimeout(() => setCopiedDigest(null), 2000);
    } catch (err) {
      console.error('Failed to copy digest:', err);
    }
  };

  const truncateDigest = (digest: string) => {
    if (!digest) return '-';
    // Show sha256: prefix and first 12 chars after it
    if (digest.startsWith('sha256:')) {
      return `${digest.substring(0, 19)}...`;
    }
    return `${digest.substring(0, 12)}...`;
  };

  const formatRelativeTime = (timestamp: string | null) => {
    if (!timestamp) return 'Never';
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins} minute${diffMins !== 1 ? 's' : ''} ago`;
    if (diffHours < 24) return `${diffHours} hour${diffHours !== 1 ? 's' : ''} ago`;
    if (diffDays < 7) return `${diffDays} day${diffDays !== 1 ? 's' : ''} ago`;
    return date.toLocaleDateString();
  };

  if (updates.length === 0) {
    return (
      <div className={cn('text-center py-8', theme.text.muted)}>
        <p className="text-sm">No image updates available</p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className={theme.table.element}>
        <thead className={theme.table.head}>
          <tr>
            <th className={cn(theme.table.headCell, 'text-left')}>Container</th>
            <th className={cn(theme.table.headCell, 'text-left')}>Image</th>
            <th className={cn(theme.table.headCell, 'text-left')}>Current Digest</th>
            <th className={cn(theme.table.headCell, 'text-left')}>Latest Digest</th>
            <th className={cn(theme.table.headCell, 'text-center')}>Status</th>
            <th className={cn(theme.table.headCell, 'text-right')}>Last Checked</th>
          </tr>
        </thead>
        <tbody className={theme.table.body}>
          {updates.map((update) => (
            <tr key={update.id} className={theme.table.row}>
              <td className={theme.table.cell}>
                <span className={cn('font-medium', theme.text.strong)}>
                  {update.container_name}
                </span>
              </td>
              <td className={theme.table.cell}>
                <span className={cn('font-mono text-xs', theme.text.muted)}>
                  {update.current_image_name}
                </span>
              </td>
              <td className={theme.table.cell}>
                <div className="flex items-center gap-2">
                  <code className={cn('text-xs', theme.text.subtle)}>
                    {truncateDigest(update.current_repo_digest)}
                  </code>
                  {update.current_repo_digest && (
                    <button
                      onClick={() =>
                        handleCopyDigest(update.current_repo_digest, `current-${update.id}`)
                      }
                      className={cn(
                        'p-1 rounded transition-colors',
                        theme.text.subtle,
                        'hover:bg-black/5 dark:hover:bg-white/5'
                      )}
                      title="Copy full digest"
                    >
                      {copiedDigest === `current-${update.id}` ? (
                        <ClipboardDocumentCheckIcon className="h-3.5 w-3.5 text-green-500" />
                      ) : (
                        <ClipboardIcon className="h-3.5 w-3.5" />
                      )}
                    </button>
                  )}
                </div>
              </td>
              <td className={theme.table.cell}>
                <div className="flex items-center gap-2">
                  <code className={cn('text-xs', theme.text.subtle)}>
                    {truncateDigest(update.latest_repo_digest)}
                  </code>
                  {update.latest_repo_digest && (
                    <button
                      onClick={() =>
                        handleCopyDigest(update.latest_repo_digest, `latest-${update.id}`)
                      }
                      className={cn(
                        'p-1 rounded transition-colors',
                        theme.text.subtle,
                        'hover:bg-black/5 dark:hover:bg-white/5'
                      )}
                      title="Copy full digest"
                    >
                      {copiedDigest === `latest-${update.id}` ? (
                        <ClipboardDocumentCheckIcon className="h-3.5 w-3.5 text-green-500" />
                      ) : (
                        <ClipboardIcon className="h-3.5 w-3.5" />
                      )}
                    </button>
                  )}
                </div>
              </td>
              <td className={cn(theme.table.cell, 'text-center')}>
                {update.check_error ? (
                  <div className="flex items-center justify-center gap-2">
                    <XCircleIcon className={cn('h-4 w-4', theme.text.danger)} />
                    <span className={cn('text-xs', theme.text.danger)} title={update.check_error}>
                      Error
                    </span>
                  </div>
                ) : update.update_available ? (
                  <div className="flex items-center justify-center gap-2">
                    <CheckCircleIcon className={cn('h-4 w-4', theme.text.success)} />
                    <span className={cn('text-xs font-medium', theme.text.success)}>Available</span>
                  </div>
                ) : (
                  <span className={cn('text-xs', theme.text.subtle)}>Up to date</span>
                )}
              </td>
              <td className={cn(theme.table.cell, 'text-right')}>
                <span className={cn('text-xs', theme.text.muted)}>
                  {formatRelativeTime(update.last_checked_at)}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {updates.some((u) => u.check_error) && (
        <div className={cn('mt-3 text-xs', theme.text.muted)}>
          <p>
            * Errors may occur due to rate limits, network issues, or authentication failures. The
            background check will retry automatically.
          </p>
        </div>
      )}
    </div>
  );
};
