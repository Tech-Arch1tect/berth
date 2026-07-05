import type { OperationLogInfo } from '../../api/generated/models';

export function formatOperationDuration(durationMs: number | null | undefined, partial = false) {
  if (durationMs === null || durationMs === undefined || durationMs === 0) return 'N/A';
  if (durationMs < 0) return 'N/A';

  let formatted: string;
  if (durationMs < 1000) formatted = `${durationMs}ms`;
  else if (durationMs < 60_000) formatted = `${(durationMs / 1000).toFixed(1)}s`;
  else if (durationMs < 3_600_000) formatted = `${(durationMs / 60_000).toFixed(1)}m`;
  else if (durationMs < 86_400_000) formatted = `${(durationMs / 3_600_000).toFixed(1)}h`;
  else {
    const days = Math.floor(durationMs / 86_400_000);
    const hours = Math.round((durationMs % 86_400_000) / 3_600_000);
    formatted = hours > 0 ? `${days}d ${hours}h` : `${days}d`;
  }

  return partial ? `~${formatted}` : formatted;
}

export function operationDuration(log: OperationLogInfo) {
  if (log.duration_ms !== null && log.duration_ms !== undefined) {
    return formatOperationDuration(log.duration_ms);
  }
  if (log.partial_duration_ms !== null && log.partial_duration_ms !== undefined) {
    return formatOperationDuration(log.partial_duration_ms, true);
  }
  return 'N/A';
}
