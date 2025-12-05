import React, { useState, useCallback, useEffect } from 'react';
import { cn } from '../../../utils/cn';
import { theme } from '../../../theme';
import { ResizableDivider } from './ResizableDivider';
import { SidebarPanel } from './SidebarPanel';
import { EditorPanel } from './EditorPanel';

const SIDEBAR_MIN_WIDTH = 200;
const SIDEBAR_MAX_WIDTH_PERCENT = 50;
const SIDEBAR_DEFAULT_WIDTH = 280;
const SIDEBAR_STORAGE_KEY = 'berth-file-manager-sidebar-width';
const SIDEBAR_COLLAPSED_STORAGE_KEY = 'berth-file-manager-sidebar-collapsed';

interface FileManagerLayoutProps {
  sidebar: React.ReactNode;
  editor: React.ReactNode;
  statusBar?: React.ReactNode;
  toolbar?: React.ReactNode;
}

export const FileManagerLayout: React.FC<FileManagerLayoutProps> = ({
  sidebar,
  editor,
  statusBar,
  toolbar,
}) => {
  const [sidebarWidth, setSidebarWidth] = useState(() => {
    const stored = localStorage.getItem(SIDEBAR_STORAGE_KEY);
    return stored ? parseInt(stored, 10) : SIDEBAR_DEFAULT_WIDTH;
  });

  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    const stored = localStorage.getItem(SIDEBAR_COLLAPSED_STORAGE_KEY);
    return stored === 'true';
  });

  const [containerWidth, setContainerWidth] = useState(0);
  const containerRef = React.useRef<HTMLDivElement>(null);

  useEffect(() => {
    const updateContainerWidth = () => {
      if (containerRef.current) {
        setContainerWidth(containerRef.current.offsetWidth);
      }
    };

    updateContainerWidth();
    window.addEventListener('resize', updateContainerWidth);
    return () => window.removeEventListener('resize', updateContainerWidth);
  }, []);

  useEffect(() => {
    localStorage.setItem(SIDEBAR_STORAGE_KEY, String(sidebarWidth));
  }, [sidebarWidth]);

  useEffect(() => {
    localStorage.setItem(SIDEBAR_COLLAPSED_STORAGE_KEY, String(sidebarCollapsed));
  }, [sidebarCollapsed]);

  const handleResize = useCallback(
    (delta: number) => {
      setSidebarWidth((prev) => {
        const maxWidth = containerWidth * (SIDEBAR_MAX_WIDTH_PERCENT / 100);
        const newWidth = prev + delta;
        return Math.min(Math.max(newWidth, SIDEBAR_MIN_WIDTH), maxWidth);
      });
    },
    [containerWidth]
  );

  const toggleSidebar = useCallback(() => {
    setSidebarCollapsed((prev) => !prev);
  }, []);

  const effectiveSidebarWidth = sidebarCollapsed ? 0 : sidebarWidth;

  return (
    <div
      ref={containerRef}
      className={cn('h-full flex flex-col overflow-hidden', theme.surface.panel)}
    >
      {toolbar && (
        <div className="flex-shrink-0 border-b border-zinc-200 dark:border-zinc-800">{toolbar}</div>
      )}

      <div className="flex-1 flex overflow-hidden">
        <SidebarPanel
          width={effectiveSidebarWidth}
          collapsed={sidebarCollapsed}
          onToggle={toggleSidebar}
        >
          {sidebar}
        </SidebarPanel>

        {!sidebarCollapsed && <ResizableDivider onResize={handleResize} />}

        {sidebarCollapsed && (
          <button
            onClick={toggleSidebar}
            className={cn(
              'flex-shrink-0 w-6 flex items-center justify-center',
              'bg-zinc-100 dark:bg-zinc-800',
              'border-r border-zinc-200 dark:border-zinc-700',
              'hover:bg-zinc-200 dark:hover:bg-zinc-700',
              'transition-colors cursor-pointer'
            )}
            title="Expand sidebar"
          >
            <svg
              className="w-4 h-4 text-zinc-500 dark:text-zinc-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
        )}

        <EditorPanel>{editor}</EditorPanel>
      </div>

      {statusBar && (
        <div className="flex-shrink-0 border-t border-zinc-200 dark:border-zinc-800">
          {statusBar}
        </div>
      )}
    </div>
  );
};
