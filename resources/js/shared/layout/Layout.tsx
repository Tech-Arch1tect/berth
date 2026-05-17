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
  Bars3Icon,
  XMarkIcon,
  ClipboardDocumentListIcon,
  ArrowUpTrayIcon,
  ArrowPathIcon,
  ShieldExclamationIcon,
  CircleStackIcon,
  KeyIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
} from '@heroicons/react/24/outline';
import { useGetApiV1Version } from '../../api/generated/system/system';
import { useAuth } from '../auth/auth-context';
import { userIsAdmin } from '../auth/roles';
import { useDarkMode } from '../hooks/useDarkMode';
import { GlobalOperationsTracker } from '../../features/operations/components/GlobalOperationsTracker';
import { useTerminalPanel } from '../../features/terminal/contexts/TerminalPanelContext';
import { theme } from '../theme';
import { cn } from '../utils/cn';
import { StorageManager } from '../utils/storage';

interface LayoutProps {
  children: ReactNode;
}

export default function Layout({ children }: LayoutProps) {
  const { user, logout } = useAuth();
  const { pathname } = useLocation();
  const { isDark, toggleDarkMode } = useDarkMode();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() =>
    StorageManager.sidebar.isCollapsed()
  );
  const terminalPanel = useTerminalPanel();

  const { data: versionResponse } = useGetApiV1Version();
  const appVersion = versionResponse?.data?.version ?? 'dev';

  const toggleSidebarCollapse = () => {
    const newValue = !sidebarCollapsed;
    setSidebarCollapsed(newValue);
    StorageManager.sidebar.setCollapsed(newValue);
  };

  const isAdmin = userIsAdmin(user);

  const navigation = [
    { name: 'Dashboard', href: '/' as const, icon: HomeIcon },
    { name: 'All Stacks', href: '/stacks' as const, icon: CircleStackIcon },
    {
      name: 'Operation Logs',
      href: '/operation-logs' as const,
      icon: ClipboardDocumentListIcon,
    },
    ...(isAdmin
      ? [
          { name: 'Servers', href: '/admin/servers' as const, icon: ServerIcon },
          { name: 'Agent Updates', href: '/admin/agent-update' as const, icon: ArrowPathIcon },
          { name: 'Users', href: '/admin/users' as const, icon: UsersIcon },
          { name: 'Roles', href: '/admin/roles' as const, icon: ShieldCheckIcon },
          { name: 'Migration', href: '/admin/migration' as const, icon: ArrowUpTrayIcon },
          {
            name: 'Admin Operation Logs',
            href: '/admin/operation-logs' as const,
            icon: ClipboardDocumentListIcon,
          },
          {
            name: 'Security Audit Logs',
            href: '/admin/security-audit-logs' as const,
            icon: ShieldExclamationIcon,
          },
        ]
      : []),
  ];

  const userNavigation = [
    { name: 'Profile', href: '/profile' as const, icon: UserCircleIcon },
    { name: 'Sessions', href: '/sessions' as const, icon: ComputerDesktopIcon },
    { name: 'API Keys', href: '/api-keys' as const, icon: KeyIcon },
  ];

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

  return (
    <div className={theme.layout.appShell}>
      {sidebarOpen && (
        <div className={theme.overlays.sidebarBackdrop} onClick={() => setSidebarOpen(false)} />
      )}

      <div
        className={cn(
          'fixed inset-y-0 left-0 z-50 border-r shadow-xl transition-all duration-300 ease-in-out lg:translate-x-0 dark:shadow-black/20',
          theme.surface.sidebar,
          sidebarOpen ? 'translate-x-0' : '-translate-x-full',
          sidebarCollapsed ? 'lg:w-16' : 'lg:w-72',
          'w-72'
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
                  'flex h-10 w-10 items-center justify-center rounded-xl flex-shrink-0',
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
            <button
              onClick={() => setSidebarOpen(false)}
              className={cn('lg:hidden', theme.buttons.ghost)}
              aria-label="Close navigation"
            >
              <XMarkIcon className={cn('h-5 w-5', theme.text.subtle)} />
            </button>
          </div>

          <div className={cn('flex-1 space-y-2 py-6', sidebarCollapsed ? 'lg:px-2' : 'px-4')}>
            {navigation.map((item) => {
              const Icon = item.icon;
              const isActive = pathname === item.href;
              return (
                <Link
                  key={item.name}
                  to={item.href}
                  className={cn(
                    theme.navigation.itemBase,
                    isActive ? theme.navigation.itemActive : theme.navigation.itemInactive,
                    sidebarCollapsed && 'lg:justify-center lg:px-0'
                  )}
                  onClick={() => setSidebarOpen(false)}
                  title={sidebarCollapsed ? item.name : undefined}
                >
                  <Icon
                    className={cn(
                      theme.navigation.iconBase,
                      isActive ? theme.navigation.iconActive : theme.navigation.iconInactive,
                      sidebarCollapsed && 'lg:mr-0'
                    )}
                  />
                  <span className={cn(sidebarCollapsed && 'lg:hidden')}>{item.name}</span>
                  {isActive && !sidebarCollapsed && <div className={theme.navigation.indicator} />}
                </Link>
              );
            })}
          </div>

          <div
            className={cn(
              'hidden lg:flex border-t dark:border-zinc-800',
              sidebarCollapsed ? 'justify-center px-2 py-3' : 'justify-end px-4 py-3'
            )}
          >
            <button
              onClick={toggleSidebarCollapse}
              className={cn(
                'p-2 rounded-lg transition-colors',
                'hover:bg-zinc-100 dark:hover:bg-zinc-800',
                theme.text.muted
              )}
              title={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
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
                'mb-4 rounded-xl',
                sidebarCollapsed ? 'lg:px-0 lg:py-0 lg:flex lg:justify-center' : 'px-3 py-2',
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
                <div className={cn(sidebarCollapsed && 'lg:hidden')}>
                  <p className={cn('text-sm font-semibold', theme.text.strong)}>{user.username}</p>
                  <p className={cn('text-xs', theme.text.subtle)}>{user.email}</p>
                </div>
              </div>
            </div>
            <div className="space-y-2">
              {userNavigation.map((item) => {
                const Icon = item.icon;
                const isActive = pathname === item.href;
                return (
                  <Link
                    key={item.name}
                    to={item.href}
                    className={cn(
                      theme.navigation.itemBase,
                      isActive ? theme.navigation.itemActive : theme.navigation.itemInactive,
                      sidebarCollapsed && 'lg:justify-center lg:px-0'
                    )}
                    onClick={() => setSidebarOpen(false)}
                    title={sidebarCollapsed ? item.name : undefined}
                  >
                    <Icon
                      className={cn(
                        theme.navigation.iconBase,
                        isActive ? theme.navigation.iconActive : theme.navigation.iconInactive,
                        sidebarCollapsed && 'lg:mr-0'
                      )}
                    />
                    <span className={cn(sidebarCollapsed && 'lg:hidden')}>{item.name}</span>
                  </Link>
                );
              })}
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
          'transition-[padding-left] duration-300 flex flex-col',
          sidebarCollapsed ? 'lg:pl-16' : 'lg:pl-72'
        )}
        style={{
          height:
            terminalPanel.state.isOpen && terminalPanel.state.tabs.length > 0
              ? `calc(100vh - ${terminalPanel.state.height}px)`
              : '100vh',
        }}
      >
        <button
          className={cn(
            'lg:hidden fixed top-3 left-3 z-40 p-2 rounded-lg',
            'bg-white dark:bg-zinc-800 shadow-md border border-zinc-200 dark:border-zinc-700',
            theme.buttons.ghost
          )}
          onClick={() => setSidebarOpen(true)}
          aria-label="Open navigation"
        >
          <Bars3Icon className="h-5 w-5 text-zinc-600 dark:text-zinc-300" />
        </button>

        <main className="flex-1 overflow-hidden flex flex-col h-full">{children}</main>
      </div>

      <GlobalOperationsTracker />
    </div>
  );
}
