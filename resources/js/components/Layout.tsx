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
  LinkIcon,
  ShieldExclamationIcon,
} from '@heroicons/react/24/outline';
import { User } from '../types';
import { useDarkMode } from '../hooks/useDarkMode';
import { Toaster } from '../utils/toast';

interface LayoutProps {
  children: ReactNode;
}

export default function Layout({ children }: LayoutProps) {
  const { url, props } = usePage();
  const user = props.currentUser as User | undefined;
  const csrfToken = props.csrfToken as string | undefined;
  const { isDark, toggleDarkMode } = useDarkMode();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const isAdmin = user?.roles?.some((role) => role.name === 'admin') || false;

  const navigation = [
    { name: 'Dashboard', href: '/', icon: HomeIcon },
    {
      name: 'Operation Logs',
      href: '/operation-logs',
      icon: ClipboardDocumentListIcon,
    },
    {
      name: 'Webhooks',
      href: '/webhooks',
      icon: LinkIcon,
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
            name: 'Admin Webhooks',
            href: '/admin/webhooks',
            icon: LinkIcon,
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
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-100 dark:from-slate-900 dark:via-slate-800 dark:to-slate-900">
        <div className="min-h-screen flex flex-col justify-center py-12 sm:px-6 lg:px-8">
          <div className="sm:mx-auto sm:w-full sm:max-w-md">
            <div className="text-center">
              <div className="mx-auto w-16 h-16 bg-gradient-to-r from-blue-600 to-purple-600 rounded-2xl flex items-center justify-center mb-8">
                <ServerIcon className="w-8 h-8 text-white" />
              </div>
              <h1 className="text-3xl font-bold bg-gradient-to-r from-slate-800 to-slate-600 dark:from-white dark:to-slate-300 bg-clip-text text-transparent">
                Berth
              </h1>
              <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
                Docker Stack Management Platform
              </p>
            </div>
          </div>
          <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
            <div className="bg-white/60 dark:bg-slate-800/60 backdrop-blur-xl py-8 px-6 shadow-xl rounded-2xl border border-white/20 dark:border-slate-700/50 sm:px-8">
              {children}
            </div>
          </div>
        </div>
        <Toaster
          position="top-center"
          gutter={8}
          toastOptions={{
            duration: 4000,
            className: 'backdrop-blur-sm',
          }}
        />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50/50 dark:bg-slate-900">
      {/* Mobile sidebar backdrop */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-slate-900/20 backdrop-blur-sm lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <div
        className={`fixed inset-y-0 left-0 z-50 w-72 bg-white/90 dark:bg-slate-900/90 backdrop-blur-xl border-r border-slate-200/50 dark:border-slate-800/50 transition-transform duration-300 ease-in-out ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        } lg:translate-x-0`}
      >
        <div className="flex h-full flex-col">
          {/* Logo and close button */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200/50 dark:border-slate-800/50">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-gradient-to-r from-blue-600 to-purple-600 rounded-xl flex items-center justify-center">
                <ServerIcon className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-bold bg-gradient-to-r from-slate-800 to-slate-600 dark:from-white dark:to-slate-300 bg-clip-text text-transparent">
                  Berth
                </h1>
                <p className="text-xs text-slate-500 dark:text-slate-400">v1.0.0</p>
              </div>
            </div>
            <button
              onClick={() => setSidebarOpen(false)}
              className="lg:hidden p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            >
              <XMarkIcon className="w-5 h-5 text-slate-500" />
            </button>
          </div>

          {/* Navigation */}
          <div className="flex-1 px-4 py-6 space-y-2">
            {navigation.map((item) => {
              const Icon = item.icon;
              const isActive = url === item.href;
              return (
                <Link
                  key={item.name}
                  href={item.href}
                  className={`group flex items-center px-3 py-2.5 text-sm font-medium rounded-xl transition-all duration-200 ${
                    isActive
                      ? 'bg-gradient-to-r from-blue-500/10 to-purple-500/10 text-blue-600 dark:text-blue-400 shadow-sm border border-blue-200/20 dark:border-blue-800/20'
                      : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100/70 dark:hover:bg-slate-800/50 hover:text-slate-900 dark:hover:text-white'
                  }`}
                  onClick={() => setSidebarOpen(false)}
                >
                  <Icon
                    className={`mr-3 h-5 w-5 transition-colors ${
                      isActive
                        ? 'text-blue-600 dark:text-blue-400'
                        : 'text-slate-500 group-hover:text-slate-700 dark:group-hover:text-slate-300'
                    }`}
                  />
                  {item.name}
                  {isActive && (
                    <div className="ml-auto w-2 h-2 bg-blue-600 dark:bg-blue-400 rounded-full" />
                  )}
                </Link>
              );
            })}
          </div>

          {/* User section */}
          <div className="border-t border-slate-200/50 dark:border-slate-800/50 px-4 py-4">
            <div className="mb-4 px-3 py-2 bg-slate-50/70 dark:bg-slate-800/50 rounded-xl">
              <div className="flex items-center space-x-3">
                <div className="w-8 h-8 bg-gradient-to-r from-emerald-400 to-blue-500 rounded-lg flex items-center justify-center">
                  <span className="text-white text-sm font-semibold">
                    {user.username.charAt(0).toUpperCase()}
                  </span>
                </div>
                <div>
                  <p className="text-sm font-medium text-slate-900 dark:text-white">
                    {user.username}
                  </p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    {isAdmin ? 'Administrator' : 'User'}
                  </p>
                </div>
              </div>
            </div>

            <div className="space-y-1">
              {userNavigation.map((item) => {
                const Icon = item.icon;
                const isActive = url === item.href;
                return (
                  <Link
                    key={item.name}
                    href={item.href}
                    className={`group flex items-center px-3 py-2 text-sm font-medium rounded-lg transition-all duration-200 ${
                      isActive
                        ? 'bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white'
                        : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100/70 dark:hover:bg-slate-800/50 hover:text-slate-900 dark:hover:text-white'
                    }`}
                    onClick={() => setSidebarOpen(false)}
                  >
                    <Icon className="mr-3 h-4 w-4" />
                    {item.name}
                  </Link>
                );
              })}

              <button
                onClick={toggleDarkMode}
                className="group flex items-center w-full px-3 py-2 text-sm font-medium rounded-lg text-slate-600 dark:text-slate-400 hover:bg-slate-100/70 dark:hover:bg-slate-800/50 hover:text-slate-900 dark:hover:text-white transition-all duration-200"
              >
                {isDark ? (
                  <SunIcon className="mr-3 h-4 w-4" />
                ) : (
                  <MoonIcon className="mr-3 h-4 w-4" />
                )}
                {isDark ? 'Light Mode' : 'Dark Mode'}
              </button>

              <button
                onClick={handleLogout}
                className="group flex items-center w-full px-3 py-2 text-sm font-medium rounded-lg text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-all duration-200"
              >
                <ArrowLeftOnRectangleIcon className="mr-3 h-4 w-4" />
                Sign Out
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Main content */}
      <div className="lg:pl-72">
        {/* Mobile header */}
        <div className="sticky top-0 z-30 flex h-16 items-center gap-x-4 border-b border-slate-200/50 dark:border-slate-800/50 bg-white/90 dark:bg-slate-900/90 backdrop-blur-xl px-4 shadow-sm sm:gap-x-6 sm:px-6 lg:hidden">
          <button
            onClick={() => setSidebarOpen(true)}
            className="p-2.5 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
          >
            <Bars3Icon className="h-5 w-5" />
          </button>
          <div className="h-6 w-px bg-slate-200 dark:bg-slate-800" />
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 bg-gradient-to-r from-blue-600 to-purple-600 rounded-lg flex items-center justify-center">
              <ServerIcon className="w-5 h-5 text-white" />
            </div>
            <h1 className="text-lg font-bold bg-gradient-to-r from-slate-800 to-slate-600 dark:from-white dark:to-slate-300 bg-clip-text text-transparent">
              Berth
            </h1>
          </div>
        </div>

        {/* Page content */}
        <main className="px-4 py-8 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-7xl">{children}</div>
        </main>
      </div>

      {/* Toast notifications */}
      <Toaster
        position="top-right"
        gutter={8}
        toastOptions={{
          duration: 4000,
          className: 'backdrop-blur-sm border-0 shadow-xl',
          style: {
            background: isDark ? 'rgba(30, 41, 59, 0.9)' : 'rgba(255, 255, 255, 0.9)',
            color: isDark ? '#f1f5f9' : '#334155',
            borderRadius: '12px',
          },
        }}
      />
    </div>
  );
}
