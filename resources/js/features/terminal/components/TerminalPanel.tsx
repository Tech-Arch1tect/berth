import React, { useRef, useState, useEffect } from 'react';
import {
  ArrowsPointingInIcon,
  ArrowsPointingOutIcon,
  ChevronDownIcon,
  ChevronUpIcon,
  XMarkIcon,
} from '@heroicons/react/24/outline';
import { useTerminalPanel } from '../contexts/TerminalPanelContext';
import { Terminal } from './Terminal';
import { cn } from '../../../shared/utils/cn';
import { theme } from '../../../shared/theme';
import { StorageManager } from '../../../shared/utils/storage';
import { useIsDesktop } from '../../../shared/hooks/useMediaQuery';
import { useVisualViewportHeight } from '../../../shared/hooks/useVisualViewport';
import type { TerminalTab } from '../contexts/TerminalPanelContext';

export const TerminalPanel: React.FC = () => {
  const { state, closeTerminal, setActiveTab, togglePanel, setPanelHeight } = useTerminalPanel();
  const isDesktop = useIsDesktop();
  const viewportHeight = useVisualViewportHeight();
  const [isResizing, setIsResizing] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() =>
    StorageManager.sidebar.isCollapsed()
  );
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleCollapseChange = (e: Event) => {
      const customEvent = e as CustomEvent<boolean>;
      setSidebarCollapsed(customEvent.detail);
    };
    window.addEventListener('sidebar-collapse-change', handleCollapseChange);
    return () => {
      window.removeEventListener('sidebar-collapse-change', handleCollapseChange);
    };
  }, []);

  useEffect(() => {
    if (!isResizing) return;

    const handleMouseMove = (e: MouseEvent) => {
      if (panelRef.current) {
        const newHeight = window.innerHeight - e.clientY;
        setPanelHeight(newHeight);
      }
    };

    const handleMouseUp = () => {
      setIsResizing(false);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isResizing, setPanelHeight]);

  if (state.tabs.length === 0) {
    return null;
  }

  const tabChip = (tab: TerminalTab) => (
    <div
      key={tab.id}
      className={cn(
        'flex flex-shrink-0 items-center rounded transition-colors',
        tab.id === state.activeTabId
          ? 'bg-teal-50 text-teal-700 dark:bg-teal-900/20 dark:text-teal-300'
          : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200 hover:text-zinc-900 dark:bg-zinc-800/50 dark:text-zinc-400 dark:hover:bg-zinc-700/50 dark:hover:text-zinc-200'
      )}
    >
      <button
        onClick={() => setActiveTab(tab.id)}
        className={cn(
          'whitespace-nowrap py-1 pl-3 pr-1 text-xs font-medium',
          !isDesktop && 'min-h-[44px]'
        )}
        title={`${tab.stackname}/${tab.label}`}
      >
        <span className="block max-w-[150px] truncate">{tab.label}</span>
      </button>
      <button
        onClick={() => closeTerminal(tab.id)}
        aria-label={`Close ${tab.label}`}
        className={cn(
          'flex items-center justify-center rounded p-1 transition-colors',
          'hover:bg-zinc-200 dark:hover:bg-zinc-600',
          !isDesktop && 'min-h-[44px] min-w-[32px]'
        )}
      >
        <XMarkIcon className="h-3.5 w-3.5" />
      </button>
    </div>
  );

  const terminals = state.tabs.map((tab) => (
    <div
      key={tab.id}
      className="h-full"
      style={{
        display: state.isOpen && tab.id === state.activeTabId ? 'block' : 'none',
      }}
    >
      <Terminal
        serverid={tab.serverid}
        stackname={tab.stackname}
        serviceName={tab.serviceName}
        containerName={tab.containerName}
        className="h-full rounded-none"
      />
    </div>
  ));

  const desktopHeader = (
    <div
      className={cn(
        'flex h-10 flex-shrink-0 items-center justify-between px-4',
        'border-b border-zinc-200 dark:border-zinc-700',
        'bg-zinc-50 dark:bg-zinc-800'
      )}
    >
      <div className="flex flex-1 items-center space-x-2 overflow-hidden">
        <button
          onClick={() => {
            if (state.isOpen) {
              setIsFullscreen(false);
            }
            togglePanel();
          }}
          className={cn(
            'flex items-center space-x-2 rounded px-2 py-1 text-sm font-medium transition-colors',
            theme.text.standard,
            'hover:bg-zinc-100 dark:hover:bg-zinc-700'
          )}
        >
          {state.isOpen ? (
            <ChevronDownIcon className="h-4 w-4" />
          ) : (
            <ChevronUpIcon className="h-4 w-4" />
          )}
          <span>Terminals ({state.tabs.length})</span>
        </button>

        <div
          className="flex flex-1 items-center space-x-1 overflow-x-auto"
          style={{ scrollbarWidth: 'thin' }}
        >
          {state.tabs.map(tabChip)}
        </div>
      </div>

      <div className="flex items-center space-x-2">
        <span className={cn('text-xs', theme.text.subtle)}>{state.tabs.length}/10 terminals</span>
        {state.isOpen && (
          <button
            onClick={() => setIsFullscreen((prev) => !prev)}
            aria-label={isFullscreen ? 'Exit full screen' : 'Full screen'}
            className={cn(
              'flex items-center justify-center rounded p-1.5 transition-colors',
              theme.text.standard,
              'hover:bg-zinc-100 dark:hover:bg-zinc-700'
            )}
          >
            {isFullscreen ? (
              <ArrowsPointingInIcon className="h-4 w-4" />
            ) : (
              <ArrowsPointingOutIcon className="h-4 w-4" />
            )}
          </button>
        )}
      </div>
    </div>
  );

  const mobileHeader = state.isOpen ? (
    <div
      className={cn(
        'flex flex-shrink-0 items-center gap-2 px-2',
        'border-b border-zinc-200 dark:border-zinc-700',
        'bg-zinc-50 dark:bg-zinc-800'
      )}
    >
      <button
        onClick={togglePanel}
        aria-label="Minimise terminals"
        className={cn(
          'flex min-h-[44px] min-w-[44px] items-center justify-center rounded transition-colors',
          theme.text.standard,
          'hover:bg-zinc-100 dark:hover:bg-zinc-700'
        )}
      >
        <ChevronDownIcon className="h-5 w-5" />
      </button>
      <div
        className="flex flex-1 items-center gap-1 overflow-x-auto py-1"
        style={{ scrollbarWidth: 'thin' }}
      >
        {state.tabs.map(tabChip)}
      </div>
      <span className={cn('flex-shrink-0 text-xs', theme.text.subtle)}>{state.tabs.length}/10</span>
    </div>
  ) : (
    <button
      onClick={togglePanel}
      aria-label="Open terminals"
      className={cn(
        'flex min-h-[44px] w-full flex-shrink-0 items-center justify-center gap-2 text-sm font-medium',
        theme.text.standard
      )}
    >
      <ChevronUpIcon className="h-4 w-4" />
      <span>Terminals ({state.tabs.length})</span>
    </button>
  );

  return (
    <div
      ref={panelRef}
      className={cn(
        'fixed flex flex-col bg-white dark:bg-zinc-900',
        isDesktop
          ? isFullscreen && state.isOpen
            ? 'inset-0 z-[60]'
            : cn(
                'bottom-0 right-0 z-40 border-t border-zinc-200 shadow-2xl dark:border-zinc-700',
                sidebarCollapsed ? 'left-16' : 'left-72'
              )
          : state.isOpen
            ? 'inset-x-0 top-0 z-[60] pt-[env(safe-area-inset-top)]'
            : cn(
                'inset-x-0 bottom-[calc(4rem+env(safe-area-inset-bottom))] z-40 shadow-2xl',
                'border-t border-zinc-200 dark:border-zinc-700'
              )
      )}
      style={
        isDesktop
          ? isFullscreen && state.isOpen
            ? undefined
            : {
                height: state.isOpen ? `${state.height}px` : '40px',
                transform: state.isOpen ? 'translateY(0)' : `translateY(calc(100% - 40px))`,
              }
          : state.isOpen
            ? { height: viewportHeight }
            : undefined
      }
    >
      {isDesktop && state.isOpen && !isFullscreen ? (
        <div
          className="absolute left-0 right-0 top-0 h-1 cursor-ns-resize hover:bg-teal-500"
          onMouseDown={() => setIsResizing(true)}
        />
      ) : null}

      {isDesktop ? desktopHeader : mobileHeader}

      <div className={cn('flex-1 overflow-hidden', !isDesktop && !state.isOpen && 'hidden')}>
        {terminals}
      </div>
    </div>
  );
};
