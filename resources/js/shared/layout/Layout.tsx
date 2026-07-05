import { Link, useLocation } from '@tanstack/react-router';
import { ReactNode, useState } from 'react';
import {
  SunIcon,
  MoonIcon,
  HomeIcon,
  ServerIcon,
  UsersIcon,
  ShieldCheckIcon,
  UserCircleIcon,
  ComputerDesktopIcon,
  ArrowLeftOnRectangleIcon,
  XMarkIcon,
  ClipboardDocumentListIcon,
  ArrowUpTrayIcon,
  ArrowPathIcon,
  ShieldExclamationIcon,
  CircleStackIcon,
  KeyIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  EllipsisHorizontalIcon,
} from '@heroicons/react/24/outline';
import { useGetApiV1Version } from '../../api/generated/system/system';
import { useAuth } from '../auth/auth-context';
import { userIsAdmin } from '../auth/roles';
import { useDarkMode } from '../hooks/useDarkMode';
import { useOperationsContext } from '../../features/operations/contexts/OperationsContext';
import {
  OperationsDock,
  OPERATIONS_DOCK_STRIP_HEIGHT,
  OPERATIONS_DOCK_EXPANDED_HEIGHT,
} from '../../features/operations/components/OperationsDock';
import { useTerminalPanel } from '../../features/terminal/contexts/TerminalPanelContext';
import { useIsDesktop } from '../hooks/useMediaQuery';
import { theme } from '../theme';
import { cn } from '../utils/cn';
import { StorageManager } from '../utils/storage';

interface LayoutProps {
  children: ReactNode;
}

interface NavItem {
  name: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  isActive: (pathname: string) => boolean;
}

const primaryNavigation: NavItem[] = [
  { name: 'Dashboard', href: '/', icon: HomeIcon, isActive: (p) => p === '/' },
  {
    name: 'Stacks',
    href: '/stacks',
    icon: CircleStackIcon,
    isActive: (p) => p.startsWith('/stacks') || p.startsWith('/servers'),
  },
  {
    name: 'Activity',
    href: '/operation-logs',
    icon: ClipboardDocumentListIcon,
    isActive: (p) => p.startsWith('/operation-logs'),
  },
];

const accountNavigation: NavItem[] = [
  { name: 'Profile', href: '/profile', icon: UserCircleIcon, isActive: (p) => p === '/profile' },
  {
    name: 'Sessions',
    href: '/sessions',
    icon: ComputerDesktopIcon,
    isActive: (p) => p === '/sessions',
  },
  {
    name: 'API Keys',
    href: '/api-keys',
    icon: KeyIcon,
    isActive: (p) => p.startsWith('/api-keys'),
  },
];

const adminNavigation: NavItem[] = [
  {
    name: 'Servers',
    href: '/admin/servers',
    icon: ServerIcon,
    isActive: (p) => p.startsWith('/admin/servers'),
  },
  {
    name: 'Users',
    href: '/admin/users',
    icon: UsersIcon,
    isActive: (p) => p.startsWith('/admin/users'),
  },
  {
    name: 'Roles',
    href: '/admin/roles',
    icon: ShieldCheckIcon,
    isActive: (p) => p.startsWith('/admin/roles'),
  },
  {
    name: 'Migration',
    href: '/admin/migration',
    icon: ArrowUpTrayIcon,
    isActive: (p) => p.startsWith('/admin/migration'),
  },
  {
    name: 'Operation Logs',
    href: '/admin/operation-logs',
    icon: ClipboardDocumentListIcon,
    isActive: (p) => p.startsWith('/admin/operation-logs'),
  },
  {
    name: 'Security Audit',
    href: '/admin/security-audit-logs',
    icon: ShieldExclamationIcon,
    isActive: (p) => p.startsWith('/admin/security-audit-logs'),
  },
  {
    name: 'Agent Updates',
    href: '/admin/agent-update',
    icon: ArrowPathIcon,
    isActive: (p) => p.startsWith('/admin/agent-update'),
  },
];

const TAB_BAR_CLEARANCE = 'pb-[calc(4rem+env(safe-area-inset-bottom))] lg:pb-0';

export default function Layout({ children }: LayoutProps) {
  const { user, logout } = useAuth();
  const { pathname } = useLocation();
  const { isDark, toggleDarkMode } = useDarkMode();
  const [moreOpen, setMoreOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() =>
    StorageManager.sidebar.isCollapsed()
  );
  const terminalPanel = useTerminalPanel();
  const isDesktop = useIsDesktop();
  const { operations, dockState, setDockState } = useOperationsContext();
  const runningCount = operations.filter((op) => op.is_incomplete).length;
  const completedCount = operations.length - runningCount;
  const opsBadge =
    runningCount > 0
      ? { count: runningCount, live: true }
      : completedCount > 0
        ? { count: completedCount, live: false }
        : undefined;

  const [prevRunningCount, setPrevRunningCount] = useState(0);
  if (runningCount !== prevRunningCount) {
    setPrevRunningCount(runningCount);
    if (runningCount > prevRunningCount) {
      setDockState('expanded');
    }
  }

  const dockExpanded = dockState === 'expanded';
  const dockVisible = operations.length > 0 && dockState !== 'hidden';
  const dockReservedHeight = dockVisible
    ? dockExpanded
      ? OPERATIONS_DOCK_EXPANDED_HEIGHT
      : OPERATIONS_DOCK_STRIP_HEIGHT
    : 0;
  const terminalReservedHeight =
    terminalPanel.state.isOpen && terminalPanel.state.tabs.length > 0
      ? terminalPanel.state.height
      : 0;
  const dockBottomOffset = isDesktop
    ? `${terminalReservedHeight}px`
    : `calc(4rem + env(safe-area-inset-bottom) + ${terminalReservedHeight}px)`;

  const { data: versionResponse } = useGetApiV1Version();
  const appVersion = versionResponse?.data?.version ?? 'dev';

  const toggleSidebarCollapse = () => {
    const newValue = !sidebarCollapsed;
    setSidebarCollapsed(newValue);
    StorageManager.sidebar.setCollapsed(newValue);
  };

  const isAdmin = userIsAdmin(user);
  const adminItems = isAdmin ? adminNavigation : [];
  const moreItems = [...accountNavigation, ...adminItems];
  const moreIsActive = moreItems.some((item) => item.isActive(pathname));

  const handleLogout = () => {
    void logout();
  };

  if (!user || pathname === '/auth/totp/verify') {
    return (
      <div className={theme.layout.authShell}>
        <div className="flex min-h-screen flex-col justify-center py-12 sm:px-6 lg:px-8">
          <div className="sm:mx-auto sm:w-full sm:max-w-md">
            <div className="text-center">
              <div
                className={cn(
                  'mx-auto mb-8 flex h-16 w-16 items-center justify-center rounded-2xl',
                  theme.brand.accent
                )}
              >
                <ServerIcon className="h-8 w-8" />
              </div>
              <h1 className={cn('text-3xl font-bold', theme.brand.titleColor)}>Berth</h1>
              <p className={cn('mt-2 text-sm', theme.text.muted)}>
                Docker Stack Management Platform
              </p>
            </div>
          </div>
          <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
            <div className={theme.cards.auth}>{children}</div>
          </div>
        </div>
      </div>
    );
  }

  const sidebarLink = (item: NavItem, badge?: { count: number; live: boolean }) => {
    const Icon = item.icon;
    const isActive = item.isActive(pathname);
    return (
      <Link
        key={item.name}
        to={item.href}
        className={cn(
          theme.navigation.itemBase,
          isActive ? theme.navigation.itemActive : theme.navigation.itemInactive,
          sidebarCollapsed && 'lg:justify-center lg:px-0'
        )}
        title={sidebarCollapsed ? item.name : undefined}
      >
        <span className="relative">
          <Icon
            className={cn(
              theme.navigation.iconBase,
              isActive ? theme.navigation.iconActive : theme.navigation.iconInactive,
              sidebarCollapsed && 'lg:mr-0'
            )}
          />
          {badge && sidebarCollapsed && (
            <span
              className={cn(
                'absolute -right-1 -top-1 hidden h-2.5 w-2.5 rounded-full lg:block',
                badge.live ? 'animate-pulse bg-teal-500' : 'bg-zinc-400 dark:bg-zinc-500'
              )}
            />
          )}
        </span>
        <span className={cn(sidebarCollapsed && 'lg:hidden')}>{item.name}</span>
        {badge && (
          <span
            className={cn(
              'ml-auto flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold tabular-nums',
              badge.live
                ? 'bg-teal-100 text-teal-700 dark:bg-teal-900/40 dark:text-teal-300'
                : 'bg-zinc-200 text-zinc-600 dark:bg-zinc-700 dark:text-zinc-300',
              sidebarCollapsed && 'lg:hidden'
            )}
          >
            {badge.live && <ArrowPathIcon className="h-3 w-3 animate-spin" />}
            {badge.count}
          </span>
        )}
        {isActive && !sidebarCollapsed && !badge && <div className={theme.navigation.indicator} />}
      </Link>
    );
  };

  const sidebarGroupHeader = (label: string) =>
    sidebarCollapsed ? (
      <div className="my-2 border-t border-zinc-200 dark:border-zinc-800" />
    ) : (
      <p
        className={cn(
          'px-3 pb-1 pt-4 text-xs font-semibold uppercase tracking-wider',
          theme.text.subtle
        )}
      >
        {label}
      </p>
    );

  const moreLink = (item: NavItem) => {
    const Icon = item.icon;
    const isActive = item.isActive(pathname);
    return (
      <Link
        key={item.name}
        to={item.href}
        onClick={() => setMoreOpen(false)}
        className={cn(
          'flex min-h-[44px] items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium',
          isActive
            ? 'bg-teal-50 text-teal-700 dark:bg-teal-900/20 dark:text-teal-300'
            : cn(theme.text.standard, 'hover:bg-zinc-100 dark:hover:bg-zinc-800')
        )}
      >
        <Icon className="h-5 w-5 flex-shrink-0" />
        {item.name}
      </Link>
    );
  };

  const mobileTab = (item: NavItem, badge?: { count: number; live: boolean }) => {
    const Icon = item.icon;
    const isActive = item.isActive(pathname);
    return (
      <Link
        key={item.name}
        to={item.href}
        onClick={() => setMoreOpen(false)}
        className={cn(
          'flex min-h-[56px] flex-col items-center justify-center gap-0.5 pt-1.5 pb-1',
          isActive && !moreOpen
            ? 'text-teal-600 dark:text-teal-400'
            : 'text-zinc-500 dark:text-zinc-400'
        )}
        aria-current={isActive && !moreOpen ? 'page' : undefined}
      >
        <span className="relative">
          <Icon className="h-6 w-6" />
          {badge && (
            <span
              className={cn(
                'absolute -right-2.5 -top-1 flex h-4 min-w-[1rem] items-center justify-center rounded-full px-1 text-[10px] font-semibold',
                badge.live
                  ? 'animate-pulse bg-teal-600 text-white'
                  : 'bg-zinc-400 text-white dark:bg-zinc-600 dark:text-zinc-100'
              )}
            >
              {badge.count}
            </span>
          )}
        </span>
        <span className="text-[11px] font-medium">{item.name}</span>
      </Link>
    );
  };

  return (
    <div className={theme.layout.appShell}>
      <div
        className={cn(
          'fixed inset-y-0 left-0 z-50 hidden border-r shadow-xl transition-all duration-300 ease-in-out lg:block dark:shadow-black/20',
          theme.surface.sidebar,
          sidebarCollapsed ? 'lg:w-16' : 'lg:w-72'
        )}
      >
        <div className="flex h-full flex-col">
          <div
            className={cn(
              'flex items-center border-b dark:border-zinc-800',
              sidebarCollapsed ? 'lg:justify-center lg:px-2 lg:py-4' : 'justify-between px-6 py-4'
            )}
          >
            <div
              className={cn(
                'flex items-center',
                sidebarCollapsed ? 'lg:justify-center' : 'space-x-3'
              )}
            >
              <div
                className={cn(
                  'flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl',
                  theme.brand.accent
                )}
              >
                <ServerIcon className="h-6 w-6" />
              </div>
              <div className={cn(sidebarCollapsed && 'lg:hidden')}>
                <h1 className={cn('text-xl font-bold', theme.brand.titleColor)}>Berth</h1>
                <p className={cn('text-xs', theme.text.subtle)}>{appVersion}</p>
              </div>
            </div>
          </div>

          <div
            className={cn(
              'flex-1 space-y-1 overflow-y-auto py-6',
              sidebarCollapsed ? 'lg:px-2' : 'px-4'
            )}
          >
            {primaryNavigation.map((item) =>
              sidebarLink(item, item.name === 'Activity' ? opsBadge : undefined)
            )}
            {sidebarGroupHeader('Account')}
            {accountNavigation.map((item) => sidebarLink(item))}
            {adminItems.length > 0 && (
              <>
                {sidebarGroupHeader('Admin')}
                {adminItems.map((item) => sidebarLink(item))}
              </>
            )}
          </div>

          <div
            className={cn(
              'hidden border-t lg:flex dark:border-zinc-800',
              sidebarCollapsed ? 'justify-center px-2 py-3' : 'justify-end px-4 py-3'
            )}
          >
            <button
              onClick={toggleSidebarCollapse}
              className={cn(
                'rounded-lg p-2 transition-colors',
                'hover:bg-zinc-100 dark:hover:bg-zinc-800',
                theme.text.muted
              )}
              aria-label={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            >
              {sidebarCollapsed ? (
                <ChevronRightIcon className="h-5 w-5" />
              ) : (
                <ChevronLeftIcon className="h-5 w-5" />
              )}
            </button>
          </div>

          <div
            className={cn(
              'border-t dark:border-zinc-800',
              sidebarCollapsed ? 'lg:px-2 lg:py-4' : 'px-4 py-4'
            )}
          >
            <div
              className={cn(
                'mb-3 rounded-xl',
                sidebarCollapsed ? 'lg:flex lg:justify-center lg:px-0 lg:py-0' : 'px-3 py-2',
                !sidebarCollapsed && theme.surface.muted
              )}
            >
              <div
                className={cn(
                  'flex items-center',
                  sidebarCollapsed ? 'lg:justify-center' : 'space-x-3'
                )}
                title={sidebarCollapsed ? `${user.username} (${user.email})` : undefined}
              >
                <div className={cn(theme.badges.userInitials, 'flex-shrink-0')}>
                  {user.username.charAt(0).toUpperCase()}
                </div>
                <div className={cn('min-w-0', sidebarCollapsed && 'lg:hidden')}>
                  <p className={cn('truncate text-sm font-semibold', theme.text.strong)}>
                    {user.username}
                  </p>
                  <p className={cn('truncate text-xs', theme.text.subtle)}>{user.email}</p>
                </div>
              </div>
            </div>
            <div className="space-y-1">
              <button
                onClick={toggleDarkMode}
                className={cn(
                  'flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                  sidebarCollapsed ? 'lg:justify-center lg:px-0' : 'justify-center',
                  theme.text.muted,
                  'hover:bg-zinc-100 dark:hover:bg-zinc-800'
                )}
                title={sidebarCollapsed ? (isDark ? 'Dark mode' : 'Light mode') : undefined}
              >
                {isDark ? (
                  <MoonIcon className={cn('h-5 w-5', sidebarCollapsed && 'lg:mr-0')} />
                ) : (
                  <SunIcon className={cn('h-5 w-5', sidebarCollapsed && 'lg:mr-0')} />
                )}
                <span className={cn(sidebarCollapsed && 'lg:hidden')}>
                  {isDark ? 'Dark' : 'Light'}
                </span>
              </button>
              <button
                onClick={handleLogout}
                className={cn(
                  'flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                  sidebarCollapsed ? 'lg:justify-center lg:px-0' : 'justify-center',
                  theme.text.muted,
                  'hover:bg-zinc-100 dark:hover:bg-zinc-800'
                )}
                title={sidebarCollapsed ? 'Log out' : undefined}
              >
                <ArrowLeftOnRectangleIcon
                  className={cn('h-5 w-5', sidebarCollapsed && 'lg:mr-0')}
                />
                <span className={cn(sidebarCollapsed && 'lg:hidden')}>Log out</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      <div
        className={cn(
          'flex flex-col transition-[padding-left] duration-300',
          sidebarCollapsed ? 'lg:pl-16' : 'lg:pl-72',
          TAB_BAR_CLEARANCE
        )}
        style={{
          height: `calc(100vh - ${terminalReservedHeight + dockReservedHeight}px)`,
        }}
      >
        <main className="flex h-full flex-1 flex-col overflow-hidden">{children}</main>
      </div>

      {dockVisible && (
        <OperationsDock
          expanded={dockExpanded}
          onToggleExpanded={() => setDockState(dockExpanded ? 'collapsed' : 'expanded')}
          onDismiss={() => setDockState('hidden')}
          className={cn(sidebarCollapsed ? 'lg:left-16' : 'lg:left-72')}
          style={{ bottom: dockBottomOffset }}
        />
      )}

      {moreOpen && (
        <div className="fixed inset-0 z-[70] lg:hidden">
          <button
            type="button"
            aria-label="Close menu"
            onClick={() => setMoreOpen(false)}
            className="absolute inset-0 bg-black/40"
          />
          <div
            className={cn(
              'absolute inset-x-0 bottom-0 flex max-h-[85dvh] flex-col rounded-t-2xl shadow-xl',
              'bg-white dark:bg-zinc-900'
            )}
          >
            <div className="flex flex-shrink-0 items-center justify-between border-b border-zinc-200 px-4 py-3 dark:border-zinc-800">
              <div className="flex items-center gap-3">
                <div className={cn(theme.badges.userInitials, 'flex-shrink-0')}>
                  {user.username.charAt(0).toUpperCase()}
                </div>
                <div className="min-w-0">
                  <p className={cn('truncate text-sm font-semibold', theme.text.strong)}>
                    {user.username}
                  </p>
                  <p className={cn('truncate text-xs', theme.text.subtle)}>{user.email}</p>
                </div>
              </div>
              <button
                type="button"
                aria-label="Close menu"
                onClick={() => setMoreOpen(false)}
                className="flex h-11 w-11 items-center justify-center rounded-lg text-zinc-500 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800"
              >
                <XMarkIcon className="h-5 w-5" />
              </button>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto p-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))]">
              <p
                className={cn(
                  'px-3 pb-1 pt-2 text-xs font-semibold uppercase tracking-wider',
                  theme.text.subtle
                )}
              >
                Account
              </p>
              {accountNavigation.map(moreLink)}

              {adminItems.length > 0 && (
                <>
                  <p
                    className={cn(
                      'px-3 pb-1 pt-4 text-xs font-semibold uppercase tracking-wider',
                      theme.text.subtle
                    )}
                  >
                    Admin
                  </p>
                  {adminItems.map(moreLink)}
                </>
              )}

              <div className="my-3 border-t border-zinc-200 dark:border-zinc-800" />
              <button
                onClick={toggleDarkMode}
                className={cn(
                  'flex w-full min-h-[44px] items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium',
                  theme.text.standard,
                  'hover:bg-zinc-100 dark:hover:bg-zinc-800'
                )}
              >
                {isDark ? <MoonIcon className="h-5 w-5" /> : <SunIcon className="h-5 w-5" />}
                {isDark ? 'Dark mode' : 'Light mode'}
              </button>
              <button
                onClick={handleLogout}
                className={cn(
                  'flex w-full min-h-[44px] items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium',
                  theme.text.standard,
                  'hover:bg-zinc-100 dark:hover:bg-zinc-800'
                )}
              >
                <ArrowLeftOnRectangleIcon className="h-5 w-5" />
                Log out
              </button>
              <p className={cn('px-3 pt-3 text-xs', theme.text.subtle)}>Berth {appVersion}</p>
            </div>
          </div>
        </div>
      )}

      <nav
        aria-label="Primary"
        className={cn(
          'fixed inset-x-0 bottom-0 z-50 border-t lg:hidden',
          'border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900',
          'pb-[env(safe-area-inset-bottom)]'
        )}
      >
        <div className="grid grid-cols-4">
          {mobileTab(primaryNavigation[0])}
          {mobileTab(primaryNavigation[1])}
          {mobileTab(primaryNavigation[2], opsBadge)}
          <button
            type="button"
            onClick={() => setMoreOpen((open) => !open)}
            aria-expanded={moreOpen}
            className={cn(
              'flex min-h-[56px] flex-col items-center justify-center gap-0.5 pt-1.5 pb-1',
              moreOpen || moreIsActive
                ? 'text-teal-600 dark:text-teal-400'
                : 'text-zinc-500 dark:text-zinc-400'
            )}
          >
            <EllipsisHorizontalIcon className="h-6 w-6" />
            <span className="text-[11px] font-medium">More</span>
          </button>
        </div>
      </nav>
    </div>
  );
}
