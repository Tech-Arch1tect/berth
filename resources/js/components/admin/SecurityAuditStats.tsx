import { cn } from '../../utils/cn';
import { theme } from '../../theme';
import type { SecurityAuditStats } from '../../hooks/useSecurityAuditLogs';

interface Props {
  stats: SecurityAuditStats | null;
}

export function SecurityAuditStats({ stats }: Props) {
  if (!stats) {
    return null;
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
      <div
        className={cn(
          theme.surface.panel,
          'p-4 rounded-lg shadow border border-slate-200 dark:border-slate-700'
        )}
      >
        <div className={cn('text-sm font-medium', theme.text.muted)}>Total Events</div>
        <div className={cn('mt-1 text-2xl font-semibold', theme.text.strong)}>
          {stats.total_events.toLocaleString()}
        </div>
      </div>

      <div
        className={cn(
          theme.surface.panel,
          'p-4 rounded-lg shadow border border-slate-200 dark:border-slate-700'
        )}
      >
        <div className={cn('text-sm font-medium', theme.text.muted)}>Failed Events</div>
        <div className={cn('mt-1 text-2xl font-semibold', theme.text.danger)}>
          {stats.failed_events.toLocaleString()}
        </div>
      </div>

      <div
        className={cn(
          theme.surface.panel,
          'p-4 rounded-lg shadow border border-slate-200 dark:border-slate-700'
        )}
      >
        <div className={cn('text-sm font-medium', theme.text.muted)}>Last 24 Hours</div>
        <div className={cn('mt-1 text-2xl font-semibold', theme.text.info)}>
          {stats.events_last_24_hours.toLocaleString()}
        </div>
      </div>

      <div
        className={cn(
          theme.surface.panel,
          'p-4 rounded-lg shadow border border-slate-200 dark:border-slate-700'
        )}
      >
        <div className={cn('text-sm font-medium', theme.text.muted)}>Last 7 Days</div>
        <div className={cn('mt-1 text-2xl font-semibold', theme.text.success)}>
          {stats.events_last_7_days.toLocaleString()}
        </div>
      </div>
    </div>
  );
}
