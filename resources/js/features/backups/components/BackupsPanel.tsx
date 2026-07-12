import { useEffect, useMemo, useState } from 'react';
import { ArchiveBoxIcon, ArrowPathIcon } from '@heroicons/react/24/outline';
import {
  useDeleteApiV1ServersServeridStacksStacknameBackupsBackupid,
  useGetApiV1ServersServeridStacksStacknameBackups,
  useGetApiV1ServersServeridStacksStacknameBackupsBackupid,
} from '../../../api/generated/backups/backups';
import { ConfirmationModal } from '../../../shared/components/ConfirmationModal';
import { formatDate } from '../../../shared/utils/formatters';
import type { RunSummary } from '../../../api/generated/models';
import { useOperations } from '../../operations/hooks/useOperations';
import { RecordList, RecordListColumn } from '../../../shared/components/RecordList';
import { EmptyState } from '../../../shared/components/EmptyState';
import { cn } from '../../../shared/utils/cn';
import { theme } from '../../../shared/theme';
import { formatBytes, formatRelativeTime } from '../../../shared/utils/formatters';
import {
  buildCreateBackupOptions,
  buildRestoreOptions,
  latestRepoSizeBytes,
  StopMode,
} from '../utils';
import { BackupOptionsModal } from './BackupOptionsModal';
import { BackupRunDetail } from './BackupRunDetail';
import { RestoreBackupModal } from './RestoreBackupModal';
import { BackupStatusBadge } from './BackupStatusBadge';

const PAGE_SIZE = 20;

interface BackupsPanelProps {
  serverid: number;
  stackname: string;
  canManage: boolean;
  canRestore: boolean;
}

export function BackupsPanel({ serverid, stackname, canManage, canRestore }: BackupsPanelProps) {
  const [page, setPage] = useState(1);
  const [selectedRunId, setSelectedRunId] = useState<string | null>(null);
  const [optionsOpen, setOptionsOpen] = useState(false);
  const [restoreOpen, setRestoreOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [isStarting, setIsStarting] = useState(false);
  const [startError, setStartError] = useState<string | null>(null);

  const backupsQuery = useGetApiV1ServersServeridStacksStacknameBackups(serverid, stackname, {
    limit: PAGE_SIZE,
    offset: (page - 1) * PAGE_SIZE,
  });
  const listing = backupsQuery.data?.data;
  const runs = useMemo(() => listing?.runs ?? [], [listing]);
  const [headline, setHeadline] = useState<{
    newest: RunSummary;
    repoSize: number | null;
  } | null>(null);
  useEffect(() => {
    if (page !== 1 || backupsQuery.isLoading) return;
    setHeadline(runs.length > 0 ? { newest: runs[0], repoSize: latestRepoSizeBytes(runs) } : null);
  }, [page, runs, backupsQuery.isLoading]);

  const detailQuery = useGetApiV1ServersServeridStacksStacknameBackupsBackupid(
    serverid,
    stackname,
    selectedRunId ?? '',
    { query: { enabled: !!selectedRunId } }
  );
  const selectedRun = selectedRunId ? (detailQuery.data?.data ?? null) : null;

  const operations = useOperations({
    serverid: String(serverid),
    stackname,
    onOperationComplete: () => backupsQuery.refetch(),
    onError: () => backupsQuery.refetch(),
  });
  const backupOperationRunning =
    operations.operationStatus.isRunning &&
    (operations.operationStatus.command === 'create-backup' ||
      operations.operationStatus.command === 'restore-backup');
  const restoreRunning =
    operations.operationStatus.isRunning && operations.operationStatus.command === 'restore-backup';

  const startBackup = async (stopMode: StopMode) => {
    setIsStarting(true);
    setStartError(null);
    try {
      await operations.startOperation({
        command: 'create-backup',
        options: buildCreateBackupOptions(stopMode),
        services: [],
      });
      setOptionsOpen(false);
    } catch (error) {
      setStartError(error instanceof Error ? error.message : 'Failed to start the backup');
    } finally {
      setIsStarting(false);
    }
  };

  const deleteMutation = useDeleteApiV1ServersServeridStacksStacknameBackupsBackupid({
    mutation: {
      onSuccess: () => {
        setDeleteOpen(false);
        setSelectedRunId(null);
        backupsQuery.refetch();
      },
      onError: (error) => {
        setDeleteOpen(false);
        setStartError(error instanceof Error ? error.message : 'Failed to delete the backup');
      },
    },
  });

  const startRestore = async (componentIds: string[], keepExtraFiles: boolean) => {
    if (!selectedRun) return;
    setIsStarting(true);
    setStartError(null);
    try {
      await operations.startOperation({
        command: 'restore-backup',
        options: buildRestoreOptions(selectedRun.id, componentIds, keepExtraFiles),
        services: [],
      });
      setRestoreOpen(false);
    } catch (error) {
      setStartError(error instanceof Error ? error.message : 'Failed to start the restore');
    } finally {
      setIsStarting(false);
    }
  };

  const columns: RecordListColumn<RunSummary>[] = [
    {
      key: 'status',
      header: 'Status',
      render: (run) => (
        <div>
          <BackupStatusBadge status={run.status} />
          {run.components_with_errors > 0 && run.status === 'completed' && (
            <div className="text-xs text-amber-700 dark:text-amber-400">with component errors</div>
          )}
        </div>
      ),
    },
    {
      key: 'started',
      header: 'Started',
      render: (run) => (
        <span className={cn('text-sm', theme.text.standard)} title={run.started_at}>
          {formatRelativeTime(run.started_at)}
        </span>
      ),
    },
    {
      key: 'components',
      header: 'Components',
      render: (run) => (
        <span className={cn('text-sm', theme.text.standard)}>{run.component_count}</span>
      ),
    },
    {
      key: 'size',
      header: 'Size',
      render: (run) => (
        <span className={cn('text-sm', theme.text.standard)}>{formatBytes(run.size_bytes)}</span>
      ),
    },
    {
      key: 'added',
      header: 'Added',
      render: (run) => (
        <span className={cn('text-sm', theme.text.muted)}>{formatBytes(run.added_bytes)}</span>
      ),
    },
    {
      key: 'id',
      header: 'Backup',
      render: (run) => (
        <span className={cn('text-xs font-mono', theme.text.subtle)}>{run.id.slice(0, 8)}</span>
      ),
    },
  ];

  if (listing && !listing.configured) {
    return (
      <div className="flex h-full items-center justify-center p-6">
        <EmptyState
          icon={ArchiveBoxIcon}
          title="Backups are not configured on this agent"
          description="Set BACKUP_LOCATION and BACKUP_PASSWORD in the agent's environment to enable stack backups. Keep the password safe: without it, backups cannot be restored."
          variant="info"
          size="lg"
        />
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-zinc-200 dark:border-zinc-800 p-4">
        <div>
          <h3 className={cn('text-base font-semibold', theme.text.strong)}>Backups</h3>
          <p className={cn('text-xs', theme.text.muted)}>
            Incremental backups of the stack directory, bind mounts and volumes, stored on the agent
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => backupsQuery.refetch()}
            aria-label="Refresh backups"
            className={cn(
              'p-2.5 rounded-lg min-h-[44px] min-w-[44px] flex items-center justify-center',
              theme.surface.muted,
              theme.text.standard
            )}
          >
            <ArrowPathIcon className={cn('w-5 h-5', backupsQuery.isFetching && 'animate-spin')} />
          </button>
          {canManage && (
            <button
              type="button"
              onClick={() => setOptionsOpen(true)}
              disabled={backupOperationRunning}
              className={cn(
                'px-4 py-2 rounded-lg text-sm font-medium min-h-[44px]',
                'bg-teal-600 text-white hover:bg-teal-500 disabled:opacity-50'
              )}
            >
              {backupOperationRunning ? 'Working…' : 'Back up'}
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 border-b border-zinc-200 dark:border-zinc-800 p-4 sm:grid-cols-4">
        <div title="Measured after the most recent backup; deleting runs frees space that shows here after the next backup">
          <p className={cn('text-xl font-semibold tabular-nums', theme.text.strong)}>
            {headline?.repoSize != null ? formatBytes(headline.repoSize) : '—'}
          </p>
          <p className={cn('text-xs', theme.text.muted)}>Total backup size on disk</p>
        </div>
        <div>
          <p className={cn('text-xl font-semibold tabular-nums', theme.text.strong)}>
            {listing?.total ?? '—'}
          </p>
          <p className={cn('text-xs', theme.text.muted)}>Backups</p>
        </div>
        <div>
          <p className={cn('text-xl font-semibold', theme.text.strong)}>
            {headline ? formatRelativeTime(headline.newest.started_at) : 'Never'}
          </p>
          <p className={cn('text-xs', theme.text.muted)}>
            Last backup{headline ? ` · ${headline.newest.status}` : ''}
          </p>
        </div>
        <div>
          <p className={cn('text-xl font-semibold tabular-nums', theme.text.strong)}>
            {headline ? formatBytes(headline.newest.size_bytes) : '—'}
          </p>
          <p className={cn('text-xs', theme.text.muted)}>Data size at last backup</p>
        </div>
      </div>

      {backupOperationRunning && (
        <div
          className={cn(
            'border-b border-zinc-200 dark:border-zinc-800 px-4 py-2 text-sm',
            theme.text.muted
          )}
        >
          {restoreRunning
            ? 'A restore is running — live output is in the operations panel.'
            : 'A backup is running — live output is in the operations panel.'}
        </div>
      )}
      {(startError || operations.error) && (
        <div className="border-b border-zinc-200 dark:border-zinc-800 px-4 py-2 text-sm text-red-600 dark:text-red-400">
          {startError || operations.error}
        </div>
      )}

      <div className="min-h-0 flex-1 overflow-auto p-4">
        <RecordList<RunSummary>
          records={runs}
          columns={columns}
          recordKey={(run) => run.id}
          renderCard={(run) => (
            <div className="space-y-1">
              <div className="flex items-center justify-between gap-2">
                <BackupStatusBadge status={run.status} />
                <span className={cn('text-xs', theme.text.muted)}>
                  {formatRelativeTime(run.started_at)}
                </span>
              </div>
              <div className={cn('text-xs', theme.text.muted)}>
                {run.component_count} {run.component_count === 1 ? 'component' : 'components'} ·{' '}
                {formatBytes(run.size_bytes)} · {formatBytes(run.added_bytes)} added
              </div>
            </div>
          )}
          onSelect={(run) => setSelectedRunId(run.id)}
          selectedKey={selectedRunId}
          isLoading={backupsQuery.isLoading}
          emptyTitle="No backups yet"
          emptyDescription={
            canManage
              ? 'Take the first backup of this stack with the Back up button.'
              : 'No backups have been taken for this stack.'
          }
          page={page}
          pageSize={PAGE_SIZE}
          totalCount={listing?.total ?? 0}
          onPageChange={setPage}
          detail={
            selectedRun ? (
              <BackupRunDetail
                run={selectedRun}
                canRestore={canRestore}
                canManage={canManage}
                isOperationRunning={backupOperationRunning || deleteMutation.isPending}
                onRestore={() => setRestoreOpen(true)}
                onDelete={() => setDeleteOpen(true)}
              />
            ) : null
          }
          onCloseDetail={() => setSelectedRunId(null)}
        />
      </div>

      <BackupOptionsModal
        isOpen={optionsOpen}
        stackname={stackname}
        isStarting={isStarting}
        onClose={() => setOptionsOpen(false)}
        onConfirm={startBackup}
      />
      {selectedRun && (
        <RestoreBackupModal
          isOpen={restoreOpen}
          run={selectedRun}
          stackname={stackname}
          isStarting={isStarting}
          onClose={() => setRestoreOpen(false)}
          onConfirm={startRestore}
        />
      )}
      {selectedRun && (
        <ConfirmationModal
          isOpen={deleteOpen}
          onClose={() => setDeleteOpen(false)}
          onConfirm={() => deleteMutation.mutate({ serverid, stackname, backupid: selectedRun.id })}
          title="Delete backup"
          message={`Delete the backup of ${stackname} from ${formatDate(selectedRun.started_at)}? Its snapshots are removed from the repository and cannot be restored afterwards.`}
          confirmText="Delete backup"
          variant="danger"
          isLoading={deleteMutation.isPending}
        />
      )}
    </div>
  );
}
