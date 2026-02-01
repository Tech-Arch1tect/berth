import { cn } from '../../utils/cn';
import { theme } from '../../theme';
import { Modal } from '../common/Modal';
import type { SecurityAuditLogInfo } from '../../api/generated/models';
import { getSeverityBadgeStyle, getCategoryBadgeStyle } from '../../utils/securityAuditHelpers';

interface Props {
  log: SecurityAuditLogInfo | null;
  isOpen: boolean;
  onClose: () => void;
}

export function SecurityAuditLogDetailsModal({ log, isOpen, onClose }: Props) {
  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Event Details" size="lg">
      {log && (
        <div className="grid grid-cols-2 gap-4">
          <div>
            <div className={cn('text-sm font-medium', theme.text.subtle)}>Event Type</div>
            <div className={cn('mt-1 text-sm', theme.text.standard)}>{log.event_type}</div>
          </div>

          <div>
            <div className={cn('text-sm font-medium', theme.text.subtle)}>Category</div>
            <div className="mt-1">
              <span
                className={cn(
                  'px-2 py-1 text-xs font-medium rounded',
                  getCategoryBadgeStyle(log.event_category)
                )}
              >
                {log.event_category}
              </span>
            </div>
          </div>

          <div>
            <div className={cn('text-sm font-medium', theme.text.subtle)}>Severity</div>
            <div className="mt-1">
              <span
                className={cn(
                  'px-2 py-1 text-xs font-medium rounded',
                  getSeverityBadgeStyle(log.severity)
                )}
              >
                {log.severity}
              </span>
            </div>
          </div>

          <div>
            <div className={cn('text-sm font-medium', theme.text.subtle)}>Status</div>
            <div className="mt-1">
              {log.success ? (
                <span className={cn(theme.badges.tag.base, theme.badges.tag.success)}>Success</span>
              ) : (
                <span className={cn(theme.badges.tag.base, theme.badges.tag.danger)}>Failed</span>
              )}
            </div>
          </div>

          <div>
            <div className={cn('text-sm font-medium', theme.text.subtle)}>Actor</div>
            <div className={cn('mt-1 text-sm', theme.text.standard)}>
              {log.actor_username || '-'}
            </div>
          </div>

          <div>
            <div className={cn('text-sm font-medium', theme.text.subtle)}>Actor IP</div>
            <div className={cn('mt-1 text-sm', theme.text.standard)}>{log.actor_ip}</div>
          </div>

          <div>
            <div className={cn('text-sm font-medium', theme.text.subtle)}>Target</div>
            <div className={cn('mt-1 text-sm', theme.text.standard)}>{log.target_name || '-'}</div>
          </div>

          <div>
            <div className={cn('text-sm font-medium', theme.text.subtle)}>Target Type</div>
            <div className={cn('mt-1 text-sm', theme.text.standard)}>{log.target_type || '-'}</div>
          </div>

          <div className="col-span-2">
            <div className={cn('text-sm font-medium', theme.text.subtle)}>Timestamp</div>
            <div className={cn('mt-1 text-sm', theme.text.standard)}>
              {new Date(log.created_at).toLocaleString()}
            </div>
          </div>

          {log.failure_reason && (
            <div className="col-span-2">
              <div className={cn('text-sm font-medium', theme.text.subtle)}>Failure Reason</div>
              <div className={cn('mt-1 text-sm', theme.text.danger)}>{log.failure_reason}</div>
            </div>
          )}

          {log.metadata && log.metadata !== '{}' && (
            <div className="col-span-2">
              <div className={cn('text-sm font-medium', theme.text.subtle)}>Metadata</div>
              <pre
                className={cn(
                  'mt-1 text-xs p-3 rounded overflow-x-auto',
                  theme.surface.code,
                  theme.text.standard
                )}
              >
                {JSON.stringify(JSON.parse(log.metadata), null, 2)}
              </pre>
            </div>
          )}
        </div>
      )}
    </Modal>
  );
}
