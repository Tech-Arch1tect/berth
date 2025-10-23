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
  const connectionBadgeStyle =
    connectionStatus === 'connected'
      ? theme.badges.connection.connected
      : connectionStatus === 'connecting'
        ? theme.badges.connection.connecting
        : theme.badges.connection.disconnected;

  const connectionDotStyle =
    connectionStatus === 'connected'
      ? theme.badges.connectionDot.connected
      : connectionStatus === 'connecting'
        ? theme.badges.connectionDot.connecting
        : theme.badges.connectionDot.disconnected;

  return (
    <div className={cn(theme.cards.enhanced.base, 'p-6')}>
      <div className={cn('absolute top-0 left-0 right-0', theme.brand.gradientAccent)} />

      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-4 min-w-0 flex-1">
          <div className={theme.icon.gradientLg}>
            <CircleStackIcon className="w-7 h-7 text-white" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-3 flex-wrap mb-2">
              <h1 className={cn('text-2xl font-bold truncate', theme.brand.titleColor)}>
                {stackname}
              </h1>
              <div className={cn(theme.badges.connection.base, connectionBadgeStyle)}>
                <div
                  className={cn(
                    theme.badges.connectionDot.base,
                    connectionDotStyle,
                    (connectionStatus === 'connected' || connectionStatus === 'connecting') &&
                      theme.badges.connectionDot.pulse
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
            <div className="flex items-center gap-4 flex-wrap">
              <div className={cn('flex items-center gap-2 text-sm', theme.text.muted)}>
                <ServerIcon className="w-4 h-4" />
                <span className="font-medium">{server.name}</span>
              </div>
              <div className={cn('flex items-center gap-2 text-sm font-medium', theme.text.muted)}>
                <div className="flex items-center gap-1.5">
                  <div className={cn('w-1.5 h-1.5 rounded-full', theme.badges.dot.info)} />
                  <span>{serviceCount} services</span>
                </div>
              </div>
              <div className={cn('flex items-center gap-2 text-sm font-medium', theme.text.muted)}>
                <div className="flex items-center gap-1.5">
                  <div className={cn('w-1.5 h-1.5 rounded-full', theme.badges.dot.success)} />
                  <span>{containerCount} containers</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-shrink-0">
          {/* Stack Quick Actions */}
          {services && canManageStack && (
            <div
              className={cn(
                'flex items-center gap-1 px-2 py-1 rounded-lg',
                theme.surface.subtle,
                theme.intent.neutral.border,
                'border'
              )}
            >
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
          <div
            className={cn(
              'flex items-center gap-1 px-1 py-1 rounded-lg',
              theme.surface.subtle,
              theme.intent.neutral.border,
              'border'
            )}
          >
            {/* Documentation Button */}
            <button
              onClick={onGenerateDocumentation}
              className={cn(
                'p-2 rounded-md transition-colors',
                theme.text.muted,
                'hover:bg-teal-100 dark:hover:bg-teal-900/30 hover:text-teal-700 dark:hover:text-teal-300'
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
                theme.text.muted,
                'hover:bg-zinc-200 dark:hover:bg-zinc-700 hover:text-zinc-900 dark:hover:text-zinc-100',
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
                  theme.brand.accent,
                  'shadow-sm hover:bg-teal-700'
                )}
                title="Advanced operations"
              >
                <Cog6ToothIcon className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
