import React, { useState } from 'react';
import { Head, router } from '@inertiajs/react';
import Layout from '../../components/layout/Layout';
import FlashMessages from '../../components/FlashMessages';
import { cn } from '../../utils/cn';
import { theme } from '../../theme';

interface User {
  id: number;
  username: string;
  email: string;
  roles: Role[];
}

interface Role {
  id: number;
  name: string;
  description: string;
}

interface Props {
  title: string;
  user: User;
  allRoles: Role[];
  csrfToken?: string;
}

export default function UserRoles({ title, user, allRoles, csrfToken }: Props) {
  const [processing, setProcessing] = useState(false);

  const assignRole = async (roleId: number) => {
    if (processing) return;

    setProcessing(true);
    router.post(
      '/admin/users/assign-role',
      {
        user_id: user.id,
        role_id: roleId,
      },
      {
        headers: {
          'X-CSRF-Token': csrfToken || '',
        },
        onFinish: () => setProcessing(false),
      }
    );
  };

  const revokeRole = async (roleId: number) => {
    if (processing) return;

    setProcessing(true);
    router.post(
      '/admin/users/revoke-role',
      {
        user_id: user.id,
        role_id: roleId,
      },
      {
        headers: {
          'X-CSRF-Token': csrfToken || '',
        },
        onFinish: () => setProcessing(false),
      }
    );
  };

  const userRoleIds = user.roles.map((role) => role.id);
  const availableRoles = allRoles.filter((role) => !userRoleIds.includes(role.id));

  return (
    <Layout>
      <Head title={title} />

      <div className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        <div className="md:flex md:items-center md:justify-between">
          <div className="flex-1 min-w-0">
            <h2
              className={cn(
                'text-2xl font-bold leading-7 sm:text-3xl sm:truncate',
                theme.text.strong
              )}
            >
              {title}
            </h2>
            <p className={cn('mt-1 text-sm', theme.text.subtle)}>
              Managing roles for {user.username} ({user.email})
            </p>
          </div>
          <div className="mt-4 flex md:mt-0 md:ml-4">
            <button
              type="button"
              onClick={() => router.get('/admin/users')}
              className={cn('ml-3', theme.buttons.secondary)}
            >
              Back to Users
            </button>
          </div>
        </div>

        <FlashMessages />

        <div className="mt-8 grid grid-cols-1 gap-8 lg:grid-cols-2">
          {/* Current Roles */}
          <div>
            <h3 className={cn('text-lg font-medium mb-4', theme.text.strong)}>Current Roles</h3>
            <div className={cn(theme.surface.panel, 'shadow overflow-hidden sm:rounded-md')}>
              {user.roles.length > 0 ? (
                <ul className="divide-y divide-slate-200 dark:divide-slate-700">
                  {user.roles.map((role) => (
                    <li key={role.id} className="px-6 py-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <h4 className={cn('text-sm font-medium capitalize', theme.text.strong)}>
                            {role.name}
                          </h4>
                          <p className={cn('text-sm', theme.text.subtle)}>{role.description}</p>
                        </div>
                        <button
                          onClick={() => revokeRole(role.id)}
                          disabled={processing}
                          className={cn(
                            'ml-4 text-xs font-medium px-2.5 py-0.5 rounded-full',
                            'bg-red-100 dark:bg-red-900 hover:bg-red-200 dark:hover:bg-red-800',
                            'text-red-800 dark:text-red-200',
                            'focus:outline-none focus:ring-2 focus:ring-red-500',
                            'disabled:opacity-50 transition-colors'
                          )}
                        >
                          Remove
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              ) : (
                <div className={cn('px-6 py-4 text-sm', theme.text.subtle)}>No roles assigned</div>
              )}
            </div>
          </div>

          {/* Available Roles */}
          <div>
            <h3 className={cn('text-lg font-medium mb-4', theme.text.strong)}>Available Roles</h3>
            <div className={cn(theme.surface.panel, 'shadow overflow-hidden sm:rounded-md')}>
              {availableRoles.length > 0 ? (
                <ul className="divide-y divide-slate-200 dark:divide-slate-700">
                  {availableRoles.map((role) => (
                    <li key={role.id} className="px-6 py-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <h4 className={cn('text-sm font-medium capitalize', theme.text.strong)}>
                            {role.name}
                          </h4>
                          <p className={cn('text-sm', theme.text.subtle)}>{role.description}</p>
                        </div>
                        <button
                          onClick={() => assignRole(role.id)}
                          disabled={processing}
                          className={cn(
                            'ml-4 text-xs font-medium px-2.5 py-0.5 rounded-full',
                            'bg-green-100 dark:bg-green-900 hover:bg-green-200 dark:hover:bg-green-800',
                            'text-green-800 dark:text-green-200',
                            'focus:outline-none focus:ring-2 focus:ring-green-500',
                            'disabled:opacity-50 transition-colors'
                          )}
                        >
                          Assign
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              ) : (
                <div className={cn('px-6 py-4 text-sm', theme.text.subtle)}>All roles assigned</div>
              )}
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
}
