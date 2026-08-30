import { useEffect, useRef, useState } from 'react';
import { useQueryClient, type Query } from '@tanstack/react-query';
import type {
  AbandonBackupStorageResult,
  BucketResponse,
  DeleteAllResult,
  HistoryState,
  ServerInfo,
} from '../../../../api/generated/models';
import {
  getGetApiV1AdminServersIdBackupStorageQueryKey,
  getGetApiV1BackupsQueryKey,
  getGetApiV1ServersServeridStacksStacknameBackupsQueryKey,
  useGetApiV1AdminServersIdBackupStorage,
  usePostApiV1AdminServersIdBackupStorageAbandon,
  usePostApiV1AdminServersIdBackupStorageDeleteAll,
} from '../../../../api/generated/backups/backups';
import {
  getGetApiV1AdminServersIdQueryKey,
  getGetApiV1AdminServersQueryKey,
} from '../../../../api/generated/admin/admin';
import { ConfirmationModal } from '../../../../shared/components/ConfirmationModal';
import { Modal } from '../../../../shared/components/Modal';
import { messageFromApiError } from '../../../../shared/utils/api-errors';
import { cn } from '../../../../shared/utils/cn';
import { theme } from '../../../../shared/theme';

interface BackupStorageLifecycleSectionProps {
  active: boolean;
  buckets: BucketResponse[];
  onAssignmentChange: (bucketId: number | null) => void;
  onAssignmentChangeAllowed: (allowed: boolean) => void;
  selectedBucketId: number | null;
  server: ServerInfo;
}

type LifecycleAction = 'delete' | 'abandon';

interface LifecycleConfirmation {
  action: LifecycleAction;
  status: HistoryState;
}

interface LifecycleResult {
  action: LifecycleAction;
  result: DeleteAllResult | AbandonBackupStorageResult;
}

function countText(value: number, singular: string, plural: string) {
  return `${value} ${value === 1 ? singular : plural}`;
}

function historyReason(
  active: boolean,
  status: HistoryState | null,
  statusUnavailable: boolean,
  initialLoading: boolean,
  refreshing: boolean,
  mutating: boolean
) {
  if (!active) return 'Backup history is checked only while this server is being edited.';
  if (mutating) return 'Backup storage cannot change while a lifecycle action is in progress.';
  if (refreshing) return 'Backup storage cannot change while backup history is refreshed.';
  if (initialLoading) return 'Backup storage cannot change until backup history is checked.';
  if (statusUnavailable || !status) {
    return 'Backup storage cannot change because backup history is unavailable.';
  }
  if (!status.empty) {
    return `Backup storage cannot change while ${countText(status.record_count, 'backup record', 'backup records')} remain across ${countText(status.stack_count, 'stack', 'stacks')}.`;
  }
  return null;
}

function HistoryCounts({ status }: { status: HistoryState }) {
  const counts = [
    { label: 'Backup records', value: status.record_count },
    { label: 'Stacks', value: status.stack_count },
    ...(status.unreadable_record_count > 0
      ? [{ label: 'Unreadable records', value: status.unreadable_record_count }]
      : []),
  ];

  return (
    <dl className="grid grid-cols-2 gap-2 sm:grid-cols-3">
      {counts.map((count) => (
        <div key={count.label} className={cn('rounded-lg border px-3 py-2', theme.surface.muted)}>
          <dd className={cn('text-lg font-semibold tabular-nums', theme.text.strong)}>
            {count.value}
          </dd>
          <dt className={cn('text-xs', theme.text.muted)}>{count.label}</dt>
        </div>
      ))}
    </dl>
  );
}

function ResultCounts({ result }: { result: DeleteAllResult | AbandonBackupStorageResult }) {
  const cleared = result.before.record_count - result.after.record_count;
  const counts = [
    `${result.before.record_count} before`,
    `${cleared} cleared`,
    `${result.after.record_count} remaining`,
    `${countText(result.before.stack_count, 'stack', 'stacks')} before`,
    `${countText(result.after.stack_count, 'stack', 'stacks')} remaining`,
  ];

  if (result.before.unreadable_record_count > 0) {
    counts.push(`${result.before.unreadable_record_count} unreadable before`);
  }
  if (result.after.unreadable_record_count > 0) {
    counts.push(`${result.after.unreadable_record_count} unreadable remaining`);
  }

  return (
    <ul className="flex flex-wrap gap-2">
      {counts.map((count) => (
        <li
          key={count}
          className={cn(
            'rounded-md border px-2.5 py-1.5 text-sm tabular-nums',
            theme.surface.muted,
            theme.text.standard
          )}
        >
          {count}
        </li>
      ))}
    </ul>
  );
}

function Errors({ errors }: { errors: string[] }) {
  if (errors.length === 0) return null;

  return (
    <ul className={cn('space-y-1 text-sm', theme.text.danger)}>
      {errors.map((error, index) => (
        <li key={`${index}-${error}`}>{error}</li>
      ))}
    </ul>
  );
}

function DeleteAllResultContent({ result }: { result: DeleteAllResult }) {
  return (
    <div className="space-y-4">
      <p
        className={cn(
          'text-sm font-medium',
          result.complete ? theme.text.success : theme.text.warning
        )}
      >
        {result.complete ? 'Complete' : 'Partial completion'}
      </p>
      <ResultCounts result={result} />
      <Errors errors={result.errors} />
      <div className="space-y-3">
        {result.stacks.map((stack, index) => (
          <section key={`${stack.stack_name}-${index}`} className={theme.containers.inset}>
            <h4 className={cn('font-medium', theme.text.strong)}>{stack.stack_name}</h4>
            <dl className="mt-2 grid grid-cols-1 gap-x-4 gap-y-1 text-sm sm:grid-cols-2">
              <div className="flex justify-between gap-3">
                <dt className={theme.text.muted}>Attempted: </dt>
                <dd className={theme.text.standard}>{stack.attempted ? 'Yes' : 'No'}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className={theme.text.muted}>Records before: </dt>
                <dd className={cn('tabular-nums', theme.text.standard)}>{stack.records_before}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className={theme.text.muted}>Records deleted: </dt>
                <dd className={cn('tabular-nums', theme.text.standard)}>{stack.records_deleted}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className={theme.text.muted}>Records remaining: </dt>
                <dd className={cn('tabular-nums', theme.text.standard)}>
                  {stack.records_remaining}
                </dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className={theme.text.muted}>Snapshots forgotten: </dt>
                <dd className={cn('tabular-nums', theme.text.standard)}>
                  {stack.snapshots_forgotten}
                </dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className={theme.text.muted}>Prune status: </dt>
                <dd className={theme.text.standard}>{stack.prune_status}</dd>
              </div>
            </dl>
            <div className="mt-2">
              <Errors errors={stack.errors} />
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}

function AbandonResultContent({ result }: { result: AbandonBackupStorageResult }) {
  return (
    <div className="space-y-4">
      <p
        className={cn(
          'text-sm font-medium',
          result.complete ? theme.text.success : theme.text.warning
        )}
      >
        {result.complete ? 'Complete' : 'Partial completion'}
      </p>
      <ResultCounts result={result} />
      <Errors errors={result.errors} />
    </div>
  );
}

export function BackupStorageLifecycleSection({
  active,
  buckets,
  onAssignmentChange,
  onAssignmentChangeAllowed,
  selectedBucketId,
  server,
}: BackupStorageLifecycleSectionProps) {
  const queryClient = useQueryClient();
  const sessionRef = useRef(0);
  const mutationInFlightRef = useRef<LifecycleAction | null>(null);
  const [statusInvalidated, setStatusInvalidated] = useState(false);
  const [preAction, setPreAction] = useState<LifecycleAction | null>(null);
  const [confirmation, setConfirmation] = useState<LifecycleConfirmation | null>(null);
  const [resultModal, setResultModal] = useState<LifecycleResult | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const statusQuery = useGetApiV1AdminServersIdBackupStorage(server.id, {
    query: { enabled: active },
  });
  const deleteAllMutation = usePostApiV1AdminServersIdBackupStorageDeleteAll();
  const abandonMutation = usePostApiV1AdminServersIdBackupStorageAbandon();

  const currentStatus = statusInvalidated ? null : (statusQuery.data?.data ?? null);
  const mutating = deleteAllMutation.isPending || abandonMutation.isPending;
  const refreshing = statusQuery.isFetching || preAction !== null;
  const statusUnavailable = statusInvalidated || Boolean(statusQuery.error);
  const assignmentChangeAllowed = Boolean(
    active &&
    currentStatus?.empty &&
    !statusUnavailable &&
    !statusQuery.isLoading &&
    !refreshing &&
    !mutating
  );
  const disableReason = historyReason(
    active,
    currentStatus,
    statusUnavailable,
    statusQuery.isLoading,
    refreshing,
    mutating
  );
  const controlsDisabled = refreshing || mutating || statusUnavailable;

  useEffect(() => {
    const session = sessionRef.current + 1;
    sessionRef.current = session;
    mutationInFlightRef.current = null;
    return () => {
      if (sessionRef.current === session) {
        sessionRef.current += 1;
        mutationInFlightRef.current = null;
      }
    };
  }, [active, server.id]);

  useEffect(() => {
    onAssignmentChangeAllowed(assignmentChangeAllowed);
  }, [assignmentChangeAllowed, onAssignmentChangeAllowed]);

  const sessionIsCurrent = (session: number) => active && sessionRef.current === session;

  const statusError = statusQuery.error
    ? messageFromApiError(statusQuery.error, 'Failed to read backup storage status')
    : null;

  const refreshBeforeAction = async (action: LifecycleAction) => {
    const session = sessionRef.current;
    setActionError(null);
    setConfirmation(null);
    setPreAction(action);
    try {
      const refreshed = await statusQuery.refetch();
      if (!sessionIsCurrent(session)) return;
      if (refreshed.error || !refreshed.data) {
        const error = refreshed.error ?? new Error('Backup storage status response was empty');
        setStatusInvalidated(true);
        setActionError(messageFromApiError(error, 'Failed to refresh backup storage status'));
        return;
      }
      const status = refreshed.data.data;
      setStatusInvalidated(false);
      if (status.empty) {
        setConfirmation(null);
        return;
      }
      setConfirmation({ action, status });
    } catch (error) {
      if (!sessionIsCurrent(session)) return;
      setStatusInvalidated(true);
      setActionError(messageFromApiError(error, 'Failed to refresh backup storage status'));
    } finally {
      if (sessionIsCurrent(session)) setPreAction(null);
    }
  };

  const invalidateSharedQueries = () => {
    queryClient.invalidateQueries({ queryKey: getGetApiV1AdminServersQueryKey() });
    queryClient.invalidateQueries({ queryKey: getGetApiV1AdminServersIdQueryKey(server.id) });
    queryClient.invalidateQueries({ queryKey: getGetApiV1BackupsQueryKey() });
    queryClient.invalidateQueries({
      queryKey: getGetApiV1AdminServersIdBackupStorageQueryKey(server.id),
    });
  };

  const runDeleteAll = async () => {
    if (mutationInFlightRef.current !== null) return;
    const session = sessionRef.current;
    mutationInFlightRef.current = 'delete';
    setActionError(null);
    try {
      const response = await deleteAllMutation.mutateAsync({ id: server.id });
      invalidateSharedQueries();
      for (const stackName of new Set(response.data.stacks.map((stack) => stack.stack_name))) {
        queryClient.invalidateQueries({
          queryKey: getGetApiV1ServersServeridStacksStacknameBackupsQueryKey(server.id, stackName),
        });
      }
      if (!sessionIsCurrent(session)) return;
      setStatusInvalidated(false);
      setResultModal({ action: 'delete', result: response.data });
    } catch (error) {
      if (!sessionIsCurrent(session)) return;
      setStatusInvalidated(true);
      setActionError(messageFromApiError(error, 'Failed to delete all backups'));
    } finally {
      if (sessionIsCurrent(session)) {
        mutationInFlightRef.current = null;
        setConfirmation(null);
      }
    }
  };

  const runAbandon = async () => {
    if (mutationInFlightRef.current !== null) return;
    const session = sessionRef.current;
    mutationInFlightRef.current = 'abandon';
    setActionError(null);
    try {
      const response = await abandonMutation.mutateAsync({ id: server.id });
      invalidateSharedQueries();
      const serverStackPrefix = `/api/v1/servers/${server.id}/stacks/`;
      queryClient.invalidateQueries({
        predicate: (query: Query) => {
          const firstKey = query.queryKey[0];
          return (
            typeof firstKey === 'string' &&
            firstKey.startsWith(serverStackPrefix) &&
            firstKey.endsWith('/backups')
          );
        },
      });
      if (!sessionIsCurrent(session)) return;
      setStatusInvalidated(false);
      setResultModal({ action: 'abandon', result: response.data });
    } catch (error) {
      if (!sessionIsCurrent(session)) return;
      setStatusInvalidated(true);
      setActionError(messageFromApiError(error, 'Failed to abandon backup storage'));
    } finally {
      if (sessionIsCurrent(session)) {
        mutationInFlightRef.current = null;
        setConfirmation(null);
      }
    }
  };

  const deleteConfirmationMessage =
    confirmation?.action === 'delete'
      ? `Delete all backups for ${server.name}? The refreshed status contains ${countText(confirmation.status.record_count, 'backup record', 'backup records')} across ${countText(confirmation.status.stack_count, 'stack', 'stacks')}. Every represented stack repository is attempted. Successful deletions remain deleted if another stack fails. Successful stacks remove repository snapshots and corresponding agent-local history. Partial completion is possible.`
      : '';
  const abandonConfirmationMessage =
    confirmation?.action === 'abandon'
      ? `Abandon backup storage for ${server.name}? The refreshed status contains ${countText(confirmation.status.record_count, 'backup record', 'backup records')} across ${countText(confirmation.status.stack_count, 'stack', 'stacks')}. Only agent-local backup history is removed. Repository data is not deleted, opened, or verified. Partial removal is possible.`
      : '';

  return (
    <section className={cn('space-y-3', theme.containers.inset)}>
      <div>
        <h3 className={cn('text-base font-medium', theme.text.strong)}>Backup storage lifecycle</h3>
        <p className={cn('mt-1 text-sm', theme.text.muted)}>
          Storage assignment can change only after the agent reports that its backup history is
          empty.
        </p>
      </div>

      {(statusError || actionError) && (
        <div
          role="alert"
          className={cn(
            'rounded-md border p-3 text-sm',
            theme.intent.danger.surface,
            theme.intent.danger.border,
            theme.intent.danger.textStrong
          )}
        >
          {actionError ?? statusError}
        </div>
      )}

      {currentStatus && <HistoryCounts status={currentStatus} />}

      <div>
        <label htmlFor="server-s3-bucket" className={theme.forms.label}>
          Backup storage
        </label>
        <select
          id="server-s3-bucket"
          aria-label={`Backup storage for ${server.name}`}
          aria-describedby={disableReason ? 'server-s3-bucket-disabled-reason' : undefined}
          value={selectedBucketId ?? ''}
          disabled={!assignmentChangeAllowed}
          onChange={(event) =>
            onAssignmentChange(event.target.value === '' ? null : Number(event.target.value))
          }
          className={cn('mt-1 min-h-[44px]', theme.forms.input)}
        >
          <option value="">On the agent (local disk)</option>
          {buckets.map((bucket) => (
            <option key={bucket.id} value={bucket.id}>
              {bucket.label} ({bucket.bucket_name} at {bucket.endpoint})
            </option>
          ))}
        </select>
        {disableReason && (
          <p id="server-s3-bucket-disabled-reason" className={cn('mt-2 text-sm', theme.text.muted)}>
            {disableReason}
          </p>
        )}
        <p className={cn('mt-2 text-sm', theme.text.subtle)}>
          Assigned buckets hold this server&apos;s backup repositories under servers/{server.id} in
          the bucket; each stack gets its own repository.
        </p>
      </div>

      {currentStatus && !currentStatus.empty && (
        <div className="flex flex-col gap-2 sm:flex-row">
          <button
            type="button"
            onClick={() => refreshBeforeAction('delete')}
            disabled={controlsDisabled}
            aria-label={`Delete all backups for ${server.name}`}
            className={cn(
              'min-h-[44px] flex-1 disabled:cursor-not-allowed disabled:opacity-50',
              theme.buttons.danger
            )}
          >
            Delete all backups
          </button>
          <button
            type="button"
            onClick={() => refreshBeforeAction('abandon')}
            disabled={controlsDisabled}
            aria-label={`Abandon backup storage for ${server.name}`}
            className={cn(
              'min-h-[44px] flex-1 disabled:cursor-not-allowed disabled:opacity-50',
              theme.buttons.secondary
            )}
          >
            Abandon backup storage
          </button>
        </div>
      )}

      <ConfirmationModal
        isOpen={confirmation?.action === 'delete'}
        onClose={() => setConfirmation(null)}
        onConfirm={runDeleteAll}
        title="Delete all backups"
        message={deleteConfirmationMessage}
        confirmText="Delete all backups"
        variant="danger"
        isLoading={deleteAllMutation.isPending}
      />
      <ConfirmationModal
        isOpen={confirmation?.action === 'abandon'}
        onClose={() => setConfirmation(null)}
        onConfirm={runAbandon}
        title="Abandon backup storage"
        message={abandonConfirmationMessage}
        confirmText="Abandon backup storage"
        variant="danger"
        isLoading={abandonMutation.isPending}
      />

      <Modal
        isOpen={resultModal?.action === 'delete'}
        onClose={() => setResultModal(null)}
        title="Delete all backups result"
        size="lg"
        closeOnOverlayClick={false}
        footer={
          <div className="flex justify-end">
            <button
              type="button"
              onClick={() => setResultModal(null)}
              aria-label="Close delete all result"
              className={theme.buttons.primary}
            >
              Close
            </button>
          </div>
        }
      >
        <div role="dialog" aria-label="Delete all backups result">
          {resultModal?.action === 'delete' && (
            <DeleteAllResultContent result={resultModal.result as DeleteAllResult} />
          )}
        </div>
      </Modal>

      <Modal
        isOpen={resultModal?.action === 'abandon'}
        onClose={() => setResultModal(null)}
        title="Abandon backup storage result"
        size="md"
        closeOnOverlayClick={false}
        footer={
          <div className="flex justify-end">
            <button
              type="button"
              onClick={() => setResultModal(null)}
              aria-label="Close abandon result"
              className={theme.buttons.primary}
            >
              Close
            </button>
          </div>
        }
      >
        <div role="dialog" aria-label="Abandon backup storage result">
          {resultModal?.action === 'abandon' && (
            <AbandonResultContent result={resultModal.result as AbandonBackupStorageResult} />
          )}
        </div>
      </Modal>
    </section>
  );
}
