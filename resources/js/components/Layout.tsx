import { Link, usePage, router } from '@inertiajs/react';
import { ReactNode } from 'react';
import { SunIcon, MoonIcon } from '@heroicons/react/24/outline';
import { User } from '../types';
import { useDarkMode } from '../hooks/useDarkMode';

interface LayoutProps {
  children: ReactNode;
}

export default function Layout({ children }: LayoutProps) {
  const { url, props } = usePage();
  const user = props.currentUser as User | undefined;
  const csrfToken = props.csrfToken as string | undefined;
  const { isDark, toggleDarkMode } = useDarkMode();

  // Check if user has admin role
  const isAdmin = user?.roles?.some((role) => role.name === 'admin') || false;

  const navigation = [
    { name: 'Dashboard', href: '/' },
    ...(isAdmin
      ? [
          { name: 'Servers', href: '/admin/servers' },
          { name: 'Users', href: '/admin/users' },
          { name: 'Roles', href: '/admin/roles' },
        ]
      : []),
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

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 transition-colors">
      <nav className="bg-white dark:bg-gray-800 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex items-center space-x-8">
              <Link href="/" className="flex-shrink-0">
                <h1 className="text-xl font-bold text-gray-900 dark:text-white">brx Starter Kit</h1>
              </Link>
              {user && (
                <div className="hidden sm:flex sm:space-x-8">
                  {navigation.map((item) => (
                    <Link
                      key={item.name}
                      href={item.href}
                      className={`text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                        url === item.href
                          ? 'text-blue-600 bg-blue-50 dark:text-blue-400 dark:bg-blue-900/20'
                          : ''
                      }`}
                    >
                      {item.name}
                    </Link>
                  ))}
                </div>
              )}
            </div>

            <div className="flex items-center space-x-4">
              <button
                onClick={toggleDarkMode}
                className="p-2 rounded-md text-gray-600 hover:text-gray-900 dark:text-gray-300 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                aria-label="Toggle dark mode"
              >
                {isDark ? <SunIcon className="h-5 w-5" /> : <MoonIcon className="h-5 w-5" />}
              </button>

              {user ? (
                <>
                  <Link
                    href="/profile"
                    className="text-gray-600 hover:text-gray-900 dark:text-gray-300 dark:hover:text-white text-sm font-medium"
                  >
                    {user.username}
                  </Link>
                  <Link
                    href="/sessions"
                    className="text-gray-600 hover:text-gray-900 dark:text-gray-300 dark:hover:text-white text-sm font-medium"
                  >
                    Sessions
                  </Link>
                  <button
                    onClick={handleLogout}
                    className="bg-red-600 dark:bg-red-700 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-red-700 dark:hover:bg-red-600 transition-colors"
                  >
                    Logout
                  </button>
                </>
              ) : (
                <>
                  <Link
                    href="/auth/login"
                    className="text-gray-600 hover:text-gray-900 dark:text-gray-300 dark:hover:text-white text-sm font-medium"
                  >
                    Login
                  </Link>
                  <Link
                    href="/auth/register"
                    className="bg-blue-600 dark:bg-blue-700 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-blue-700 dark:hover:bg-blue-600 transition-colors"
                  >
                    Register
                  </Link>
                </>
              )}
            </div>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8">{children}</main>

      <footer className="bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 mt-12">
        <div className="max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8">
          <p className="text-center text-gray-500 dark:text-gray-400 text-sm">
            Built with brx, Inertia.js, and React
          </p>
        </div>
      </footer>
    </div>
  );
}
