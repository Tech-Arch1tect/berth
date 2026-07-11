import { useMemo, useState } from 'react';
import { ArchiveBoxIcon, ArrowPathIcon } from '@heroicons/react/24/outline';
import { useGetApiV1ServersServeridStacksStacknameBackups } from '../../../api/generated/backups/backups';
import type { Run } from '../../../api/generated/models';
import { useOperations } from '../../operations/hooks/useOperations';
import { RecordList, RecordListColumn } from '../../../shared/components/RecordList';
import { EmptyState } from '../../../shared/components/EmptyState';
import { cn } from '../../../shared/utils/cn';
import { theme } from '../../../shared/theme';
import { formatBytes, formatRelativeTime } from '../../../shared/utils/formatters';
import {
  buildCreateBackupOptions,
  buildRestoreOptions,
  runBytesAdded,
  runHasComponentErrors,
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
  const [isStarting, setIsStarting] = useState(false);
  const [startError, setStartError] = useState<string | null>(null);

  const backupsQuery = useGetApiV1ServersServeridStacksStacknameBackups(serverid, stackname);
  const listing = backupsQuery.data?.data;
  const runs = useMemo(() => listing?.runs ?? [], [listing]);

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

  const columns: RecordListColumn<Run>[] = [
    {
      key: 'status',
      header: 'Status',
      render: (run) => (
        <div>
          <BackupStatusBadge status={run.status} />
          {runHasComponentErrors(run) && run.status === 'completed' && (
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
        <span className={cn('text-sm', theme.text.standard)}>{run.components.length}</span>
      ),
    },
    {
      key: 'added',
      header: 'Data added',
      render: (run) => (
        <span className={cn('text-sm', theme.text.muted)}>{formatBytes(runBytesAdded(run))}</span>
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

  const selectedRun = runs.find((run) => run.id === selectedRunId) ?? null;
  const pagedRuns = runs.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

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
        <RecordList<Run>
          records={pagedRuns}
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
                {run.components.length} {run.components.length === 1 ? 'component' : 'components'} ·{' '}
                {formatBytes(runBytesAdded(run))} added
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
          totalCount={runs.length}
          onPageChange={setPage}
          detail={
            selectedRun ? (
              <BackupRunDetail
                run={selectedRun}
                canRestore={canRestore}
                isOperationRunning={backupOperationRunning}
                onRestore={() => setRestoreOpen(true)}
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
    </div>
  );
}
