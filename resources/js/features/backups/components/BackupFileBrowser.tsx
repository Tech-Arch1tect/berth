import { useState } from 'react';
import { ArrowDownTrayIcon, DocumentIcon, FolderIcon } from '@heroicons/react/24/outline';
import { useGetApiV1ServersServeridStacksStacknameBackupsBackupidFiles } from '../../../api/generated/backups/backups';
import { apiClient, isApiError } from '../../../api/client';
import { Modal } from '../../../shared/components/Modal';
import { LoadingSpinner } from '../../../shared/components/LoadingSpinner';
import { cn } from '../../../shared/utils/cn';
import { theme } from '../../../shared/theme';
import { formatBytes, formatRelativeTime } from '../../../shared/utils/formatters';

interface BackupFileBrowserProps {
  serverid: number;
  stackname: string;
  backupId: string;
  componentId: string;
  componentLabel: string;
  onClose: () => void;
}

type SelectedKind = 'file' | 'dir';

const sanitiseForFilename = (value: string) => value.replace(/[^a-zA-Z0-9\-_.]/g, '-');

const errorMessage = (error: unknown, fallback: string) => {
  if (isApiError<{ error?: { message?: string } }>(error)) {
    return error.data?.error?.message ?? fallback;
  }
  return error instanceof Error ? error.message : fallback;
};

export function BackupFileBrowser({
  serverid,
  stackname,
  backupId,
  componentId,
  componentLabel,
  onClose,
}: BackupFileBrowserProps) {
  const [path, setPath] = useState('/');
  const [selected, setSelected] = useState<Map<string, SelectedKind>>(new Map());
  const [downloading, setDownloading] = useState(false);
  const [downloadError, setDownloadError] = useState<string | null>(null);

  const listingQuery = useGetApiV1ServersServeridStacksStacknameBackupsBackupidFiles(
    serverid,
    stackname,
    backupId,
    { component: componentId, path }
  );
  const entries = listingQuery.data?.data?.entries ?? [];
  const segments = path.split('/').filter(Boolean);

  const entryPath = (name: string) => (path === '/' ? `/${name}` : `${path}/${name}`);

  const toggleSelected = (fullPath: string, kind: SelectedKind) => {
    setSelected((previous) => {
      const next = new Map(previous);
      if (next.has(fullPath)) {
        next.delete(fullPath);
      } else {
        next.set(fullPath, kind);
      }
      return next;
    });
  };

  const downloadName = (paths: string[]) => {
    if (paths.length === 1 && selected.size <= 1) {
      const only = paths[0];
      const kind = selected.get(only);
      if (kind === 'file' || entries.some((e) => e.type === 'file' && entryPath(e.name) === only)) {
        return only.split('/').pop() || 'download';
      }
    }
    return `${sanitiseForFilename(stackname)}-${sanitiseForFilename(backupId.slice(0, 8))}-${sanitiseForFilename(componentId)}.tar.gz`;
  };

  const download = async (paths: string[]) => {
    setDownloading(true);
    setDownloadError(null);
    try {
      const params = new URLSearchParams({ component: componentId });
      paths.forEach((p) => params.append('path', p));
      const blob = await apiClient<Blob>(
        `/api/v1/servers/${serverid}/stacks/${stackname}/backups/${backupId}/download?${params.toString()}`
      );
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = downloadName(paths);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      setDownloadError(errorMessage(error, 'Failed to download from the backup'));
    } finally {
      setDownloading(false);
    }
  };

  const downloadSelection = () => {
    if (selected.size > 0) {
      void download([...selected.keys()]);
    } else {
      void download([path]);
    }
  };

  const breadcrumb = (
    <nav className="flex flex-wrap items-center gap-1 text-sm" aria-label="Backup folder path">
      <button
        type="button"
        onClick={() => setPath('/')}
        className={cn('font-medium hover:underline', theme.text.info)}
      >
        {componentLabel}
      </button>
      {segments.map((segment, index) => {
        const target = '/' + segments.slice(0, index + 1).join('/');
        const isCurrent = index === segments.length - 1;
        return (
          <span key={target} className="flex items-center gap-1">
            <span className={theme.text.subtle}>/</span>
            {isCurrent ? (
              <span className={theme.text.strong}>{segment}</span>
            ) : (
              <button
                type="button"
                onClick={() => setPath(target)}
                className={cn('hover:underline', theme.text.info)}
              >
                {segment}
              </button>
            )}
          </span>
        );
      })}
    </nav>
  );

  return (
    <Modal
      isOpen
      onClose={onClose}
      title="Browse backup files"
      subtitle={`${componentLabel} · backup ${backupId.slice(0, 8)}`}
      size="2xl"
      fullScreenOnMobile
      footer={
        <div className="flex w-full flex-wrap items-center justify-between gap-2">
          <span className={cn('text-sm', theme.text.muted)}>
            {selected.size > 0 ? `${selected.size} selected` : 'Nothing selected'}
          </span>
          <div className="flex gap-2">
            <button type="button" onClick={onClose} className={theme.buttons.secondary}>
              Close
            </button>
            <button
              type="button"
              onClick={downloadSelection}
              disabled={downloading || listingQuery.isLoading}
              className={cn(theme.buttons.primary, 'disabled:opacity-50')}
            >
              {downloading
                ? 'Downloading…'
                : selected.size > 0
                  ? `Download selected (${selected.size})`
                  : 'Download this folder as .tar.gz'}
            </button>
          </div>
        </div>
      }
    >
      <div className="space-y-3">
        {breadcrumb}

        {downloadError && (
          <div
            className={cn(
              'rounded-md border p-3 text-sm',
              theme.intent.danger.surface,
              theme.intent.danger.border,
              theme.intent.danger.textStrong
            )}
          >
            {downloadError}
          </div>
        )}

        {listingQuery.isLoading ? (
          <LoadingSpinner size="md" text="Reading the backup…" />
        ) : listingQuery.isError ? (
          <p className={cn('text-sm', theme.text.warning)}>
            {errorMessage(listingQuery.error, 'Failed to list files in the backup')}
          </p>
        ) : entries.length === 0 ? (
          <p className={cn('text-sm', theme.text.muted)}>This folder is empty.</p>
        ) : (
          <ul className="divide-y divide-zinc-200 dark:divide-zinc-800">
            {entries.map((entry) => {
              const fullPath = entryPath(entry.name);
              const isDir = entry.type === 'dir';
              return (
                <li key={fullPath} className="flex min-h-[44px] items-center gap-3 py-1.5">
                  <input
                    type="checkbox"
                    aria-label={`Select ${entry.name}`}
                    checked={selected.has(fullPath)}
                    onChange={() => toggleSelected(fullPath, entry.type as SelectedKind)}
                    className={theme.forms.checkbox}
                  />
                  {isDir ? (
                    <button
                      type="button"
                      onClick={() => setPath(fullPath)}
                      className="flex min-w-0 flex-1 items-center gap-2 text-left"
                    >
                      <FolderIcon className={cn('h-5 w-5 shrink-0', theme.text.info)} />
                      <span className={cn('truncate text-sm font-medium', theme.text.strong)}>
                        {entry.name}
                      </span>
                    </button>
                  ) : (
                    <span className="flex min-w-0 flex-1 items-center gap-2">
                      <DocumentIcon className={cn('h-5 w-5 shrink-0', theme.text.subtle)} />
                      <span className={cn('truncate text-sm', theme.text.standard)}>
                        {entry.name}
                      </span>
                    </span>
                  )}
                  <span className={cn('hidden text-xs tabular-nums sm:block', theme.text.muted)}>
                    {isDir ? '' : formatBytes(entry.size)}
                  </span>
                  <span
                    className={cn('hidden text-xs md:block', theme.text.subtle)}
                    title={entry.mtime}
                  >
                    {formatRelativeTime(entry.mtime)}
                  </span>
                  <button
                    type="button"
                    onClick={() => void download([fullPath])}
                    disabled={downloading}
                    aria-label={
                      isDir ? `Download folder ${entry.name} as .tar.gz` : `Download ${entry.name}`
                    }
                    title={isDir ? 'Download this folder as .tar.gz' : 'Download this file'}
                    className={cn(
                      'flex min-h-[44px] min-w-[44px] items-center justify-center rounded-lg disabled:opacity-50',
                      theme.surface.muted,
                      theme.text.standard
                    )}
                  >
                    <ArrowDownTrayIcon className="h-5 w-5" />
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </Modal>
  );
}
