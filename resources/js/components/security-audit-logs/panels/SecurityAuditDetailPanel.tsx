import { XMarkIcon } from '@heroicons/react/24/outline';
import { cn } from '../../../utils/cn';
import { theme } from '../../../theme';
import type { GetApiV1AdminSecurityAuditLogs200DataLogsItem } from '../../../api/generated/models';
import { getSeverityBadgeStyle, getCategoryBadgeStyle } from '../../../utils/securityAuditHelpers';

interface SecurityAuditDetailPanelProps {
  log: GetApiV1AdminSecurityAuditLogs200DataLogsItem | null;
  isLoading: boolean;
  onClose: () => void;
}

const DetailRow: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
  <div className="py-2">
    <dt className={cn('text-xs font-medium uppercase tracking-wider', theme.text.muted)}>
      {label}
    </dt>
    <dd className={cn('mt-1 text-sm', theme.text.standard)}>{children}</dd>
  </div>
);

export const SecurityAuditDetailPanel: React.FC<SecurityAuditDetailPanelProps> = ({
  log,
  isLoading,
  onClose,
}) => {
  return (
    <div className="h-full flex flex-col bg-white dark:bg-zinc-900">
      {/* Header */}
      <div
        className={cn(
          'flex-shrink-0 flex items-center justify-between px-4 py-3',
          'border-b border-zinc-200 dark:border-zinc-700',
          'bg-zinc-50 dark:bg-zinc-800/50'
        )}
      >
        <h3 className={cn('text-sm font-semibold', theme.text.strong)}>Event Details</h3>
        <button
          onClick={onClose}
          className={cn(
            'p-1 rounded hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors',
            theme.text.muted
          )}
        >
          <XMarkIcon className="h-5 w-5" />
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-4">
        {isLoading ? (
          <div className="flex items-center justify-center h-full">
            <div className="animate-pulse flex flex-col items-center gap-2">
              <div className="h-8 w-8 rounded-full bg-zinc-200 dark:bg-zinc-700" />
              <div className="h-4 w-32 rounded bg-zinc-200 dark:bg-zinc-700" />
            </div>
          </div>
        ) : log ? (
          <dl className="divide-y divide-zinc-200 dark:divide-zinc-700">
            <DetailRow label="Event Type">
              <span className="font-medium">{log.event_type}</span>
            </DetailRow>

            <DetailRow label="Category">
              <span
                className={cn(
                  'px-2 py-1 text-xs font-medium rounded',
                  getCategoryBadgeStyle(log.event_category)
                )}
              >
                {log.event_category}
              </span>
            </DetailRow>

            <DetailRow label="Severity">
              <span
                className={cn(
                  'px-2 py-1 text-xs font-medium rounded',
                  getSeverityBadgeStyle(log.severity)
                )}
              >
                {log.severity}
              </span>
            </DetailRow>

            <DetailRow label="Status">
              {log.success ? (
                <span className={cn(theme.badges.tag.base, theme.badges.tag.success)}>Success</span>
              ) : (
                <span className={cn(theme.badges.tag.base, theme.badges.tag.danger)}>Failed</span>
              )}
            </DetailRow>

            <DetailRow label="Actor">
              <div className="space-y-1">
                <div>{log.actor_username || '-'}</div>
                {log.actor_ip && (
                  <div className={cn('text-xs font-mono', theme.text.muted)}>{log.actor_ip}</div>
                )}
              </div>
            </DetailRow>

            <DetailRow label="Target">
              <div className="space-y-1">
                <div>{log.target_name || '-'}</div>
                {log.target_type && (
                  <div className={cn('text-xs', theme.text.muted)}>Type: {log.target_type}</div>
                )}
              </div>
            </DetailRow>

            <DetailRow label="Timestamp">{new Date(log.created_at).toLocaleString()}</DetailRow>

            {log.failure_reason && (
              <DetailRow label="Failure Reason">
                <span className={theme.text.danger}>{log.failure_reason}</span>
              </DetailRow>
            )}

            {log.metadata && log.metadata !== '{}' && (
              <DetailRow label="Metadata">
                <pre
                  className={cn(
                    'text-xs p-3 rounded overflow-x-auto',
                    theme.surface.code,
                    theme.text.standard
                  )}
                >
                  {(() => {
                    try {
                      return JSON.stringify(JSON.parse(log.metadata), null, 2);
                    } catch {
                      return log.metadata;
                    }
                  })()}
                </pre>
              </DetailRow>
            )}

            {log.actor_user_agent && (
              <DetailRow label="User Agent">
                <span className={cn('text-xs font-mono break-all', theme.text.muted)}>
                  {log.actor_user_agent}
                </span>
              </DetailRow>
            )}

            {log.session_id && (
              <DetailRow label="Session ID">
                <span className={cn('text-xs font-mono', theme.text.muted)}>{log.session_id}</span>
              </DetailRow>
            )}
          </dl>
        ) : (
          <div className="flex items-center justify-center h-full">
            <p className={theme.text.muted}>Select an event to view details</p>
          </div>
        )}
      </div>
    </div>
  );
};
