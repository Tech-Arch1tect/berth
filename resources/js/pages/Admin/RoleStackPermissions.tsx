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

interface PermissionRule {
  id: number;
  server_id: number;
  permission_id: number;
  stack_pattern: string;
  is_stack_based: boolean;
}

interface Props {
  title: string;
  role: Role;
  servers: Server[];
  permissions: Permission[];
  permissionRules: PermissionRule[];
  csrfToken?: string;
}

export default function RoleStackPermissions({
  title,
  role,
  servers = [],
  permissions = [],
  permissionRules = [],
  csrfToken,
}: Props) {
  const [showAddRule, setShowAddRule] = useState(false);
  const [showAddToPattern, setShowAddToPattern] = useState<{
    serverId: number;
    stackPattern: string;
  } | null>(null);
  const [deleting, setDeleting] = useState<number | null>(null);
  const [adding, setAdding] = useState(false);

  const [newRule, setNewRule] = useState({
    server_id: '',
    permission_ids: [] as number[],
    stack_pattern: '*',
  });

  const [addToPatternRule, setAddToPatternRule] = useState({
    server_id: 0,
    permission_ids: [] as number[],
    stack_pattern: '',
  });

  const formatServerUrl = (server: Server) => {
    return `${server.use_https ? 'https' : 'http'}://${server.host}:${server.port}`;
  };

  const getServerName = (serverId: number) => {
    return servers.find((s) => s.id === serverId)?.name || 'Unknown Server';
  };

  const getPermissionName = (permissionId: number) => {
    return permissions.find((p) => p.id === permissionId)?.name || 'Unknown Permission';
  };

  const getPermissionDescription = (permissionId: number) => {
    return permissions.find((p) => p.id === permissionId)?.description || '';
  };

  const handlePermissionToggle = (permissionId: number) => {
    const currentIds = newRule.permission_ids;
    if (currentIds.includes(permissionId)) {
      setNewRule({
        ...newRule,
        permission_ids: currentIds.filter((id) => id !== permissionId),
      });
    } else {
      setNewRule({
        ...newRule,
        permission_ids: [...currentIds, permissionId],
      });
    }
  };

  const handleAddToPatternPermissionToggle = (permissionId: number) => {
    const currentIds = addToPatternRule.permission_ids;
    if (currentIds.includes(permissionId)) {
      setAddToPatternRule({
        ...addToPatternRule,
        permission_ids: currentIds.filter((id) => id !== permissionId),
      });
    } else {
      setAddToPatternRule({
        ...addToPatternRule,
        permission_ids: [...currentIds, permissionId],
      });
    }
  };

  const handleShowAddToPattern = (serverId: number, stackPattern: string) => {
    setShowAddToPattern({ serverId, stackPattern });
    setAddToPatternRule({
      server_id: serverId,
      permission_ids: [],
      stack_pattern: stackPattern,
    });
  };

  const getAvailablePermissionsForPattern = (serverId: number, stackPattern: string) => {
    const existingRules = (permissionRules || []).filter(
      (rule) => rule.server_id === serverId && rule.stack_pattern === stackPattern
    );
    const existingPermissionIds = existingRules.map((rule) => rule.permission_id);
    return permissions.filter((permission) => !existingPermissionIds.includes(permission.id));
  };

  const handleAddRule = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newRule.server_id || newRule.permission_ids.length === 0) return;

    setAdding(true);
    try {
      // Create multiple rules for each selected permission
      const promises = newRule.permission_ids.map((permissionId) =>
        fetch(`/admin/roles/${role.id}/stack-permissions`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-CSRF-Token': csrfToken || '',
          },
          credentials: 'include',
          body: JSON.stringify({
            server_id: parseInt(newRule.server_id),
            permission_id: permissionId,
            stack_pattern: newRule.stack_pattern || '*',
          }),
        })
      );

      const responses = await Promise.all(promises);
      const failed = responses.filter((r) => !r.ok);

      if (failed.length === 0) {
        router.reload();
        setShowAddRule(false);
        setNewRule({ server_id: '', permission_ids: [], stack_pattern: '*' });
      } else {
        alert(`Failed to add ${failed.length} permission rule(s)`);
      }
    } catch (error) {
      alert('Failed to add permission rules: ' + error);
    } finally {
      setAdding(false);
    }
  };

  const handleAddToPattern = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!addToPatternRule.server_id || addToPatternRule.permission_ids.length === 0) return;

    setAdding(true);
    try {
      const promises = addToPatternRule.permission_ids.map((permissionId) =>
        fetch(`/admin/roles/${role.id}/stack-permissions`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-CSRF-Token': csrfToken || '',
          },
          credentials: 'include',
          body: JSON.stringify({
            server_id: addToPatternRule.server_id,
            permission_id: permissionId,
            stack_pattern: addToPatternRule.stack_pattern,
          }),
        })
      );

      const responses = await Promise.all(promises);
      const failed = responses.filter((r) => !r.ok);

      if (failed.length === 0) {
        router.reload();
        setShowAddToPattern(null);
        setAddToPatternRule({ server_id: 0, permission_ids: [], stack_pattern: '' });
      } else {
        alert(`Failed to add ${failed.length} permission(s) to pattern`);
      }
    } catch (error) {
      alert('Failed to add permissions to pattern: ' + error);
    } finally {
      setAdding(false);
    }
  };

  const handleDeleteRule = async (ruleId: number) => {
    if (!confirm('Are you sure you want to delete this permission rule?')) return;

    setDeleting(ruleId);
    try {
      const response = await fetch(`/admin/roles/${role.id}/stack-permissions/${ruleId}`, {
        method: 'DELETE',
        headers: {
          'X-CSRF-Token': csrfToken || '',
        },
        credentials: 'include',
      });

      if (response.ok) {
        router.reload();
      } else {
        const errorData = await response.json();
        alert(
          'Failed to delete permission rule: ' +
            (errorData.message || errorData.error || 'Unknown error')
        );
      }
    } catch (error) {
      alert('Failed to delete permission rule: ' + error);
    } finally {
      setDeleting(null);
    }
  };

  const groupedRules = (permissionRules || []).reduce(
    (acc, rule) => {
      const serverName = getServerName(rule.server_id);
      const key = `${serverName}-${rule.stack_pattern}`;
      if (!acc[key]) {
        acc[key] = {
          serverName,
          serverId: rule.server_id,
          stackPattern: rule.stack_pattern,
          rules: [],
        };
      }
      acc[key].rules.push(rule);
      return acc;
    },
    {} as Record<
      string,
      { serverName: string; serverId: number; stackPattern: string; rules: PermissionRule[] }
    >
  );

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
                      {role.name} Stack Permissions
                    </span>
                  </div>
                </li>
              </ol>
            </nav>
            <h2 className="mt-2 text-2xl font-bold leading-7 text-gray-900 dark:text-white sm:text-3xl sm:truncate">
              {title}
            </h2>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              Manage stack-based permissions for the <strong>{role.name}</strong> role using
              patterns
            </p>
          </div>
          <div className="mt-4 flex md:mt-0 md:ml-4">
            <button
              onClick={() => setShowAddRule(true)}
              className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
            >
              Add Permission Rule
            </button>
          </div>
        </div>

        <FlashMessages />

        {/* Add Rule Modal */}
        {showAddRule && (
          <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
            <div className="relative top-20 mx-auto p-5 border w-full max-w-md shadow-lg rounded-md bg-white dark:bg-gray-800">
              <div className="mt-3">
                <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">
                  Add Permission Rule
                </h3>
                <form onSubmit={handleAddRule} className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Server
                    </label>
                    <select
                      value={newRule.server_id}
                      onChange={(e) => setNewRule({ ...newRule, server_id: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                      required
                    >
                      <option value="">Select a server</option>
                      {servers.map((server) => (
                        <option key={server.id} value={server.id}>
                          {server.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
                      Permissions
                    </label>
                    <div className="space-y-3">
                      {permissions.map((permission) => (
                        <div key={permission.id} className="flex items-start">
                          <div className="flex items-center h-5">
                            <input
                              id={`permission-${permission.id}`}
                              type="checkbox"
                              checked={newRule.permission_ids.includes(permission.id)}
                              onChange={() => handlePermissionToggle(permission.id)}
                              className="focus:ring-blue-500 h-4 w-4 text-blue-600 border-gray-300 rounded dark:border-gray-600 dark:bg-gray-700"
                            />
                          </div>
                          <div className="ml-3 text-sm">
                            <label
                              htmlFor={`permission-${permission.id}`}
                              className="font-medium text-gray-700 dark:text-gray-300 cursor-pointer"
                            >
                              {permission.name}
                            </label>
                            <p className="text-gray-500 dark:text-gray-400">
                              {permission.description}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                    {newRule.permission_ids.length === 0 && (
                      <p className="mt-2 text-sm text-red-500">
                        Please select at least one permission.
                      </p>
                    )}
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Stack Pattern
                    </label>
                    <input
                      type="text"
                      value={newRule.stack_pattern}
                      onChange={(e) => setNewRule({ ...newRule, stack_pattern: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                      placeholder="* (all stacks)"
                    />
                    <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                      Use * for all stacks, *dev* for stacks containing 'dev', *dev*test* for
                      complex patterns
                    </p>
                  </div>
                  <div className="flex justify-end space-x-3">
                    <button
                      type="button"
                      onClick={() => setShowAddRule(false)}
                      className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-md focus:outline-none focus:ring-2 focus:ring-gray-500 dark:bg-gray-600 dark:text-gray-300 dark:hover:bg-gray-500"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={adding}
                      className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
                    >
                      {adding ? 'Adding...' : 'Add Rule'}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </div>
        )}

        {/* Add To Pattern Modal */}
        {showAddToPattern && (
          <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
            <div className="relative top-20 mx-auto p-5 border w-full max-w-md shadow-lg rounded-md bg-white dark:bg-gray-800">
              <div className="mt-3">
                <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">
                  Add Permissions to Pattern
                </h3>
                <div className="mb-4 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-md">
                  <p className="text-sm text-blue-700 dark:text-blue-300">
                    <strong>Server:</strong> {getServerName(showAddToPattern.serverId)}
                    <br />
                    <strong>Pattern:</strong>{' '}
                    <code className="bg-blue-100 dark:bg-blue-800 px-1 rounded">
                      {showAddToPattern.stackPattern}
                    </code>
                  </p>
                </div>
                <form onSubmit={handleAddToPattern} className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
                      Available Permissions
                    </label>
                    <div className="space-y-3">
                      {getAvailablePermissionsForPattern(
                        showAddToPattern.serverId,
                        showAddToPattern.stackPattern
                      ).map((permission) => (
                        <div key={permission.id} className="flex items-start">
                          <div className="flex items-center h-5">
                            <input
                              id={`add-permission-${permission.id}`}
                              type="checkbox"
                              checked={addToPatternRule.permission_ids.includes(permission.id)}
                              onChange={() => {
                                const permissionIds = addToPatternRule.permission_ids.includes(
                                  permission.id
                                )
                                  ? addToPatternRule.permission_ids.filter(
                                      (id) => id !== permission.id
                                    )
                                  : [...addToPatternRule.permission_ids, permission.id];
                                setAddToPatternRule({
                                  ...addToPatternRule,
                                  permission_ids: permissionIds,
                                });
                              }}
                              className="focus:ring-blue-500 h-4 w-4 text-blue-600 border-gray-300 rounded dark:border-gray-600 dark:bg-gray-700"
                            />
                          </div>
                          <div className="ml-3 text-sm">
                            <label
                              htmlFor={`add-permission-${permission.id}`}
                              className="font-medium text-gray-700 dark:text-gray-300 cursor-pointer"
                            >
                              {permission.name}
                            </label>
                            <p className="text-gray-500 dark:text-gray-400">
                              {permission.description}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                    {addToPatternRule.permission_ids.length === 0 && (
                      <p className="mt-2 text-sm text-red-500">
                        Please select at least one permission.
                      </p>
                    )}
                  </div>
                  <div className="flex justify-end space-x-3">
                    <button
                      type="button"
                      onClick={() => setShowAddToPattern(null)}
                      className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-md focus:outline-none focus:ring-2 focus:ring-gray-500 dark:bg-gray-600 dark:text-gray-300 dark:hover:bg-gray-500"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={adding || addToPatternRule.permission_ids.length === 0}
                      className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
                    >
                      {adding ? 'Adding...' : 'Add Permissions'}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </div>
        )}

        {/* Permission Rules */}
        <div className="mt-8">
          {(permissionRules || []).length === 0 ? (
            <div className="text-center py-12">
              <svg
                className="mx-auto h-12 w-12 text-gray-400"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
              <h3 className="mt-2 text-sm font-medium text-gray-900 dark:text-white">
                No permission rules
              </h3>
              <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                Get started by creating your first permission rule for this role.
              </p>
              <div className="mt-6">
                <button
                  onClick={() => setShowAddRule(true)}
                  className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                >
                  Add Permission Rule
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              {Object.entries(groupedRules).map(([key, group]) => (
                <div
                  key={key}
                  className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden"
                >
                  <div className="px-4 py-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <h3 className="text-base font-medium text-gray-900 dark:text-white">
                          {group.serverName}
                        </h3>
                        <span className="inline-flex items-center px-2 py-1 rounded-md text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200">
                          {group.stackPattern}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        {getAvailablePermissionsForPattern(group.serverId, group.stackPattern)
                          .length > 0 && (
                          <button
                            onClick={() =>
                              handleShowAddToPattern(group.serverId, group.stackPattern)
                            }
                            className="inline-flex items-center px-2 py-1 border border-gray-300 dark:border-gray-600 text-xs font-medium rounded text-gray-600 dark:text-gray-400 bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600 focus:outline-none focus:ring-1 focus:ring-blue-500"
                          >
                            <svg className="w-3 h-3 mr-1" fill="currentColor" viewBox="0 0 20 20">
                              <path
                                fillRule="evenodd"
                                d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z"
                                clipRule="evenodd"
                              />
                            </svg>
                            Add
                          </button>
                        )}
                      </div>
                    </div>
                    <div className="mt-2 flex flex-wrap gap-1">
                      {group.rules.map((rule) => (
                        <button
                          key={rule.id}
                          onClick={() => handleDeleteRule(rule.id)}
                          disabled={deleting === rule.id}
                          className="inline-flex items-center px-2 py-1 border border-transparent text-xs font-medium rounded text-white bg-gray-500 hover:bg-red-600 disabled:opacity-50 focus:outline-none focus:ring-1 focus:ring-red-500 transition-colors"
                          title={`Remove ${getPermissionName(rule.permission_id)} permission`}
                        >
                          {deleting === rule.id ? (
                            <div className="w-3 h-3 border border-current border-t-transparent rounded-full animate-spin mr-1"></div>
                          ) : (
                            <svg className="w-3 h-3 mr-1" fill="currentColor" viewBox="0 0 20 20">
                              <path
                                fillRule="evenodd"
                                d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                                clipRule="evenodd"
                              />
                            </svg>
                          )}
                          {getPermissionName(rule.permission_id)}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Pattern Examples */}
        <div className="mt-6 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
          <h3 className="text-sm font-medium text-blue-800 dark:text-blue-200 mb-2">
            Pattern Examples
          </h3>
          <div className="text-xs text-blue-700 dark:text-blue-300 space-y-2">
            <div className="flex flex-wrap gap-x-4 gap-y-1">
              <span>
                <code className="bg-blue-100 dark:bg-blue-800 px-1 rounded">*</code> All stacks
              </span>
              <span>
                <code className="bg-blue-100 dark:bg-blue-800 px-1 rounded">*dev*</code> Contains
                "dev"
              </span>
              <span>
                <code className="bg-blue-100 dark:bg-blue-800 px-1 rounded">*prod*</code> Contains
                "prod"
              </span>
              <span>
                <code className="bg-blue-100 dark:bg-blue-800 px-1 rounded">app*</code> Starts with
                "app"
              </span>
              <span>
                <code className="bg-blue-100 dark:bg-blue-800 px-1 rounded">*-staging</code> Ends
                with "-staging"
              </span>
            </div>
            <div className="flex flex-wrap gap-x-4 gap-y-1">
              <span>
                <code className="bg-blue-100 dark:bg-blue-800 px-1 rounded">*dev*test*</code>{' '}
                Contains "dev" then "test"
              </span>
              <span>
                <code className="bg-blue-100 dark:bg-blue-800 px-1 rounded">api*staging*v1*</code>{' '}
                Complex matching
              </span>
            </div>
            <p className="text-xs mt-2">
              Pattern matching is case-insensitive. Use multiple rules for different permissions per
              pattern.
            </p>
          </div>
        </div>
      </div>
    </Layout>
  );
}
