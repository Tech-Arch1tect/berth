import { cn } from '../../utils/cn';
import { theme } from '../../theme';
import { AgentUpdateProgress } from '../../types/agent-update';
import { StatusIcon, getStatusLabel } from './StatusIcon';

interface UpdateProgressTableProps {
  progress: AgentUpdateProgress[];
  currentServerIndex: number;
  isUpdating: boolean;
  successCount: number;
  failedCount: number;
  skippedCount: number;
  onCancel: () => void;
  onReset: () => void;
}

export function UpdateProgressTable({
  progress,
  currentServerIndex,
  isUpdating,
  successCount,
  failedCount,
  skippedCount,
  onCancel,
  onReset,
}: UpdateProgressTableProps) {
  return (
    <div className={cn('rounded-lg p-6', theme.surface.panel)}>
      <div className="flex items-center justify-between mb-4">
        <h2 className={cn('text-lg font-medium', theme.text.strong)}>Update Progress</h2>
        {isUpdating && (
          <button onClick={onCancel} className={theme.buttons.danger}>
            Cancel Update
          </button>
        )}
      </div>

      {/* Summary */}
      <div className="flex gap-4 mb-4">
        <div className={cn('px-3 py-1 rounded-full text-sm', theme.intent.success.surface)}>
          <span className={theme.intent.success.textStrong}>{successCount} succeeded</span>
        </div>
        {failedCount > 0 && (
          <div className={cn('px-3 py-1 rounded-full text-sm', theme.intent.danger.surface)}>
            <span className={theme.intent.danger.textStrong}>{failedCount} failed</span>
          </div>
        )}
        {skippedCount > 0 && (
          <div className={cn('px-3 py-1 rounded-full text-sm bg-gray-100 dark:bg-gray-800')}>
            <span className={theme.text.muted}>{skippedCount} skipped</span>
          </div>
        )}
      </div>

      {/* Progress Table */}
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
          <thead>
            <tr>
              <th
                className={cn(
                  'px-4 py-3 text-left text-xs font-medium uppercase tracking-wider',
                  theme.text.muted
                )}
              >
                Server
              </th>
              <th
                className={cn(
                  'px-4 py-3 text-left text-xs font-medium uppercase tracking-wider',
                  theme.text.muted
                )}
              >
                Status
              </th>
              <th
                className={cn(
                  'px-4 py-3 text-left text-xs font-medium uppercase tracking-wider',
                  theme.text.muted
                )}
              >
                Message
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
            {progress.map((p, idx) => (
              <tr
                key={p.serverId}
                className={idx === currentServerIndex ? 'bg-blue-50 dark:bg-blue-900/20' : ''}
              >
                <td className={cn('px-4 py-3 whitespace-nowrap', theme.text.standard)}>
                  {p.serverName}
                </td>
                <td className="px-4 py-3 whitespace-nowrap">
                  <div className="flex items-center">
                    <StatusIcon status={p.status} />
                    <span className={cn('ml-2', theme.text.standard)}>
                      {getStatusLabel(p.status)}
                    </span>
                  </div>
                </td>
                <td className={cn('px-4 py-3', theme.text.muted)}>{p.message || '-'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Reset button when complete */}
      {!isUpdating && progress.length > 0 && (
        <div className="mt-4 flex justify-end">
          <button onClick={onReset} className={theme.buttons.secondary}>
            Start New Update
          </button>
        </div>
      )}
    </div>
  );
}
