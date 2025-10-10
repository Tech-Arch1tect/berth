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
    <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
      <div className="flex items-center space-x-4">
        <div
          className={cn(
            'w-16 h-16 rounded-2xl flex items-center justify-center',
            theme.brand.stack
          )}
        >
          <CircleStackIcon className="w-8 h-8 text-white" />
        </div>
        <div>
          <div className="flex items-center space-x-3">
            <h1 className={cn('text-3xl font-bold', theme.brand.titleGradient)}>{stackname}</h1>
            {/* Connection Status */}
            <div
              className={cn(
                'flex items-center space-x-2 px-3 py-1 rounded-full text-xs font-medium',
                connectionStatus === 'connected' && theme.badges.tag.success,
                connectionStatus === 'connecting' && theme.badges.tag.warning,
                connectionStatus === 'disconnected' && theme.badges.tag.danger
              )}
            >
              <div
                className={cn(
                  theme.badges.statusDot.base,
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
          <div className="flex items-center space-x-4 mt-2">
            <div className={cn('flex items-center space-x-2 text-sm', theme.text.muted)}>
              <ServerIcon className="w-4 h-4" />
              <span>{server.name}</span>
            </div>
            <>
              <div className={cn('w-1 h-1 rounded-full', theme.badges.dot.neutral)} />
              <div className={cn('text-sm', theme.text.muted)}>{serviceCount} services</div>
              <div className={cn('w-1 h-1 rounded-full', theme.badges.dot.neutral)} />
              <div className={cn('text-sm', theme.text.muted)}>{containerCount} containers</div>
            </>
          </div>
        </div>
      </div>

      <div className="flex items-center space-x-3">
        {/* Stack Quick Actions */}
        {services && canManageStack && (
          <div className={cn(theme.cards.translucent, 'rounded-xl px-3 py-2')}>
            <StackQuickActions
              services={services}
              onQuickOperation={onQuickOperation}
              disabled={quickOperationState.isRunning}
              isOperationRunning={quickOperationState.isRunning}
              runningOperation={quickOperationState.operation}
            />
          </div>
        )}

        {/* Documentation Button */}
        <button
          onClick={onGenerateDocumentation}
          className={cn(
            'flex items-center space-x-2 px-3 py-2 rounded-xl transition-colors duration-200',
            theme.intent.info.surface,
            theme.intent.info.textStrong,
            theme.intent.info.border,
            'border hover:opacity-90'
          )}
          title="Generate stack documentation"
        >
          <DocumentTextIcon className="w-5 h-5" />
          <span className="text-sm font-medium">Documentation</span>
        </button>

        {/* Refresh Button */}
        <button onClick={onRefresh} disabled={isRefreshing} className={cn(theme.buttons.secondary)}>
          <ArrowPathIcon className={cn('w-4 h-4 mr-2', isRefreshing && 'animate-spin')} />
          Refresh All
        </button>

        {/* Operations Button */}
        {canManageStack && (
          <button
            onClick={onOpenAdvancedOperations}
            className={cn(theme.buttons.primary, 'shadow-lg hover:shadow-xl')}
          >
            <Cog6ToothIcon className="w-4 h-4 mr-2" />
            Advanced Operations
          </button>
        )}
      </div>
    </div>
  );
};
