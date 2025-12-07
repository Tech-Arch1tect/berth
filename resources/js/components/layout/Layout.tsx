import { Link, usePage, router } from '@inertiajs/react';
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
  ShieldExclamationIcon,
  CircleStackIcon,
  KeyIcon,
} from '@heroicons/react/24/outline';
import { User } from '../../types';
import { useDarkMode } from '../../hooks/useDarkMode';
import { Toaster } from '../../utils/toast';
import { GlobalOperationsTracker } from '../operations/GlobalOperationsTracker';
import { useTerminalPanel } from '../../contexts/TerminalPanelContext';
import { theme } from '../../theme';
import { cn } from '../../utils/cn';

interface LayoutProps {
  children: ReactNode;
  fullWidth?: boolean;
}

export default function Layout({ children, fullWidth = false }: LayoutProps) {
  const { url, props } = usePage();
  const user = props.currentUser as User | undefined;
  const csrfToken = props.csrfToken as string | undefined;
  const { isDark, toggleDarkMode } = useDarkMode();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const terminalPanel = useTerminalPanel();

  const isAdmin = user?.roles?.some((role) => role.name === 'admin') || false;

  const navigation = [
    { name: 'Dashboard', href: '/', icon: HomeIcon },
    { name: 'All Stacks', href: '/stacks', icon: CircleStackIcon },
    {
      name: 'Operation Logs',
      href: '/operation-logs',
      icon: ClipboardDocumentListIcon,
    },
    ...(isAdmin
      ? [
          { name: 'Servers', href: '/admin/servers', icon: ServerIcon },
          { name: 'Users', href: '/admin/users', icon: UsersIcon },
          { name: 'Roles', href: '/admin/roles', icon: ShieldCheckIcon },
          { name: 'Migration', href: '/admin/migration', icon: ArrowUpTrayIcon },
          {
            name: 'Admin Operation Logs',
            href: '/admin/operation-logs',
            icon: ClipboardDocumentListIcon,
          },
          {
            name: 'Security Audit Logs',
            href: '/admin/security-audit-logs',
            icon: ShieldExclamationIcon,
          },
        ]
      : []),
  ];

  const userNavigation = [
    { name: 'Profile', href: '/profile', icon: UserCircleIcon },
    { name: 'Sessions', href: '/sessions', icon: ComputerDesktopIcon },
    { name: 'API Keys', href: '/api-keys', icon: KeyIcon },
  ];

  const handleLogout = () => {
    router.post(
      '/auth/logout',
      {},
      {
        headers: {
          'X-CSRF-Token': csrfToken || '',
        },
      }
    );
  };

  if (!user || url === '/auth/totp/verify') {
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
        <Toaster
          position="top-center"
          gutter={8}
          toastOptions={{
            duration: 4000,
            className: theme.toast.container,
          }}
        />
      </div>
    );
  }

  return (
    <div className={theme.layout.appShell}>
      {/* Mobile sidebar backdrop */}
      {sidebarOpen && (
        <div className={theme.overlays.sidebarBackdrop} onClick={() => setSidebarOpen(false)} />
      )}

      {/* Sidebar */}
      <div
        className={cn(
          'fixed inset-y-0 left-0 z-50 w-72 border-r shadow-xl transition-transform duration-300 ease-in-out lg:translate-x-0 dark:shadow-black/20',
          theme.surface.sidebar,
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        <div className="flex h-full flex-col">
          {/* Logo and close button */}
          <div className="flex items-center justify-between border-b px-6 py-4 dark:border-zinc-800">
            <div className="flex items-center space-x-3">
              <div
                className={cn(
                  'flex h-10 w-10 items-center justify-center rounded-xl',
                  theme.brand.accent
                )}
              >
                <ServerIcon className="h-6 w-6" />
              </div>
              <div>
                <h1 className={cn('text-xl font-bold', theme.brand.titleColor)}>Berth</h1>
                <p className={cn('text-xs', theme.text.subtle)}>v1.0.0</p>
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

          {/* Navigation */}
          <div className="flex-1 space-y-2 px-4 py-6">
            {navigation.map((item) => {
              const Icon = item.icon;
              const isActive = url === item.href;
              return (
                <Link
                  key={item.name}
                  href={item.href}
                  className={cn(
                    theme.navigation.itemBase,
                    isActive ? theme.navigation.itemActive : theme.navigation.itemInactive
                  )}
                  onClick={() => setSidebarOpen(false)}
                >
                  <Icon
                    className={cn(
                      theme.navigation.iconBase,
                      isActive ? theme.navigation.iconActive : theme.navigation.iconInactive
                    )}
                  />
                  {item.name}
                  {isActive && <div className={theme.navigation.indicator} />}
                </Link>
              );
            })}
          </div>

          {/* User section */}
          <div className="border-t px-4 py-4 dark:border-zinc-800">
            <div className={cn('mb-4 rounded-xl px-3 py-2', theme.surface.muted)}>
              <div className="flex items-center space-x-3">
                <div className={theme.badges.userInitials}>
                  {user.username.charAt(0).toUpperCase()}
                </div>
                <div>
                  <p className={cn('text-sm font-semibold', theme.text.strong)}>{user.username}</p>
                  <p className={cn('text-xs', theme.text.subtle)}>{user.email}</p>
                </div>
              </div>
            </div>
            <div className="space-y-2">
              {userNavigation.map((item) => {
                const Icon = item.icon;
                const isActive = url === item.href;
                return (
                  <Link
                    key={item.name}
                    href={item.href}
                    className={cn(
                      theme.navigation.itemBase,
                      isActive ? theme.navigation.itemActive : theme.navigation.itemInactive
                    )}
                    onClick={() => setSidebarOpen(false)}
                  >
                    <Icon
                      className={cn(
                        theme.navigation.iconBase,
                        isActive ? theme.navigation.iconActive : theme.navigation.iconInactive
                      )}
                    />
                    {item.name}
                  </Link>
                );
              })}
              <button
                onClick={handleLogout}
                className={cn(
                  'flex w-full items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                  theme.text.muted,
                  'hover:bg-zinc-100 dark:hover:bg-zinc-800'
                )}
              >
                <ArrowLeftOnRectangleIcon className="h-5 w-5" />
                Log out
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Main content area */}
      <div className={cn('lg:pl-72', fullWidth && 'h-screen flex flex-col')}>
        {/* Header - hidden for full-width layouts which have their own toolbar */}
        {fullWidth ? (
          /* Mobile menu button only for full-width layouts */
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
        ) : (
          <div className="sticky top-0 z-30 flex-shrink-0 border-b bg-white px-4 py-4 shadow-md dark:border-zinc-800 dark:bg-zinc-900 dark:shadow-black/10">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <button
                  className={cn('lg:hidden', theme.buttons.ghost)}
                  onClick={() => setSidebarOpen(true)}
                  aria-label="Open navigation"
                >
                  <Bars3Icon className={cn('h-6 w-6 text-slate-500 dark:text-slate-300')} />
                </button>
                <div>
                  <p className={cn('text-sm', theme.text.subtle)}>Welcome back</p>
                  <h2 className={cn('text-xl font-semibold', theme.text.strong)}>
                    {user.username}
                  </h2>
                </div>
              </div>
              <div className="flex items-center space-x-3">
                <button
                  onClick={toggleDarkMode}
                  className={cn(
                    'flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium transition-colors',
                    isDark
                      ? 'border-zinc-700 bg-zinc-800 text-white hover:bg-zinc-700'
                      : 'border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-100'
                  )}
                >
                  {isDark ? (
                    <>
                      <MoonIcon className="h-5 w-5" />
                      Dark
                    </>
                  ) : (
                    <>
                      <SunIcon className="h-5 w-5" />
                      Light
                    </>
                  )}
                </button>
                <div className="hidden sm:block">
                  <div className={cn('flex items-center space-x-2 text-sm', theme.text.subtle)}>
                    <div
                      className={cn('h-2 w-2 animate-pulse rounded-full', theme.badges.dot.success)}
                    />
                    <span>All systems operational</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        <main
          className={cn(
            'transition-[padding-bottom] duration-200',
            fullWidth ? 'flex-1 overflow-hidden' : 'px-4 py-8 sm:px-6 lg:px-10'
          )}
          style={{
            paddingBottom:
              !fullWidth && terminalPanel.state.isOpen && terminalPanel.state.tabs.length > 0
                ? `${terminalPanel.state.height + 32}px`
                : undefined,
          }}
        >
          {fullWidth ? children : <div className="space-y-6">{children}</div>}
        </main>
      </div>

      <GlobalOperationsTracker />
      <Toaster
        position="top-right"
        toastOptions={{
          duration: 4000,
          className: theme.toast.container,
        }}
      />
    </div>
  );
}

export function FullWidthLayout({ children }: { children: ReactNode }) {
  return <Layout fullWidth>{children}</Layout>;
}
