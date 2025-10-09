import { XMarkIcon } from '@heroicons/react/24/outline';
import React from 'react';
import { OperationLog, OperationLogDetail, OperationLogMessage } from '../../types/operations';
import { theme } from '../../theme';
import { cn } from '../../utils/cn';

interface OperationLogModalProps {
  selectedLog: OperationLogDetail | null;
  showDetails: boolean;
  showUser?: boolean;
  onClose: () => void;
  getStatusBadge: (log: OperationLog) => React.ReactElement;
  getOperationDuration: (log: OperationLog) => string;
}

const toPrettyJson = (payload: string) => {
  if (!payload) return '';
  try {
    const parsed = JSON.parse(payload);
    return JSON.stringify(parsed, null, 2);
  } catch {
    return payload;
  }
};

const renderMessage = (message: OperationLogMessage) => {
  return message.message_data || message.message_type;
};

export default function OperationLogModal({
  selectedLog,
  showDetails,
  showUser = true,
  onClose,
  getStatusBadge,
  getOperationDuration,
}: OperationLogModalProps) {
  if (!showDetails || !selectedLog) {
    return null;
  }

  const { log, messages } = selectedLog;

  return (
    <div className={theme.modal.overlay} role="dialog" aria-modal="true" onClick={onClose}>
      <div
        className={cn(theme.modal.content, 'max-w-4xl overflow-hidden')}
        onClick={(event) => event.stopPropagation()}
      >
        <header className={theme.modal.header}>
          <div>
            <h2 className={theme.modal.title}>Operation Details</h2>
            <p className={theme.modal.subtitle}>{log.operation_id}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className={theme.buttons.icon}
            aria-label="Close details"
          >
            <XMarkIcon className="h-5 w-5" />
          </button>
        </header>

        <div className="max-h-[80vh] overflow-y-auto px-6 py-6">
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            <div className="space-y-4">
              <div>
                <p className={theme.forms.label}>Command</p>
                <p className={cn('mt-1 text-sm font-medium', theme.text.strong)}>{log.command}</p>
              </div>
              <div>
                <p className={theme.forms.label}>Stack</p>
                <p className={cn('mt-1 text-sm', theme.text.standard)}>{log.stack_name}</p>
              </div>
              <div>
                <p className={theme.forms.label}>Status</p>
                <div className="mt-1">{getStatusBadge(log)}</div>
              </div>
              <div>
                <p className={theme.forms.label}>Duration</p>
                <p className={cn('mt-1 text-sm', theme.text.standard)}>
                  {getOperationDuration(log)}
                </p>
              </div>
              <div>
                <p className={theme.forms.label}>Exit Code</p>
                <p className={cn('mt-1 text-sm', theme.text.standard)}>{log.exit_code ?? 'N/A'}</p>
              </div>
            </div>

            <div className="space-y-4">
              {showUser && (
                <div>
                  <p className={theme.forms.label}>User</p>
                  <p className={cn('mt-1 text-sm', theme.text.standard)}>{log.user_name}</p>
                </div>
              )}
              <div>
                <p className={theme.forms.label}>Server</p>
                <p className={cn('mt-1 text-sm', theme.text.standard)}>{log.server_name}</p>
              </div>
              <div>
                <p className={theme.forms.label}>Trigger Source</p>
                <div className="mt-1">
                  <span className={theme.selectable.pill}>👤 Manual</span>
                </div>
              </div>
              <div>
                <p className={theme.forms.label}>Started</p>
                <p className={cn('mt-1 text-sm', theme.text.standard)}>{log.formatted_date}</p>
              </div>
              <div>
                <p className={theme.forms.label}>Messages</p>
                <p className={cn('mt-1 text-sm', theme.text.subtle)}>
                  {messages.length} recorded entries
                </p>
              </div>
            </div>
          </div>

          {log.options && (
            <section className="mt-6">
              <h3 className={cn('mb-2 text-sm font-semibold', theme.text.strong)}>Options</h3>
              <div className={cn('rounded-lg p-3', theme.surface.soft)}>
                <pre className={cn('whitespace-pre-wrap text-xs', theme.text.standard)}>
                  {toPrettyJson(log.options)}
                </pre>
              </div>
            </section>
          )}

          {log.services && (
            <section className="mt-6">
              <h3 className={cn('mb-2 text-sm font-semibold', theme.text.strong)}>Services</h3>
              <div className={cn('rounded-lg p-3', theme.surface.soft)}>
                <pre className={cn('whitespace-pre-wrap text-xs', theme.text.standard)}>
                  {toPrettyJson(log.services)}
                </pre>
              </div>
            </section>
          )}

          <section className="mt-6">
            <h3 className={cn('mb-2 text-sm font-semibold', theme.text.strong)}>Log Output</h3>
            <div className="max-h-64 overflow-y-auto rounded-lg bg-slate-950 p-4 font-mono text-xs text-slate-200">
              {messages.length === 0 ? (
                <p className={theme.text.subtle}>No log messages recorded.</p>
              ) : (
                <div className="space-y-1">
                  {messages.map((message) => (
                    <div key={message.id}>{renderMessage(message)}</div>
                  ))}
                </div>
              )}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
