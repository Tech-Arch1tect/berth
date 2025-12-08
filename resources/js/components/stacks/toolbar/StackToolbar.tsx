import React from 'react';
import { Link } from '@inertiajs/react';
import { ComposeService } from '../../../types/stack';
import { WebSocketConnectionStatus } from '../../../types/websocket';
import { OperationRequest } from '../../../types/operations';
import { StackQuickActions } from '../services/StackQuickActions';
import {
  ArrowPathIcon,
  DocumentTextIcon,
  Cog6ToothIcon,
  SignalIcon,
  SignalSlashIcon,
  CodeBracketIcon,
  HomeIcon,
  ChevronRightIcon,
} from '@heroicons/react/24/outline';
import { cn } from '../../../utils/cn';
import { theme } from '../../../theme';

interface StackToolbarProps {
  stackName: string;
  serverName: string;
  serverId: number;
  services: ComposeService[];
  connectionStatus: WebSocketConnectionStatus;
  canManage: boolean;
  isOperationRunning: boolean;
  runningOperation?: string;
  isRefreshing: boolean;
  onQuickOperation: (operation: OperationRequest) => void;
  onRefresh: () => void;
  onGenerateDocs: () => void;
  onEditCompose: () => void;
  onAdvancedOperations: () => void;
}

export const StackToolbar: React.FC<StackToolbarProps> = ({
  stackName,
  serverName,
  serverId,
  services,
  connectionStatus,
  canManage,
  isOperationRunning,
  runningOperation,
  isRefreshing,
  onQuickOperation,
  onRefresh,
  onGenerateDocs,
  onEditCompose,
  onAdvancedOperations,
}) => {
  const statusConfig: Record<
    WebSocketConnectionStatus,
    { icon: typeof SignalIcon; color: string; bg: string; label: string }
  > = {
    connected: {
      icon: SignalIcon,
      color: 'text-emerald-500',
      bg: 'bg-emerald-100 dark:bg-emerald-900/30',
      label: 'Connected',
    },
    connecting: {
      icon: SignalIcon,
      color: 'text-amber-500',
      bg: 'bg-amber-100 dark:bg-amber-900/30',
      label: 'Connecting',
    },
    disconnected: {
      icon: SignalSlashIcon,
      color: 'text-zinc-400',
      bg: 'bg-zinc-100 dark:bg-zinc-800',
      label: 'Disconnected',
    },
    error: {
      icon: SignalSlashIcon,
      color: 'text-red-500',
      bg: 'bg-red-100 dark:bg-red-900/30',
      label: 'Error',
    },
  };

  const status = statusConfig[connectionStatus];
  const StatusIcon = status.icon;

  return (
    <div className={cn('px-4 py-3 flex items-center justify-between gap-4', theme.surface.muted)}>
      {/* Left: Breadcrumb navigation */}
      <nav className="flex items-center gap-2 min-w-0" aria-label="Breadcrumb">
        <Link
          href="/"
          className={cn(
            theme.text.subtle,
            'hover:text-zinc-700 dark:hover:text-zinc-300 transition-colors flex-shrink-0'
          )}
        >
          <HomeIcon className="h-4 w-4" />
        </Link>
        <ChevronRightIcon className={cn('h-4 w-4 flex-shrink-0', theme.text.subtle)} />
        <Link
          href={`/servers/${serverId}/stacks`}
          className={cn(
            'text-sm font-medium transition-colors truncate',
            theme.text.muted,
            'hover:text-zinc-700 dark:hover:text-zinc-300'
          )}
        >
          {serverName}
        </Link>
        <ChevronRightIcon className={cn('h-4 w-4 flex-shrink-0', theme.text.subtle)} />
        <span className={cn('text-sm font-semibold truncate', theme.text.strong)}>{stackName}</span>
        <div
          className={cn(
            'flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium flex-shrink-0',
            status.bg,
            status.color
          )}
        >
          <StatusIcon className="w-3 h-3" />
          <span className="hidden sm:inline">{status.label}</span>
        </div>
      </nav>

      {/* Center: Stack quick actions */}
      {canManage && (
        <div
          className={cn(
            'flex items-center rounded-lg overflow-hidden',
            'border border-zinc-200 dark:border-zinc-700'
          )}
        >
          <span
            className={cn(
              'text-xs font-semibold uppercase tracking-wide px-3 py-1.5',
              'bg-zinc-100 dark:bg-zinc-800',
              theme.text.muted
            )}
          >
            Stack
          </span>
          <div className="w-px h-full bg-zinc-200 dark:bg-zinc-700" />
          <StackQuickActions
            services={services}
            onQuickOperation={onQuickOperation}
            isOperationRunning={isOperationRunning}
            runningOperation={runningOperation}
          />
        </div>
      )}

      {/* Right: Utility buttons */}
      <div className="flex items-center gap-1">
        <button
          onClick={onRefresh}
          disabled={isRefreshing}
          className={cn(
            'p-2 rounded-md transition-colors',
            'hover:bg-zinc-100 dark:hover:bg-zinc-800',
            theme.text.muted,
            isRefreshing && 'opacity-50'
          )}
          title="Refresh all data"
        >
          <ArrowPathIcon className={cn('w-4 h-4', isRefreshing && 'animate-spin')} />
        </button>

        {canManage && (
          <button
            onClick={onEditCompose}
            className={cn(
              'p-2 rounded-md transition-colors',
              'hover:bg-zinc-100 dark:hover:bg-zinc-800',
              theme.text.muted
            )}
            title="Edit compose file"
          >
            <CodeBracketIcon className="w-4 h-4" />
          </button>
        )}

        <button
          onClick={onGenerateDocs}
          className={cn(
            'p-2 rounded-md transition-colors',
            'hover:bg-zinc-100 dark:hover:bg-zinc-800',
            theme.text.muted
          )}
          title="Generate documentation"
        >
          <DocumentTextIcon className="w-4 h-4" />
        </button>

        {canManage && (
          <button
            onClick={onAdvancedOperations}
            className={cn(
              'p-2 rounded-md transition-colors',
              'hover:bg-zinc-100 dark:hover:bg-zinc-800',
              theme.text.muted
            )}
            title="Advanced operations"
          >
            <Cog6ToothIcon className="w-4 h-4" />
          </button>
        )}
      </div>
    </div>
  );
};
