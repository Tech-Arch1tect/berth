import React, { useState } from 'react';
import { Head, router } from '@inertiajs/react';
import Layout from '../../components/Layout';
import FlashMessages from '../../components/FlashMessages';

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
            <h2 className="text-2xl font-bold leading-7 text-gray-900 dark:text-white sm:text-3xl sm:truncate">
              {title}
            </h2>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              Managing roles for {user.username} ({user.email})
            </p>
          </div>
          <div className="mt-4 flex md:mt-0 md:ml-4">
            <button
              type="button"
              onClick={() => router.get('/admin/users')}
              className="ml-3 inline-flex items-center px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm text-sm font-medium text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 dark:focus:ring-offset-gray-800"
            >
              Back to Users
            </button>
          </div>
        </div>

        <FlashMessages />

        <div className="mt-8 grid grid-cols-1 gap-8 lg:grid-cols-2">
          {/* Current Roles */}
          <div>
            <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">
              Current Roles
            </h3>
            <div className="bg-white dark:bg-gray-800 shadow overflow-hidden sm:rounded-md">
              {user.roles.length > 0 ? (
                <ul className="divide-y divide-gray-200 dark:divide-gray-700">
                  {user.roles.map((role) => (
                    <li key={role.id} className="px-6 py-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <h4 className="text-sm font-medium text-gray-900 dark:text-white capitalize">
                            {role.name}
                          </h4>
                          <p className="text-sm text-gray-500 dark:text-gray-400">
                            {role.description}
                          </p>
                        </div>
                        <button
                          onClick={() => revokeRole(role.id)}
                          disabled={processing}
                          className="ml-4 bg-red-100 dark:bg-red-900 hover:bg-red-200 dark:hover:bg-red-800 text-red-800 dark:text-red-200 text-xs font-medium px-2.5 py-0.5 rounded-full focus:outline-none focus:ring-2 focus:ring-red-500 disabled:opacity-50"
                        >
                          Remove
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              ) : (
                <div className="px-6 py-4 text-sm text-gray-500 dark:text-gray-400">
                  No roles assigned
                </div>
              )}
            </div>
          </div>

          {/* Available Roles */}
          <div>
            <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">
              Available Roles
            </h3>
            <div className="bg-white dark:bg-gray-800 shadow overflow-hidden sm:rounded-md">
              {availableRoles.length > 0 ? (
                <ul className="divide-y divide-gray-200 dark:divide-gray-700">
                  {availableRoles.map((role) => (
                    <li key={role.id} className="px-6 py-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <h4 className="text-sm font-medium text-gray-900 dark:text-white capitalize">
                            {role.name}
                          </h4>
                          <p className="text-sm text-gray-500 dark:text-gray-400">
                            {role.description}
                          </p>
                        </div>
                        <button
                          onClick={() => assignRole(role.id)}
                          disabled={processing}
                          className="ml-4 bg-green-100 dark:bg-green-900 hover:bg-green-200 dark:hover:bg-green-800 text-green-800 dark:text-green-200 text-xs font-medium px-2.5 py-0.5 rounded-full focus:outline-none focus:ring-2 focus:ring-green-500 disabled:opacity-50"
                        >
                          Assign
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              ) : (
                <div className="px-6 py-4 text-sm text-gray-500 dark:text-gray-400">
                  All roles assigned
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
}
