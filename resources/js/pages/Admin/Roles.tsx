import React from 'react';
import { Head, router } from '@inertiajs/react';
import Layout from '../../components/Layout';
import FlashMessages from '../../components/FlashMessages';

interface Role {
  id: number;
  name: string;
  description: string;
  is_admin: boolean;
}

interface Props {
  title: string;
  roles: Role[];
}

export default function AdminRoles({ title, roles }: Props) {
  return (
    <Layout>
      <Head title={title} />

      <div className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        <div className="md:flex md:items-center md:justify-between">
          <div className="flex-1 min-w-0">
            <h2 className="text-2xl font-bold leading-7 text-gray-900 dark:text-white sm:text-3xl sm:truncate">
              {title}
            </h2>
          </div>
        </div>

        <FlashMessages />

        <div className="mt-8 grid gap-6">
          {roles.map((role) => (
            <div key={role.id} className="bg-white dark:bg-gray-800 shadow rounded-lg">
              <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-lg font-medium text-gray-900 dark:text-white capitalize flex items-center">
                      {role.name}
                      {role.is_admin && (
                        <span className="ml-3 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 dark:bg-red-900 text-red-800 dark:text-red-200">
                          Admin
                        </span>
                      )}
                      <span
                        className={`ml-3 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200`}
                      >
                        {role.is_admin ? 'Full Access' : 'Server Permissions'}
                      </span>
                    </h3>
                    <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                      {role.description}
                    </p>
                  </div>
                  {!role.is_admin && (
                    <button
                      onClick={() => router.visit(`/admin/roles/${role.id}/server-permissions`)}
                      className="inline-flex items-center px-3 py-2 border border-gray-300 dark:border-gray-600 shadow-sm text-sm leading-4 font-medium rounded-md text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                    >
                      Server Permissions
                    </button>
                  )}
                </div>
              </div>
              <div className="px-6 py-4">
                {role.is_admin ? (
                  <div className="text-sm text-gray-500 dark:text-gray-400">
                    Admin users have full access to all servers and functionality.
                  </div>
                ) : (
                  <div className="text-sm text-gray-500 dark:text-gray-400">
                    Server permissions are managed individually. Click "Server Permissions" to
                    configure access.
                  </div>
                )}
              </div>
            </div>
          ))}

          {roles.length === 0 && (
            <div className="text-center py-12">
              <div className="text-sm text-gray-500 dark:text-gray-400">No roles found.</div>
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
}
