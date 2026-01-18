import { CheckCircleIcon, XCircleIcon, ArrowPathIcon } from '@heroicons/react/24/outline';
import { cn } from '../../utils/cn';
import { theme } from '../../theme';
import { ServerWithAgentStack } from '../../types/agent-update';

interface AgentDiscoveryTableProps {
  servers: ServerWithAgentStack[];
  agentServers: ServerWithAgentStack[];
  selectedServerIds: Set<number>;
  loading: boolean;
  error: string | null;
  isUpdating: boolean;
  onToggleSelection: (serverId: number) => void;
  onSelectAll: () => void;
  onDeselectAll: () => void;
  onRefresh: () => void;
}

export function AgentDiscoveryTable({
  servers,
  agentServers,
  selectedServerIds,
  loading,
  error,
  isUpdating,
  onToggleSelection,
  onSelectAll,
  onDeselectAll,
  onRefresh,
}: AgentDiscoveryTableProps) {
  const selectedAgentServers = agentServers.filter((s) => selectedServerIds.has(s.serverId));

  return (
    <div className={cn('rounded-lg p-6 mb-6', theme.surface.panel)}>
      <div className="flex items-center justify-between mb-4">
        <h2 className={cn('text-lg font-medium', theme.text.strong)}>Discovered Agents</h2>
        <button
          onClick={onRefresh}
          disabled={loading || isUpdating}
          className={cn(theme.buttons.secondary, 'disabled:opacity-50')}
        >
          <ArrowPathIcon className={cn('h-4 w-4 mr-2', loading && 'animate-spin')} />
          Refresh
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-8">
          <ArrowPathIcon className="h-6 w-6 animate-spin text-blue-500" />
          <span className={cn('ml-2', theme.text.muted)}>Discovering agents...</span>
        </div>
      ) : error ? (
        <div className={cn('p-4 rounded-lg', theme.intent.danger.surface)}>
          <p className={theme.intent.danger.textStrong}>{error}</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
            <thead>
              <tr>
                <th className="px-4 py-3 text-left">
                  <input
                    type="checkbox"
                    checked={
                      agentServers.length > 0 &&
                      agentServers.every((s) => selectedServerIds.has(s.serverId))
                    }
                    onChange={(e) => (e.target.checked ? onSelectAll() : onDeselectAll())}
                    disabled={isUpdating}
                    className="rounded border-gray-300 dark:border-gray-600"
                  />
                </th>
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
                  Host
                </th>
                <th
                  className={cn(
                    'px-4 py-3 text-left text-xs font-medium uppercase tracking-wider',
                    theme.text.muted
                  )}
                >
                  Has Agent
                </th>
                <th
                  className={cn(
                    'px-4 py-3 text-left text-xs font-medium uppercase tracking-wider',
                    theme.text.muted
                  )}
                >
                  Current Image
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
              {servers.map((server) => (
                <tr
                  key={server.serverId}
                  className={cn(
                    server.hasAgentStack && selectedServerIds.has(server.serverId)
                      ? 'bg-blue-50 dark:bg-blue-900/20'
                      : ''
                  )}
                >
                  <td className="px-4 py-3 whitespace-nowrap">
                    <input
                      type="checkbox"
                      checked={selectedServerIds.has(server.serverId)}
                      onChange={() => onToggleSelection(server.serverId)}
                      disabled={!server.hasAgentStack || isUpdating}
                      className="rounded border-gray-300 dark:border-gray-600 disabled:opacity-50"
                    />
                  </td>
                  <td className={cn('px-4 py-3 whitespace-nowrap', theme.text.standard)}>
                    {server.serverName}
                  </td>
                  <td className={cn('px-4 py-3 whitespace-nowrap', theme.text.muted)}>
                    {server.serverHost}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    {server.hasAgentStack ? (
                      <CheckCircleIcon className="h-5 w-5 text-green-500" />
                    ) : (
                      <XCircleIcon className="h-5 w-5 text-gray-400" />
                    )}
                  </td>
                  <td className={cn('px-4 py-3 whitespace-nowrap text-sm', theme.text.muted)}>
                    {server.currentImages?.['berth-agent'] || '-'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="mt-4 flex items-center justify-between">
        <p className={cn('text-sm', theme.text.subtle)}>
          Found {agentServers.length} server(s) with berth-agent stacks
          {selectedAgentServers.length > 0 && (
            <span className={theme.text.standard}> · {selectedAgentServers.length} selected</span>
          )}
        </p>
        {agentServers.length > 0 && !isUpdating && (
          <div className="flex gap-2">
            <button
              onClick={onSelectAll}
              className="text-sm text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
              type="button"
            >
              Select all
            </button>
            <span className={theme.text.muted}>·</span>
            <button
              onClick={onDeselectAll}
              className="text-sm text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
              type="button"
            >
              Deselect all
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
