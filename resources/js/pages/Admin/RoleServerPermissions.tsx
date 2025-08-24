import React, { useState } from 'react';
import { Head, router } from '@inertiajs/react';
import Layout from '../../components/Layout';
import FlashMessages from '../../components/FlashMessages';

interface Permission {
  id: number;
  name: string;
  resource: string;
  action: string;
  description: string;
}

interface Server {
  id: number;
  name: string;
  description: string;
  host: string;
  port: number;
  use_https: boolean;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

interface Role {
  id: number;
  name: string;
  description: string;
  is_admin: boolean;
}

interface Props {
  title: string;
  role: Role;
  servers: Server[];
  permissions: Permission[];
  permissionMatrix: { [serverId: number]: { [permissionId: number]: boolean } };
  csrfToken?: string;
}

export default function RoleServerPermissions({
  title,
  role,
  servers,
  permissions,
  permissionMatrix,
  csrfToken,
}: Props) {
  const [updating, setUpdating] = useState<string | null>(null);

  const hasPermission = (serverId: number, permissionId: number): boolean => {
    return permissionMatrix[serverId]?.[permissionId] || false;
  };

  const togglePermission = async (
    serverId: number,
    permissionId: number,
    currentlyGranted: boolean
  ) => {
    const key = `${serverId}-${permissionId}`;
    setUpdating(key);

    try {
      const response = await fetch(`/admin/roles/${role.id}/server-permissions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-Token': csrfToken || '',
        },
        credentials: 'include',
        body: JSON.stringify({
          server_id: serverId,
          permission_id: permissionId,
          granted: !currentlyGranted,
        }),
      });

      if (response.ok) {
        router.reload();
      } else {
        const errorData = await response.json();
        alert(
          'Failed to update permission: ' +
            (errorData.message || errorData.error || 'Unknown error')
        );
      }
    } catch (error) {
      alert('Failed to update permission: ' + error);
    } finally {
      setUpdating(null);
    }
  };

  const formatServerUrl = (server: Server) => {
    return `${server.use_https ? 'https' : 'http'}://${server.host}:${server.port}`;
  };

  return (
    <Layout>
      <Head title={title} />

      <div className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        <div className="md:flex md:items-center md:justify-between">
          <div className="flex-1 min-w-0">
            <nav className="flex" aria-label="Breadcrumb">
              <ol className="flex items-center space-x-4">
                <li>
                  <button
                    onClick={() => router.visit('/admin/roles')}
                    className="text-gray-400 hover:text-gray-500 dark:text-gray-500 dark:hover:text-gray-400"
                  >
                    Roles
                  </button>
                </li>
                <li>
                  <div className="flex items-center">
                    <svg
                      className="flex-shrink-0 h-5 w-5 text-gray-300"
                      xmlns="http://www.w3.org/2000/svg"
                      fill="currentColor"
                      viewBox="0 0 20 20"
                      aria-hidden="true"
                    >
                      <path d="M5.555 17.776l8-16 .894.448-8 16-.894-.448z" />
                    </svg>
                    <span className="ml-4 text-sm font-medium text-gray-500 dark:text-gray-400">
                      {role.name} Server Permissions
                    </span>
                  </div>
                </li>
              </ol>
            </nav>
            <h2 className="mt-2 text-2xl font-bold leading-7 text-gray-900 dark:text-white sm:text-3xl sm:truncate">
              {title}
            </h2>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              Manage server permissions for the <strong>{role.name}</strong> role
            </p>
          </div>
        </div>

        <FlashMessages />

        {servers.length === 0 ? (
          <div className="mt-8 text-center">
            <p className="text-gray-500 dark:text-gray-400">No servers configured yet.</p>
            <button
              onClick={() => router.visit('/admin/servers')}
              className="mt-4 inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700"
            >
              Add Servers
            </button>
          </div>
        ) : (
          <div className="mt-8">
            <div className="bg-white dark:bg-gray-800 shadow overflow-hidden sm:rounded-lg">
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                  <thead className="bg-gray-50 dark:bg-gray-900">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                        Server
                      </th>
                      {permissions.map((permission) => (
                        <th
                          key={permission.id}
                          className="px-3 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider"
                        >
                          <div className="space-y-1">
                            <div>{permission.name}</div>
                            <div className="text-xs text-gray-400 dark:text-gray-500 font-normal normal-case">
                              {permission.description}
                            </div>
                          </div>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                    {servers.map((server) => (
                      <tr key={server.id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center">
                            <div
                              className={`flex-shrink-0 h-3 w-3 rounded-full ${server.is_active ? 'bg-green-400' : 'bg-red-400'}`}
                            ></div>
                            <div className="ml-4">
                              <div className="text-sm font-medium text-gray-900 dark:text-white">
                                {server.name}
                              </div>
                              <div className="text-sm text-gray-500 dark:text-gray-400">
                                {formatServerUrl(server)}
                              </div>
                              {server.description && (
                                <div className="text-xs text-gray-400 dark:text-gray-500">
                                  {server.description}
                                </div>
                              )}
                            </div>
                          </div>
                        </td>
                        {permissions.map((permission) => {
                          const granted = hasPermission(server.id, permission.id);
                          const key = `${server.id}-${permission.id}`;
                          const isUpdating = updating === key;

                          return (
                            <td
                              key={permission.id}
                              className="px-3 py-4 whitespace-nowrap text-center"
                            >
                              <button
                                onClick={() => togglePermission(server.id, permission.id, granted)}
                                disabled={isUpdating}
                                className={`inline-flex items-center justify-center w-8 h-8 rounded-full border-2 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 ${
                                  granted
                                    ? 'bg-green-100 border-green-500 text-green-600 hover:bg-green-200 dark:bg-green-900 dark:border-green-400 dark:text-green-300'
                                    : 'bg-gray-100 border-gray-300 text-gray-400 hover:bg-gray-200 dark:bg-gray-700 dark:border-gray-600 dark:text-gray-500'
                                }`}
                                title={
                                  granted ? `Revoke ${permission.name}` : `Grant ${permission.name}`
                                }
                              >
                                {isUpdating ? (
                                  <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin"></div>
                                ) : granted ? (
                                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                                    <path
                                      fillRule="evenodd"
                                      d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                                      clipRule="evenodd"
                                    />
                                  </svg>
                                ) : (
                                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                                    <path
                                      fillRule="evenodd"
                                      d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                                      clipRule="evenodd"
                                    />
                                  </svg>
                                )}
                              </button>
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="mt-6 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
              <div className="flex">
                <div className="flex-shrink-0">
                  <svg className="h-5 w-5 text-blue-400" fill="currentColor" viewBox="0 0 20 20">
                    <path
                      fillRule="evenodd"
                      d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z"
                      clipRule="evenodd"
                    />
                  </svg>
                </div>
                <div className="ml-3">
                  <h3 className="text-sm font-medium text-blue-800 dark:text-blue-200">
                    Permission Information
                  </h3>
                  <div className="mt-2 text-sm text-blue-700 dark:text-blue-300">
                    <ul className="list-disc pl-5 space-y-1">
                      <li>
                        <strong>stacks.read</strong>: Required for users to see this server in their
                        dashboard
                      </li>
                      <li>
                        <strong>stacks.manage</strong>: Allows starting, stopping, and managing
                        Docker stacks
                      </li>
                      <li>
                        <strong>files.read</strong>: View configuration files and compose files
                      </li>
                      <li>
                        <strong>files.write</strong>: Edit configuration files and compose files
                      </li>
                      <li>
                        <strong>logs.read</strong>: View container logs and troubleshooting
                        information
                      </li>
                    </ul>
                    <p className="mt-3 text-sm text-blue-700 dark:text-blue-300">
                      Users with the <strong>{role.name}</strong> role can only access servers where
                      they have at least the <strong>stacks.read</strong> permission.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}
