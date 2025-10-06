import Layout from '../../components/Layout';
import FlashMessages from '../../components/FlashMessages';
import { Head, useForm, usePage, router } from '@inertiajs/react';
import { useState, useEffect } from 'react';
import {
  PlusIcon,
  TrashIcon,
  ServerIcon,
  ShieldCheckIcon,
  ArrowLeftIcon,
} from '@heroicons/react/24/outline';
import axios from 'axios';

interface Scope {
  id: number;
  server_id: number | null;
  server_name?: string;
  stack_pattern: string;
  permission: string;
  created_at: string;
}

interface Server {
  id: number;
  name: string;
}

interface ScopesProps {
  api_key_id: string;
}

interface NewScopeForm {
  server_id: string;
  stack_pattern: string;
  permissions: string[];
}

const PERMISSIONS = [
  { value: 'stacks.read', label: 'View stacks and containers' },
  { value: 'stacks.manage', label: 'Start/stop/deploy/remove stacks' },
  { value: 'files.read', label: 'Read files within stacks' },
  { value: 'files.write', label: 'Modify files within stacks' },
  { value: 'logs.read', label: 'View container logs' },
  { value: 'docker.maintenance.read', label: 'View Docker usage statistics' },
  { value: 'docker.maintenance.write', label: 'Run Docker maintenance tasks' },
  { value: 'registries.manage', label: 'Manage registry credentials' },
];

export default function APIKeyScopesPage({ api_key_id }: ScopesProps) {
  const { props } = usePage();
  const csrfToken = props.csrfToken as string | undefined;
  const [scopes, setScopes] = useState<Scope[]>([]);
  const [servers, setServers] = useState<Server[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);

  const {
    data: formData,
    setData,
    processing,
    errors,
    reset,
  } = useForm<NewScopeForm>({
    server_id: '',
    stack_pattern: '*',
    permissions: ['stacks.read'],
  });

  const loadScopes = async () => {
    try {
      const response = await axios.get(`/api/api-keys/${api_key_id}/scopes`);
      if (response.data.success) {
        setScopes(response.data.data);
      }
    } catch (error) {
      console.error('Failed to load scopes:', error);
    }
  };

  const loadServers = async () => {
    try {
      const response = await axios.get('/api/servers');

      if (response.data.success) {
        setServers(response.data.data);
      } else if (response.data.servers) {
        setServers(response.data.servers);
      }
    } catch (error) {
      console.error('Failed to load servers:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadScopes();
    loadServers();
  }, []);

  const addScope = async (e: React.FormEvent) => {
    e.preventDefault();

    if (formData.permissions.length === 0) {
      alert('Please select at least one permission');
      return;
    }

    try {
      const promises = formData.permissions.map((permission) => {
        const payload: any = {
          stack_pattern: formData.stack_pattern,
          permission: permission,
        };

        if (formData.server_id && formData.server_id !== 'all') {
          payload.server_id = parseInt(formData.server_id);
        }

        return axios.post(`/api/api-keys/${api_key_id}/scopes`, payload, {
          headers: {
            'X-CSRF-Token': csrfToken || '',
          },
        });
      });

      await Promise.all(promises);

      setShowAddModal(false);
      reset();
      loadScopes();
      router.reload({ only: ['flash'] });
    } catch (error: any) {
      console.error('Failed to add scope:', error);
      alert(error.response?.data?.message || 'Failed to add scopes');
    }
  };

  const removeScope = async (scopeId: number) => {
    if (!confirm('Are you sure you want to remove this scope?')) {
      return;
    }

    try {
      await axios.delete(`/api/api-keys/${api_key_id}/scopes/${scopeId}`, {
        headers: {
          'X-CSRF-Token': csrfToken || '',
        },
      });

      loadScopes();
      router.reload({ only: ['flash'] });
    } catch (error) {
      console.error('Failed to remove scope:', error);
      alert('Failed to remove scope');
    }
  };

  return (
    <Layout>
      <Head title="Manage API Key Scopes" />
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="py-8">
          <div className="mb-6">
            <button
              onClick={() => router.visit('/api-keys')}
              className="inline-flex items-center text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
            >
              <ArrowLeftIcon className="h-4 w-4 mr-1" />
              Back to API Keys
            </button>
          </div>

          <div className="flex justify-between items-center mb-8">
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
              Manage API Key Scopes
            </h1>
            <button
              onClick={() => setShowAddModal(true)}
              className="inline-flex items-center px-4 py-2 bg-blue-600 dark:bg-blue-700 text-white rounded-md hover:bg-blue-700 dark:hover:bg-blue-600"
            >
              <PlusIcon className="h-5 w-5 mr-2" />
              Add Scope
            </button>
          </div>

          <FlashMessages className="mb-6" />

          {/* Add Scope Modal */}
          {showAddModal && (
            <div className="fixed inset-0 bg-gray-500 bg-opacity-75 flex items-center justify-center z-50">
              <div className="bg-white dark:bg-gray-800 rounded-lg p-6 max-w-md w-full mx-4">
                <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">
                  Add New Scope
                </h3>
                <form onSubmit={addScope}>
                  <div className="mb-4">
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Server
                    </label>
                    <select
                      value={formData.server_id}
                      onChange={(e) => setData('server_id', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-900 text-gray-900 dark:text-white"
                    >
                      <option value="all">All Servers</option>
                      {servers.map((server) => (
                        <option key={server.id} value={server.id}>
                          {server.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="mb-4">
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Stack Pattern
                    </label>
                    <input
                      type="text"
                      value={formData.stack_pattern}
                      onChange={(e) => setData('stack_pattern', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-900 text-gray-900 dark:text-white"
                      placeholder="* or specific-stack or prod-*"
                      required
                    />
                    <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                      Use * for all stacks, or specify patterns like "prod-*"
                    </p>
                  </div>

                  <div className="mb-4">
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Permissions
                    </label>
                    <div className="space-y-2 max-h-64 overflow-y-auto border border-gray-300 dark:border-gray-600 rounded-md p-3 bg-white dark:bg-gray-900">
                      {PERMISSIONS.map((perm) => (
                        <label
                          key={perm.value}
                          className="flex items-start space-x-3 p-2 hover:bg-gray-50 dark:hover:bg-gray-800 rounded cursor-pointer"
                        >
                          <input
                            type="checkbox"
                            checked={formData.permissions.includes(perm.value)}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setData('permissions', [...formData.permissions, perm.value]);
                              } else {
                                setData(
                                  'permissions',
                                  formData.permissions.filter((p) => p !== perm.value)
                                );
                              }
                            }}
                            className="mt-1 h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                          />
                          <div className="flex-1">
                            <span className="text-sm font-medium text-gray-900 dark:text-white">
                              {perm.label}
                            </span>
                            <div className="text-xs text-gray-500 dark:text-gray-400">
                              {perm.value}
                            </div>
                          </div>
                        </label>
                      ))}
                    </div>
                    <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                      Selected: {formData.permissions.length} permission
                      {formData.permissions.length !== 1 ? 's' : ''}
                    </p>
                  </div>

                  <div className="flex justify-end space-x-3">
                    <button
                      type="button"
                      onClick={() => {
                        setShowAddModal(false);
                        reset();
                      }}
                      className="px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-md hover:bg-gray-50 dark:hover:bg-gray-700"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={processing}
                      className="px-4 py-2 bg-blue-600 dark:bg-blue-700 text-white rounded-md hover:bg-blue-700 dark:hover:bg-blue-600 disabled:opacity-50"
                    >
                      Add Scope
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}

          {/* Scopes List */}
          {loading ? (
            <div className="text-center py-12">
              <p className="text-gray-500 dark:text-gray-400">Loading scopes...</p>
            </div>
          ) : scopes.length === 0 ? (
            <div className="text-center py-12 bg-white dark:bg-gray-800 rounded-lg shadow">
              <ShieldCheckIcon className="mx-auto h-12 w-12 text-gray-400" />
              <h3 className="mt-2 text-sm font-medium text-gray-900 dark:text-white">
                No scopes configured
              </h3>
              <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                Add scopes to grant this API key access to specific resources.
              </p>
              <div className="mt-6">
                <button
                  onClick={() => setShowAddModal(true)}
                  className="inline-flex items-center px-4 py-2 bg-blue-600 dark:bg-blue-700 text-white rounded-md hover:bg-blue-700 dark:hover:bg-blue-600"
                >
                  <PlusIcon className="h-5 w-5 mr-2" />
                  Add Scope
                </button>
              </div>
            </div>
          ) : (
            <div className="bg-white dark:bg-gray-800 shadow overflow-hidden sm:rounded-md">
              <ul className="divide-y divide-gray-200 dark:divide-gray-700">
                {scopes.map((scope) => (
                  <li key={scope.id} className="px-6 py-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-4 flex-1">
                        <div className="flex-shrink-0">
                          <ShieldCheckIcon className="h-8 w-8 text-blue-600 dark:text-blue-400" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center space-x-2 mb-2">
                            <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 dark:bg-blue-900/20 text-blue-800 dark:text-blue-400">
                              {scope.permission}
                            </span>
                            {scope.server_id ? (
                              <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-purple-100 dark:bg-purple-900/20 text-purple-800 dark:text-purple-400">
                                <ServerIcon className="h-3 w-3 mr-1" />
                                {scope.server_name || `Server #${scope.server_id}`}
                              </span>
                            ) : (
                              <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-300">
                                All Servers
                              </span>
                            )}
                            <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 dark:bg-green-900/20 text-green-800 dark:text-green-400">
                              Pattern: {scope.stack_pattern}
                            </span>
                          </div>
                          <div className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                            <p>
                              {PERMISSIONS.find((p) => p.value === scope.permission)?.label ||
                                scope.permission}
                            </p>
                          </div>
                        </div>
                      </div>

                      <div className="flex-shrink-0">
                        <button
                          onClick={() => removeScope(scope.id)}
                          className="inline-flex items-center px-3 py-2 border border-transparent text-sm leading-4 font-medium rounded-md text-red-700 dark:text-red-400 bg-red-100 dark:bg-red-900/20 hover:bg-red-200 dark:hover:bg-red-900/30"
                        >
                          <TrashIcon className="h-4 w-4 mr-1" />
                          Remove
                        </button>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="mt-8 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
            <div className="flex">
              <div className="flex-shrink-0">
                <ShieldCheckIcon className="h-5 w-5 text-blue-400" />
              </div>
              <div className="ml-3">
                <p className="text-sm text-blue-700 dark:text-blue-300">
                  <strong>About Scopes:</strong> Scopes define what this API key can access. Each
                  scope combines a server (or all servers), a stack pattern (with wildcard support),
                  and a specific permission. The API key's effective permissions are limited by your
                  user account's permissions.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
}
