import React from 'react';
import { cn } from '../../../utils/cn';
import { theme } from '../../../theme';
import { Server } from '../../../types/server';
import { StackQuickActions } from '../services/StackQuickActions';
import { OperationRequest } from '../../../types/operations';
import { ComposeService } from '../../../types/stack';
import { WebSocketConnectionStatus } from '../../../types/websocket';
import {
  CircleStackIcon,
  ServerIcon,
  DocumentTextIcon,
  ArrowPathIcon,
  Cog6ToothIcon,
} from '@heroicons/react/24/outline';

interface StackHeaderProps {
  stackname: string;
  server: Server;
  connectionStatus: WebSocketConnectionStatus;
  services?: ComposeService[];
  serviceCount: number;
  containerCount: number;
  canManageStack: boolean;
  onQuickOperation: (operation: OperationRequest) => void;
  quickOperationState: {
    isRunning: boolean;
    operation?: string;
  };
  onGenerateDocumentation: () => void;
  onRefresh: () => void;
  isRefreshing: boolean;
  onOpenAdvancedOperations: () => void;
}

export const StackHeader: React.FC<StackHeaderProps> = ({
  stackname,
  server,
  connectionStatus,
  services,
  serviceCount,
  containerCount,
  canManageStack,
  onQuickOperation,
  quickOperationState,
  onGenerateDocumentation,
  onRefresh,
  isRefreshing,
  onOpenAdvancedOperations,
}) => {
  return (
    <div className="flex items-start justify-between gap-4">
      <div className="flex items-center gap-3 min-w-0 flex-1">
        <div
          className={cn(
            'w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 shadow-md',
            theme.brand.stack
          )}
        >
          <CircleStackIcon className="w-6 h-6 text-white" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className={cn('text-xl font-bold truncate', theme.brand.titleColor)}>
              {stackname}
            </h1>
            {/* Connection Status */}
            <div
              className={cn(
                'flex items-center gap-1.5 px-2 py-0.5 rounded-md text-xs font-semibold flex-shrink-0',
                connectionStatus === 'connected' && theme.badges.tag.success,
                connectionStatus === 'connecting' && theme.badges.tag.warning,
                connectionStatus === 'disconnected' && theme.badges.tag.danger
              )}
            >
              <div
                className={cn(
                  'w-1.5 h-1.5 rounded-full',
                  connectionStatus === 'connected' && theme.badges.statusDot.online,
                  connectionStatus === 'connecting' && 'bg-yellow-500',
                  connectionStatus === 'disconnected' && 'bg-red-500',
                  (connectionStatus === 'connected' || connectionStatus === 'connecting') &&
                    theme.badges.statusDot.pulse
                )}
              />
              <span>
                {connectionStatus === 'connected'
                  ? 'Live'
                  : connectionStatus === 'connecting'
                    ? 'Connecting'
                    : 'Offline'}
              </span>
            </div>
          </div>
          <div className="flex items-center gap-3 mt-1.5">
            <div className={cn('flex items-center gap-1.5 text-xs', theme.text.muted)}>
              <ServerIcon className="w-3.5 h-3.5" />
              <span>{server.name}</span>
            </div>
            <div className={cn('w-1 h-1 rounded-full', theme.badges.dot.neutral)} />
            <div className={cn('text-xs font-medium', theme.text.muted)}>
              {serviceCount} services
            </div>
            <div className={cn('w-1 h-1 rounded-full', theme.badges.dot.neutral)} />
            <div className={cn('text-xs font-medium', theme.text.muted)}>
              {containerCount} containers
            </div>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-2 flex-shrink-0">
        {/* Stack Quick Actions */}
        {services && canManageStack && (
          <div className="flex items-center gap-1 px-2 py-1 rounded-lg bg-zinc-50 border border-zinc-200 dark:bg-zinc-800/50 dark:border-zinc-700">
            <StackQuickActions
              services={services}
              onQuickOperation={onQuickOperation}
              disabled={quickOperationState.isRunning}
              isOperationRunning={quickOperationState.isRunning}
              runningOperation={quickOperationState.operation}
            />
          </div>
        )}

        {/* Utility Actions Group */}
        <div className="flex items-center gap-1 px-1 py-1 rounded-lg bg-zinc-50 border border-zinc-200 dark:bg-zinc-800/50 dark:border-zinc-700">
          {/* Documentation Button */}
          <button
            onClick={onGenerateDocumentation}
            className={cn(
              'p-2 rounded-md transition-colors',
              'hover:bg-teal-100 dark:hover:bg-teal-900/30',
              theme.text.muted,
              'hover:text-teal-700 dark:hover:text-teal-300'
            )}
            title="Generate stack documentation"
          >
            <DocumentTextIcon className="w-4 h-4" />
          </button>

          {/* Refresh Button */}
          <button
            onClick={onRefresh}
            disabled={isRefreshing}
            className={cn(
              'p-2 rounded-md transition-colors',
              'hover:bg-zinc-200 dark:hover:bg-zinc-700',
              theme.text.muted,
              'hover:text-zinc-900 dark:hover:text-zinc-100',
              isRefreshing && 'opacity-60'
            )}
            title="Refresh all data"
          >
            <ArrowPathIcon className={cn('w-4 h-4', isRefreshing && 'animate-spin')} />
          </button>

          {/* Operations Button */}
          {canManageStack && (
            <button
              onClick={onOpenAdvancedOperations}
              className={cn(
                'p-2 rounded-md transition-colors',
                'bg-teal-600 hover:bg-teal-700',
                'text-white shadow-sm'
              )}
              title="Advanced operations"
            >
              <Cog6ToothIcon className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
