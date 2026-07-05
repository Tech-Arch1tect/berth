import React from 'react';
import {
  XMarkIcon,
  ClockIcon,
  ServerIcon,
  UserIcon,
  CommandLineIcon,
  DocumentTextIcon,
  BoltIcon,
} from '@heroicons/react/24/outline';
import { cn } from '../../../../shared/utils/cn';
import { theme } from '../../../../shared/theme';
import type { OperationLogDetailData } from '../../../../api/generated/models';
import { StatusBadge } from '../badges';
import { operationDuration } from '../../duration';

interface OperationDetailPanelProps {
  detail: OperationLogDetailData | null;
  isLoading: boolean;
  showUser?: boolean;
  onClose: () => void;
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

const formatTriggerSource = (triggerSource: string) => {
  if (triggerSource === 'scheduled' || triggerSource === 'cron') return 'Scheduled';
  if (triggerSource === 'api') return 'API';
  return 'Manual';
};

const InfoRow: React.FC<{
  icon: React.ElementType;
  label: string;
  value: React.ReactNode;
}> = ({ icon: Icon, label, value }) => (
  <div className="flex items-start gap-3">
    <Icon className={cn('h-4 w-4 mt-0.5 flex-shrink-0', theme.text.muted)} />
    <div className="flex-1 min-w-0">
      <p className={cn('text-xs', theme.text.muted)}>{label}</p>
      <p className={cn('text-sm font-medium', theme.text.strong)}>{value}</p>
    </div>
  </div>
);

export const OperationDetailPanel: React.FC<OperationDetailPanelProps> = ({
  detail,
  isLoading,
  showUser = false,
  onClose,
}) => {
  if (isLoading) {
    return (
      <div className="h-full flex flex-col border-l border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900">
        <div className="flex-shrink-0 flex items-center justify-between px-4 py-3 border-b border-zinc-200 dark:border-zinc-700">
          <span className={cn('text-sm font-semibold', theme.text.strong)}>Operation Details</span>
          <button onClick={onClose} aria-label="Close" className={cn(theme.buttons.icon, 'p-1')}>
            <XMarkIcon className="h-5 w-5" />
          </button>
        </div>
        <div className="flex-1 flex items-center justify-center">
          <div className="animate-pulse flex flex-col items-center gap-2">
            <div className="h-8 w-8 rounded-full bg-zinc-200 dark:bg-zinc-700" />
            <div className="h-4 w-24 rounded bg-zinc-200 dark:bg-zinc-700" />
          </div>
        </div>
      </div>
    );
  }

  if (!detail) {
    return (
      <div className="h-full flex flex-col border-l border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900">
        <div className="flex-shrink-0 flex items-center justify-between px-4 py-3 border-b border-zinc-200 dark:border-zinc-700">
          <span className={cn('text-sm font-semibold', theme.text.strong)}>Operation Details</span>
          <button onClick={onClose} aria-label="Close" className={cn(theme.buttons.icon, 'p-1')}>
            <XMarkIcon className="h-5 w-5" />
          </button>
        </div>
        <div className="flex-1 flex items-center justify-center">
          <p className={theme.text.muted}>Select an operation to view details</p>
        </div>
      </div>
    );
  }

  const { log, messages } = detail;

  return (
    <div className="h-full flex flex-col border-l border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900">
      {/* Header */}
      <div className="flex-shrink-0 flex items-center justify-between px-4 py-3 border-b border-zinc-200 dark:border-zinc-700">
        <div>
          <span className={cn('text-sm font-semibold', theme.text.strong)}>Operation Details</span>
          <p className={cn('text-xs font-mono', theme.text.muted)}>{log.operation_id.slice(-12)}</p>
        </div>
        <button onClick={onClose} aria-label="Close" className={cn(theme.buttons.icon, 'p-1')}>
          <XMarkIcon className="h-5 w-5" />
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto">
        <div className="p-4 space-y-6">
          {/* Status & Command */}
          <div className="flex items-center justify-between">
            <StatusBadge log={log} />
            <span className={cn('text-lg font-semibold', theme.text.strong)}>{log.command}</span>
          </div>

          {/* Info Grid */}
          <div className="grid grid-cols-2 gap-4">
            <InfoRow icon={DocumentTextIcon} label="Stack" value={log.stack_name} />
            <InfoRow icon={ServerIcon} label="Server" value={log.server_name} />
            <InfoRow
              icon={BoltIcon}
              label="Trigger"
              value={formatTriggerSource(log.trigger_source)}
            />
            <InfoRow icon={ClockIcon} label="Duration" value={operationDuration(log)} />
            <InfoRow icon={CommandLineIcon} label="Exit Code" value={log.exit_code ?? 'N/A'} />
            {showUser && <InfoRow icon={UserIcon} label="User" value={log.user_name} />}
            <InfoRow icon={ClockIcon} label="Started" value={log.formatted_date} />
          </div>

          {/* Options */}
          {log.options && (
            <div className="space-y-2">
              <h4
                className={cn('text-xs font-semibold uppercase tracking-wider', theme.text.muted)}
              >
                Options
              </h4>
              <div className={cn('rounded-lg p-3', 'bg-zinc-50 dark:bg-zinc-800')}>
                <pre className={cn('whitespace-pre-wrap text-xs font-mono', theme.text.standard)}>
                  {toPrettyJson(log.options)}
                </pre>
              </div>
            </div>
          )}

          {/* Services */}
          {log.services && (
            <div className="space-y-2">
              <h4
                className={cn('text-xs font-semibold uppercase tracking-wider', theme.text.muted)}
              >
                Services
              </h4>
              <div className={cn('rounded-lg p-3', 'bg-zinc-50 dark:bg-zinc-800')}>
                <pre className={cn('whitespace-pre-wrap text-xs font-mono', theme.text.standard)}>
                  {toPrettyJson(log.services)}
                </pre>
              </div>
            </div>
          )}

          {/* Log Output */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <h4
                className={cn('text-xs font-semibold uppercase tracking-wider', theme.text.muted)}
              >
                Log Output
              </h4>
              <span className={cn('text-xs', theme.text.muted)}>
                {messages.length} {messages.length === 1 ? 'entry' : 'entries'}
              </span>
            </div>
            <div className="rounded-lg bg-zinc-950 p-4 max-h-64 overflow-auto">
              {messages.length === 0 ? (
                <p className="text-zinc-500 text-xs">No log messages recorded.</p>
              ) : (
                <div className="space-y-1 font-mono text-xs text-zinc-200">
                  {messages.map((message) => (
                    <div key={message.id}>{message.message_data || message.message_type}</div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
