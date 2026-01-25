import React, { useState, useRef, useEffect } from 'react';
import { Link } from '@inertiajs/react';
import type { ComposeService } from '../../../api/generated/models';
import { WebSocketConnectionStatus } from '../../../types/websocket';
import { OperationRequest } from '../../../types/operations';
import { StackQuickActions } from '../services/StackQuickActions';
import {
  ArrowPathIcon,
  DocumentTextIcon,
  Cog6ToothIcon,
  SignalIcon,
  SignalSlashIcon,
  HomeIcon,
  ChevronRightIcon,
  ChevronDownIcon,
  ClipboardDocumentIcon,
  ArrowDownTrayIcon,
  PencilSquareIcon,
} from '@heroicons/react/24/outline';
import { cn } from '../../../utils/cn';
import { theme } from '../../../theme';
import { SidebarSelection } from '../sidebar/types';

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
  selection?: SidebarSelection | null;
  onQuickOperation: (operation: OperationRequest) => void;
  onRefresh: () => void;
  onCopyDocs: () => void;
  onDownloadDocs: () => void;
  onAdvancedOperations: () => void;
  onOpenComposeEditor: () => void;
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
  selection,
  onQuickOperation,
  onRefresh,
  onCopyDocs,
  onDownloadDocs,
  onAdvancedOperations,
  onOpenComposeEditor,
}) => {
  const [docsMenuOpen, setDocsMenuOpen] = useState(false);
  const docsMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (docsMenuRef.current && !docsMenuRef.current.contains(event.target as Node)) {
        setDocsMenuOpen(false);
      }
    };

    if (docsMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [docsMenuOpen]);
  const showStackActions = canManage && selection?.type !== 'service';
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
      {showStackActions && (
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

        {/* Documentation split button */}
        <div ref={docsMenuRef} className="relative flex">
          <button
            onClick={onCopyDocs}
            className={cn(
              'p-2 rounded-l-md transition-colors',
              'hover:bg-zinc-100 dark:hover:bg-zinc-800',
              'border-r border-zinc-200 dark:border-zinc-700',
              theme.text.muted
            )}
            title="Copy documentation to clipboard"
          >
            <DocumentTextIcon className="w-4 h-4" />
          </button>
          <button
            onClick={() => setDocsMenuOpen(!docsMenuOpen)}
            className={cn(
              'px-1 rounded-r-md transition-colors',
              'hover:bg-zinc-100 dark:hover:bg-zinc-800',
              theme.text.muted
            )}
            title="More documentation options"
          >
            <ChevronDownIcon className="w-3 h-3" />
          </button>

          {docsMenuOpen && (
            <div
              className={cn(
                'absolute right-0 top-full mt-1 py-1 rounded-md shadow-lg z-50 min-w-[160px]',
                'bg-white dark:bg-zinc-800',
                'border border-zinc-200 dark:border-zinc-700'
              )}
            >
              <button
                onClick={() => {
                  onCopyDocs();
                  setDocsMenuOpen(false);
                }}
                className={cn(
                  'w-full px-3 py-1.5 text-left text-sm flex items-center gap-2',
                  'hover:bg-zinc-100 dark:hover:bg-zinc-700',
                  theme.text.muted
                )}
              >
                <ClipboardDocumentIcon className="w-4 h-4" />
                Copy to clipboard
              </button>
              <button
                onClick={() => {
                  onDownloadDocs();
                  setDocsMenuOpen(false);
                }}
                className={cn(
                  'w-full px-3 py-1.5 text-left text-sm flex items-center gap-2',
                  'hover:bg-zinc-100 dark:hover:bg-zinc-700',
                  theme.text.muted
                )}
              >
                <ArrowDownTrayIcon className="w-4 h-4" />
                Download as file
              </button>
            </div>
          )}
        </div>

        {canManage && (
          <>
            <button
              onClick={onOpenComposeEditor}
              className={cn(
                'p-2 rounded-md transition-colors',
                'hover:bg-zinc-100 dark:hover:bg-zinc-800',
                theme.text.muted
              )}
              title="Compose Editor"
            >
              <PencilSquareIcon className="w-4 h-4" />
            </button>
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
          </>
        )}
      </div>
    </div>
  );
};
