import React, { useState, useCallback, useEffect } from 'react';
import { cn } from '../../../utils/cn';
import { theme } from '../../../theme';

const SIDEBAR_MIN_WIDTH = 200;
const SIDEBAR_MAX_WIDTH_PERCENT = 40;
const SIDEBAR_DEFAULT_WIDTH = 280;
const SIDEBAR_STORAGE_KEY = 'berth-dashboard-sidebar-width';
const SIDEBAR_COLLAPSED_STORAGE_KEY = 'berth-dashboard-sidebar-collapsed';

interface DashboardLayoutProps {
  toolbar: React.ReactNode;
  sidebar: React.ReactNode;
  content: React.ReactNode;
  statusBar: React.ReactNode;
  sidebarTitle?: string;
}

export const DashboardLayout: React.FC<DashboardLayoutProps> = ({
  toolbar,
  sidebar,
  content,
  statusBar,
  sidebarTitle = 'Servers',
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
  const [isDragging, setIsDragging] = useState(false);
  const [startX, setStartX] = useState(0);
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

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsDragging(true);
    setStartX(e.clientX);
  }, []);

  const handleMouseMove = useCallback(
    (e: MouseEvent) => {
      if (!isDragging) return;

      const delta = e.clientX - startX;
      setSidebarWidth((prev) => {
        const maxWidth = containerWidth * (SIDEBAR_MAX_WIDTH_PERCENT / 100);
        const newWidth = prev + delta;
        return Math.min(Math.max(newWidth, SIDEBAR_MIN_WIDTH), maxWidth);
      });
      setStartX(e.clientX);
    },
    [isDragging, startX, containerWidth]
  );

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  useEffect(() => {
    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      document.body.style.userSelect = 'none';
      document.body.style.cursor = 'col-resize';
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      document.body.style.userSelect = '';
      document.body.style.cursor = '';
    };
  }, [isDragging, handleMouseMove, handleMouseUp]);

  const toggleSidebar = useCallback(() => {
    setSidebarCollapsed((prev) => !prev);
  }, []);

  const effectiveSidebarWidth = sidebarCollapsed ? 0 : sidebarWidth;

  return (
    <div
      ref={containerRef}
      className={cn('h-full flex flex-col overflow-hidden', theme.surface.panel)}
    >
      {/* Toolbar */}
      <div className="flex-shrink-0 border-b border-zinc-200 dark:border-zinc-800">{toolbar}</div>

      {/* Main content area */}
      <div className="flex-1 flex overflow-hidden">
        {/* Sidebar */}
        {!sidebarCollapsed && (
          <div
            className={cn(
              'flex-shrink-0 flex flex-col overflow-hidden',
              'bg-white dark:bg-zinc-900',
              'border-r border-zinc-200 dark:border-zinc-800'
            )}
            style={{ width: `${effectiveSidebarWidth}px` }}
          >
            <div
              className={cn(
                'flex-shrink-0 flex items-center justify-between px-3 py-2.5',
                'border-b border-zinc-200 dark:border-zinc-800',
                theme.surface.muted
              )}
            >
              <span className={cn('text-xs font-bold uppercase tracking-wider', theme.text.muted)}>
                {sidebarTitle}
              </span>
              <button
                onClick={toggleSidebar}
                className={cn(theme.buttons.icon, 'p-1')}
                title="Collapse sidebar"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M15 19l-7-7 7-7"
                  />
                </svg>
              </button>
            </div>
            <div className="flex-1 overflow-auto">{sidebar}</div>
          </div>
        )}

        {/* Resizable divider */}
        {!sidebarCollapsed && (
          <div
            className={cn(
              'flex-shrink-0 w-1 cursor-col-resize relative group',
              'bg-zinc-200 dark:bg-zinc-700',
              'hover:bg-teal-400 dark:hover:bg-teal-600',
              'transition-colors duration-150',
              isDragging && 'bg-teal-500 dark:bg-teal-500'
            )}
            onMouseDown={handleMouseDown}
          >
            <div className="absolute inset-y-0 -left-1 -right-1" />
          </div>
        )}

        {/* Collapse button when sidebar is collapsed */}
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

        {/* Content panel */}
        <div
          className={cn(
            'flex-1 flex flex-col overflow-hidden min-w-0',
            'bg-white dark:bg-zinc-900'
          )}
        >
          {content}
        </div>
      </div>

      {/* Status bar */}
      <div className="flex-shrink-0 border-t border-zinc-200 dark:border-zinc-800">{statusBar}</div>
    </div>
  );
};
