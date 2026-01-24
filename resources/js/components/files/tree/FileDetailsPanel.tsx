import React, { useState } from 'react';
import type { GetApiV1ServersServeridStacksStacknameFiles200EntriesItem } from '../../../api/generated/models';
import { cn } from '../../../utils/cn';
import { theme } from '../../../theme';
import { ChevronDownIcon, ChevronRightIcon } from '@heroicons/react/24/outline';

interface FileDetailsPanelProps {
  entry: GetApiV1ServersServeridStacksStacknameFiles200EntriesItem | null;
}

const formatSize = (bytes: number): string => {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
};

const formatDate = (dateString: string): string => {
  try {
    const date = new Date(dateString);
    return date.toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return dateString;
  }
};

const parsePermissions = (mode: string): string => {
  if (mode.length >= 9 && /^[drwx-]+$/.test(mode)) {
    return mode;
  }

  const octal = parseInt(mode, 8);
  if (isNaN(octal)) return mode;

  const perms = ['---', '--x', '-w-', '-wx', 'r--', 'r-x', 'rw-', 'rwx'];
  const owner = perms[(octal >> 6) & 7];
  const group = perms[(octal >> 3) & 7];
  const other = perms[octal & 7];
  return owner + group + other;
};

export const FileDetailsPanel: React.FC<FileDetailsPanelProps> = ({ entry }) => {
  const [isExpanded, setIsExpanded] = useState(true);

  return (
    <div
      className={cn(
        'flex-shrink-0 border-t border-zinc-200 dark:border-zinc-800',
        'bg-white dark:bg-zinc-900'
      )}
    >
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className={cn(
          'w-full flex items-center justify-between px-3 py-2',
          'text-xs font-bold uppercase tracking-wider',
          theme.text.muted,
          'hover:bg-zinc-50 dark:hover:bg-zinc-800/50',
          'transition-colors'
        )}
      >
        <span>Details</span>
        {isExpanded ? (
          <ChevronDownIcon className="w-3.5 h-3.5" />
        ) : (
          <ChevronRightIcon className="w-3.5 h-3.5" />
        )}
      </button>

      {isExpanded && (
        <div className="px-3 pb-3">
          {entry ? (
            <div className="space-y-2">
              <DetailRow label="Name" value={entry.name} />
              <DetailRow label="Path" value={entry.path} truncate />
              <DetailRow label="Type" value={entry.is_directory ? 'Directory' : 'File'} />
              {!entry.is_directory && <DetailRow label="Size" value={formatSize(entry.size)} />}
              <DetailRow label="Modified" value={formatDate(entry.mod_time)} />
              <DetailRow
                label="Permissions"
                value={
                  <span className="font-mono">
                    {parsePermissions(entry.mode)}{' '}
                    <span className={theme.text.subtle}>({entry.mode})</span>
                  </span>
                }
              />
              {(entry.owner || entry.owner_id !== undefined) && (
                <DetailRow
                  label="Owner"
                  value={
                    entry.owner ? `${entry.owner} (${entry.owner_id})` : String(entry.owner_id)
                  }
                />
              )}
              {(entry.group || entry.group_id !== undefined) && (
                <DetailRow
                  label="Group"
                  value={
                    entry.group ? `${entry.group} (${entry.group_id})` : String(entry.group_id)
                  }
                />
              )}
            </div>
          ) : (
            <p className={cn('text-xs italic', theme.text.subtle)}>
              Select a file or folder to view details
            </p>
          )}
        </div>
      )}
    </div>
  );
};

interface DetailRowProps {
  label: string;
  value: React.ReactNode;
  truncate?: boolean;
}

const DetailRow: React.FC<DetailRowProps> = ({ label, value, truncate }) => (
  <div className="flex flex-col gap-0.5">
    <span className={cn('text-[10px] uppercase tracking-wider font-semibold', theme.text.subtle)}>
      {label}
    </span>
    <span
      className={cn('text-xs', theme.text.standard, truncate && 'truncate')}
      title={truncate && typeof value === 'string' ? value : undefined}
    >
      {value}
    </span>
  </div>
);
