import React, { useRef, useState, useEffect } from 'react';
import { ChevronDownIcon, ChevronUpIcon, XMarkIcon } from '@heroicons/react/24/outline';
import { useTerminalPanel } from '../../contexts/TerminalPanelContext';
import { Terminal } from './Terminal';
import { cn } from '../../utils/cn';
import { theme } from '../../theme';
import { StorageManager } from '../../utils/storage';

export const TerminalPanel: React.FC = () => {
  const { state, closeTerminal, setActiveTab, togglePanel, setPanelHeight } = useTerminalPanel();
  const [isResizing, setIsResizing] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() =>
    StorageManager.sidebar.isCollapsed()
  );
  const panelRef = useRef<HTMLDivElement>(null);
  const tabsContainerRef = useRef<HTMLDivElement>(null);

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

  return (
    <div
      ref={panelRef}
      className={cn(
        'fixed bottom-0 left-0 right-0 z-40 shadow-2xl',
        'border-t border-zinc-200 dark:border-zinc-700',
        'bg-white dark:bg-zinc-900',
        sidebarCollapsed ? 'lg:left-16' : 'lg:left-72'
      )}
      style={{
        height: state.isOpen ? `${state.height}px` : '40px',
        transform: state.isOpen ? 'translateY(0)' : `translateY(calc(100% - 40px))`,
      }}
    >
      {/* Resize handle */}
      {state.isOpen && (
        <div
          className="absolute left-0 right-0 top-0 h-1 cursor-ns-resize hover:bg-teal-500"
          onMouseDown={() => setIsResizing(true)}
        />
      )}

      {/* Panel header with tabs */}
      <div
        className={cn(
          'flex h-10 items-center justify-between px-4',
          'border-b border-zinc-200 dark:border-zinc-700',
          'bg-zinc-50 dark:bg-zinc-800'
        )}
      >
        <div className="flex flex-1 items-center space-x-2 overflow-hidden">
          <button
            onClick={togglePanel}
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

          {/* Tab list */}
          <div
            ref={tabsContainerRef}
            className="flex flex-1 items-center space-x-1 overflow-x-auto"
            style={{ scrollbarWidth: 'thin' }}
          >
            {state.tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  'group flex items-center space-x-2 whitespace-nowrap rounded px-3 py-1 text-xs font-medium transition-colors',
                  tab.id === state.activeTabId
                    ? 'bg-teal-50 text-teal-700 dark:bg-teal-900/20 dark:text-teal-300'
                    : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200 hover:text-zinc-900 dark:bg-zinc-800/50 dark:text-zinc-400 dark:hover:bg-zinc-700/50 dark:hover:text-zinc-200'
                )}
              >
                <span className="max-w-[150px] truncate" title={`${tab.stackname}/${tab.label}`}>
                  {tab.label}
                </span>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    closeTerminal(tab.id);
                  }}
                  className={cn(
                    'rounded p-0.5 opacity-0 transition-opacity group-hover:opacity-100',
                    'hover:bg-zinc-200 dark:hover:bg-zinc-600'
                  )}
                  aria-label={`Close ${tab.label}`}
                >
                  <XMarkIcon className="h-3 w-3" />
                </button>
              </button>
            ))}
          </div>
        </div>

        {/* Panel controls */}
        <div className="flex items-center space-x-2">
          <span className={cn('text-xs', theme.text.subtle)}>{state.tabs.length}/10 terminals</span>
        </div>
      </div>

      {/* Panel content */}
      <div className="h-[calc(100%-40px)] overflow-hidden">
        {state.tabs.map((tab) => (
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
        ))}
      </div>
    </div>
  );
};
