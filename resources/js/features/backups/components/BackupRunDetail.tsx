import type { Run } from '../../../api/generated/models';
import { cn } from '../../../shared/utils/cn';
import { theme } from '../../../shared/theme';
import { formatBytes, formatDate, formatDuration } from '../../../shared/utils/formatters';
import { describeComponent, describeStopMode } from '../utils';
import { BackupStatusBadge } from './BackupStatusBadge';

interface BackupRunDetailProps {
  run: Run;
  canRestore: boolean;
  canManage: boolean;
  isOperationRunning: boolean;
  onRestore: () => void;
  onDelete: () => void;
}

export function BackupRunDetail({
  run,
  canRestore,
  canManage,
  isOperationRunning,
  onRestore,
  onDelete,
}: BackupRunDetailProps) {
  const hasRestorableComponents = run.components.some((component) => !!component.snapshot_id);
  return (
    <div className="space-y-4 p-4">
      <div className="space-y-1">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <BackupStatusBadge status={run.status} />
            <span className={cn('text-xs font-mono', theme.text.subtle)}>{run.id.slice(0, 8)}</span>
          </div>
          <div className="flex items-center gap-2">
            {canRestore && hasRestorableComponents && (
              <button
                type="button"
                onClick={onRestore}
                disabled={isOperationRunning}
                className={cn(
                  'px-3 py-2 rounded-lg text-sm font-medium min-h-[44px]',
                  'border border-red-300 dark:border-red-800',
                  'text-red-700 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950',
                  'disabled:opacity-50'
                )}
              >
                Restore…
              </button>
            )}
            {canManage && (
              <button
                type="button"
                onClick={onDelete}
                disabled={isOperationRunning}
                className={cn(
                  'px-3 py-2 rounded-lg text-sm font-medium min-h-[44px]',
                  'border border-zinc-200 dark:border-zinc-700',
                  theme.text.muted,
                  'hover:bg-zinc-50 dark:hover:bg-zinc-800 disabled:opacity-50'
                )}
              >
                Delete…
              </button>
            )}
          </div>
        </div>
        <p className={cn('text-sm', theme.text.muted)}>
          Started {formatDate(run.started_at)}
          {run.finished_at ? `, finished ${formatDate(run.finished_at)}` : ''}
        </p>
        <p className={cn('text-sm', theme.text.muted)}>{describeStopMode(run.stop_mode)}</p>
        {run.verified === true && (
          <p className={cn('text-sm', 'text-emerald-700 dark:text-emerald-400')}>
            Repository integrity verified after this backup
          </p>
        )}
        {run.verified === false && (
          <p className="text-sm text-red-700 dark:text-red-400">
            Repository integrity check failed after this backup
            {run.verify_error ? `: ${run.verify_error}` : ''}
          </p>
        )}
        {run.restic_version && (
          <p className={cn('text-xs', theme.text.subtle)}>{run.restic_version}</p>
        )}
      </div>

      {run.error && (
        <div
          className={cn(
            'rounded-lg border border-red-300 dark:border-red-800 p-3 text-sm',
            'text-red-700 dark:text-red-300'
          )}
        >
          {run.error}
        </div>
      )}

      <div>
        <h4 className={cn('text-sm font-medium mb-2', theme.text.strong)}>
          Components ({run.components.length})
        </h4>
        <ul className="space-y-2">
          {run.components.map((component) => {
            const { label, detail } = describeComponent(component);
            return (
              <li
                key={component.id}
                className={cn('rounded-lg border p-3', 'border-zinc-200 dark:border-zinc-700')}
              >
                <div className="flex items-baseline justify-between gap-2">
                  <span className={cn('text-sm font-medium', theme.text.strong)}>{label}</span>
                  {component.snapshot_id && (
                    <span className={cn('text-xs font-mono', theme.text.subtle)}>
                      {component.snapshot_id.slice(0, 8)}
                    </span>
                  )}
                </div>
                {detail && (
                  <p className={cn('text-xs font-mono break-all mt-0.5', theme.text.muted)}>
                    {detail}
                  </p>
                )}
                {component.error ? (
                  <p className="text-xs mt-1 text-red-600 dark:text-red-400">{component.error}</p>
                ) : (
                  <p className={cn('text-xs mt-1', theme.text.muted)}>
                    {formatBytes(component.bytes_added)} added · {component.files_new} new /{' '}
                    {component.files_changed} changed / {component.files_unmodified} unchanged files
                    · {formatDuration(Math.round(component.duration_secs * 10) / 10)}
                  </p>
                )}
              </li>
            );
          })}
        </ul>
      </div>

      {run.skipped && run.skipped.length > 0 && (
        <div>
          <h4 className={cn('text-sm font-medium mb-2', theme.text.strong)}>
            Not backed up ({run.skipped.length})
          </h4>
          <ul className="space-y-2">
            {run.skipped.map((skip, index) => (
              <li
                key={`${skip.kind}-${skip.target ?? ''}-${index}`}
                className={cn('rounded-lg border p-3', 'border-zinc-200 dark:border-zinc-700')}
              >
                <span className={cn('block text-sm', theme.text.standard)}>
                  {skip.kind}
                  {skip.target ? ` at ${skip.target}` : ''}
                  {skip.service ? ` (${skip.service})` : ''}
                </span>
                <span className={cn('block text-xs mt-0.5', theme.text.muted)}>{skip.reason}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
