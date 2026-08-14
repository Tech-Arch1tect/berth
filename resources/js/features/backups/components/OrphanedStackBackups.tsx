import { useState } from 'react';
import { TrashIcon } from '@heroicons/react/24/outline';
import { cn } from '../../../shared/utils/cn';
import { theme } from '../../../shared/theme';
import { LoadingSpinner } from '../../../shared/components/LoadingSpinner';
import { ConfirmationModal } from '../../../shared/components/ConfirmationModal';
import { formatBytes, formatRelativeTime } from '../../../shared/utils/formatters';
import { showToast } from '../../../shared/utils/toast';
import {
  useGetApiV1ServersServeridStacksStacknameBackups,
  useDeleteApiV1ServersServeridStacksStacknameBackupsBackupid,
} from '../../../api/generated/backups/backups';
import { BackupStatusBadge } from './BackupStatusBadge';

interface OrphanedStackBackupsProps {
  serverid: number;
  stackname: string;
}

export function OrphanedStackBackups({ serverid, stackname }: OrphanedStackBackupsProps) {
  const [pendingDelete, setPendingDelete] = useState<string | null>(null);

  const query = useGetApiV1ServersServeridStacksStacknameBackups(serverid, stackname, undefined, {
    query: { select: (response) => response.data },
  });
  const deleteMutation = useDeleteApiV1ServersServeridStacksStacknameBackupsBackupid();

  const runs = query.data?.runs ?? [];

  const confirmDelete = async () => {
    if (!pendingDelete) return;
    try {
      await deleteMutation.mutateAsync({ serverid, stackname, backupid: pendingDelete });
      showToast.success(`Deleted backup from ${stackname}`);
      query.refetch();
    } catch (error) {
      showToast.error(
        error instanceof Error ? error.message : `Failed to delete the backup from ${stackname}`
      );
    } finally {
      setPendingDelete(null);
    }
  };

  if (query.isLoading) {
    return (
      <div className="px-4 pb-3">
        <LoadingSpinner text="Reading this stack's backups..." />
      </div>
    );
  }

  if (query.error) {
    return (
      <p className={cn('px-4 pb-3 text-sm', theme.text.danger)}>
        The backups for this stack could not be read.
      </p>
    );
  }

  return (
    <div className="px-4 pb-3">
      <p className={cn('mb-2 text-sm', theme.text.muted)}>
        The stack directory is gone, so these backups cannot be restored until a stack of this name
        exists again. Deleting one removes its snapshots from the repository.
      </p>
      <ul className={cn('overflow-hidden rounded-lg border', theme.cards.sectionDivider)}>
        {runs.map((run) => (
          <li
            key={run.id}
            className={cn(
              'flex flex-wrap items-center justify-between gap-2 border-b p-3 last:border-b-0',
              theme.cards.sectionDivider,
              theme.containers.panel
            )}
          >
            <span className="min-w-0">
              <span className={cn('flex flex-wrap items-center gap-2 text-sm', theme.text.strong)}>
                {formatRelativeTime(run.started_at)}
                <BackupStatusBadge status={run.status} />
              </span>
              {run.label && (
                <span className={cn('block truncate text-xs', theme.text.muted)}>{run.label}</span>
              )}
              <span className={cn('block text-xs', theme.text.muted)}>
                {run.component_count} {run.component_count === 1 ? 'component' : 'components'}
                {run.size_bytes > 0 && ` · ${formatBytes(run.size_bytes)}`}
              </span>
            </span>
            <button
              type="button"
              onClick={() => setPendingDelete(run.id)}
              disabled={deleteMutation.isPending}
              aria-label={`Delete backup taken ${formatRelativeTime(run.started_at)}`}
              className={cn(
                'flex h-11 w-11 items-center justify-center rounded-lg transition-colors',
                theme.text.danger,
                'hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-50 dark:hover:bg-rose-900/20'
              )}
            >
              <TrashIcon className="h-4 w-4" />
            </button>
          </li>
        ))}
        {runs.length === 0 && (
          <li className={cn('p-3 text-sm', theme.text.muted, theme.containers.panel)}>
            No backups remain for this stack.
          </li>
        )}
      </ul>

      <ConfirmationModal
        isOpen={pendingDelete !== null}
        onClose={() => setPendingDelete(null)}
        onConfirm={confirmDelete}
        title="Delete this backup"
        message={`This removes the backup's snapshots from the repository for ${stackname}. The stack itself no longer exists, so this cannot be undone.`}
        confirmText="Delete"
        variant="danger"
        isLoading={deleteMutation.isPending}
      />
    </div>
  );
}
