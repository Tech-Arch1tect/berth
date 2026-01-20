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
import { cn } from '../../utils/cn';
import { theme } from '../../theme';
import { EmptyState } from '../../components/common/EmptyState';
import { LoadingSpinner } from '../../components/common/LoadingSpinner';
import { Modal } from '../../components/common/Modal';
import { ConfirmationModal } from '../../components/common/ConfirmationModal';
import { useGetApiV1Servers } from '../../api/generated/servers/servers';

interface Scope {
  id: number;
  server_id: number | null;
  server_name?: string;
  stack_pattern: string;
  permission: string;
  created_at: string;
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
  { value: 'servers.read', label: 'View accessible servers' },
  { value: 'stacks.read', label: 'View stacks and containers' },
  { value: 'stacks.manage', label: 'Start/stop/deploy/remove stacks' },
  { value: 'stacks.create', label: 'Create new stacks' },
  { value: 'files.read', label: 'Read files within stacks' },
  { value: 'files.write', label: 'Modify files within stacks' },
  { value: 'logs.read', label: 'View container logs' },
  { value: 'logs.operations.read', label: 'View own operation logs' },
  { value: 'registries.manage', label: 'Create, update, and delete registry credentials' },
  {
    value: 'docker.maintenance.read',
    label: 'View Docker usage statistics and system information (server-wide)',
  },
  {
    value: 'docker.maintenance.write',
    label: 'Run Docker maintenance tasks like pruning images and containers (server-wide)',
  },

  { value: 'admin.servers.read', label: 'View server configurations (admin)' },
  { value: 'admin.servers.write', label: 'Create/modify/delete servers (admin)' },
  { value: 'admin.users.read', label: 'View users and their roles (admin)' },
  { value: 'admin.users.write', label: 'Create users, assign/revoke roles (admin)' },
  { value: 'admin.roles.read', label: 'View roles and permissions (admin)' },
  { value: 'admin.roles.write', label: 'Create/modify/delete roles and permissions (admin)' },
  { value: 'admin.permissions.read', label: 'List available permissions (admin)' },
  { value: 'admin.logs.read', label: 'View all operation logs (admin)' },
  { value: 'admin.audit.read', label: 'View security audit logs (admin)' },
  { value: 'admin.system.export', label: 'Export system configuration (admin)' },
  { value: 'admin.system.import', label: 'Import system configuration (admin)' },
];

export default function APIKeyScopesPage({ api_key_id }: ScopesProps) {
  const { props } = usePage();
  const csrfToken = props.csrfToken as string | undefined;
  const [scopes, setScopes] = useState<Scope[]>([]);
  const [scopesLoading, setScopesLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [scopeToRemove, setScopeToRemove] = useState<number | null>(null);
  const [isRemoving, setIsRemoving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const { data: serversResponse, isLoading: serversLoading } = useGetApiV1Servers();
  const servers = serversResponse?.data?.servers ?? [];

  const {
    data: formData,
    setData,
    processing,
    reset,
  } = useForm<NewScopeForm>({
    server_id: '',
    stack_pattern: '*',
    permissions: [],
  });

  const loadScopes = async () => {
    try {
      const response = await axios.get(`/api/api-keys/${api_key_id}/scopes`);
      if (response.data.success) {
        setScopes(response.data.data);
      }
    } catch (error) {
      console.error('Failed to load scopes:', error);
    } finally {
      setScopesLoading(false);
    }
  };

  useEffect(() => {
    loadScopes();
  }, []);

  const addScope = async (e: React.FormEvent) => {
    e.preventDefault();

    if (formData.permissions.length === 0) {
      setErrorMessage('Please select at least one permission');
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
      setErrorMessage(error.response?.data?.message || 'Failed to add scopes');
    }
  };

  const handleRemoveClick = (scopeId: number) => {
    setScopeToRemove(scopeId);
  };

  const confirmRemove = async () => {
    if (!scopeToRemove) return;

    try {
      setIsRemoving(true);
      await axios.delete(`/api/api-keys/${api_key_id}/scopes/${scopeToRemove}`, {
        headers: {
          'X-CSRF-Token': csrfToken || '',
        },
      });

      loadScopes();
      router.reload({ only: ['flash'] });
      setScopeToRemove(null);
    } catch (error) {
      console.error('Failed to remove scope:', error);
      setErrorMessage('Failed to remove scope');
    } finally {
      setIsRemoving(false);
    }
  };

  return (
    <>
      <Head title="Manage API Key Scopes" />
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="py-8">
          <div className="mb-6">
            <button
              onClick={() => router.visit('/api-keys')}
              className={cn(
                'inline-flex items-center text-sm',
                theme.text.muted,
                'hover:text-slate-900 dark:hover:text-white'
              )}
            >
              <ArrowLeftIcon className="h-4 w-4 mr-1" />
              Back to API Keys
            </button>
          </div>

          <div className="flex justify-between items-center mb-8">
            <h1 className={cn('text-3xl font-bold', theme.text.strong)}>Manage API Key Scopes</h1>
            <button
              onClick={() => setShowAddModal(true)}
              className={cn('inline-flex items-center', theme.buttons.primary)}
            >
              <PlusIcon className="h-5 w-5 mr-2" />
              Add Scope
            </button>
          </div>

          <FlashMessages className="mb-6" />

          {/* Add Scope Modal */}
          <Modal
            isOpen={showAddModal}
            onClose={() => {
              setShowAddModal(false);
              reset();
            }}
            title="Add New Scope"
            size="md"
            footer={
              <div className="flex justify-end space-x-3 w-full">
                <button
                  type="button"
                  onClick={() => {
                    setShowAddModal(false);
                    reset();
                  }}
                  className={theme.buttons.secondary}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  form="add-scope-form"
                  disabled={processing}
                  className={cn(theme.buttons.primary, processing && 'opacity-50')}
                >
                  Add Scope
                </button>
              </div>
            }
          >
            <form id="add-scope-form" onSubmit={addScope}>
              <div className="mb-4">
                <label className={cn(theme.forms.label, 'mb-2')}>Server</label>
                <select
                  value={formData.server_id}
                  onChange={(e) => setData('server_id', e.target.value)}
                  className={cn('w-full', theme.forms.select)}
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
                <label className={cn(theme.forms.label, 'mb-2')}>Stack Pattern</label>
                <input
                  type="text"
                  value={formData.stack_pattern}
                  onChange={(e) => setData('stack_pattern', e.target.value)}
                  className={cn('w-full', theme.forms.input)}
                  placeholder="* or specific-stack or prod-*"
                  required
                />
                <p className={cn('mt-1 text-sm', theme.text.muted)}>
                  Use * for all stacks, or specify patterns like "prod-*"
                </p>
              </div>

              <div className="mb-4">
                <label className={cn(theme.forms.label, 'mb-2')}>Permissions</label>
                <div
                  className={cn(
                    'space-y-2 max-h-64 overflow-y-auto rounded-md p-3',
                    theme.surface.muted
                  )}
                >
                  {PERMISSIONS.map((perm) => (
                    <label
                      key={perm.value}
                      className={cn(
                        'flex items-start space-x-3 p-2 rounded cursor-pointer',
                        theme.buttons.ghost
                      )}
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
                        className={theme.forms.checkbox}
                      />
                      <div className="flex-1">
                        <span className={cn('text-sm font-medium', theme.text.strong)}>
                          {perm.label}
                        </span>
                        <div className={cn('text-xs', theme.text.muted)}>{perm.value}</div>
                      </div>
                    </label>
                  ))}
                </div>
                <p className={cn('mt-1 text-sm', theme.text.muted)}>
                  Selected: {formData.permissions.length} permission
                  {formData.permissions.length !== 1 ? 's' : ''}
                </p>
              </div>
            </form>
          </Modal>

          {/* Scopes List */}
          {scopesLoading || serversLoading ? (
            <LoadingSpinner size="lg" text="Loading scopes..." />
          ) : scopes.length === 0 ? (
            <EmptyState
              icon={ShieldCheckIcon}
              title="No scopes configured"
              description="Add scopes to grant this API key access to specific resources."
              variant="info"
              action={{
                label: 'Add Scope',
                onClick: () => setShowAddModal(true),
              }}
            />
          ) : (
            <div className={cn(theme.surface.panel, 'shadow overflow-hidden sm:rounded-md')}>
              <ul className="divide-y divide-slate-200 dark:divide-slate-800">
                {scopes.map((scope) => (
                  <li key={scope.id} className="px-6 py-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-4 flex-1">
                        <div className="flex-shrink-0">
                          <ShieldCheckIcon className={cn('h-8 w-8', theme.text.info)} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center space-x-2 mb-2">
                            <span className={cn(theme.badges.tag.base, theme.badges.tag.info)}>
                              {scope.permission}
                            </span>
                            {scope.server_id ? (
                              <span
                                className={cn(
                                  theme.badges.tag.base,
                                  'bg-purple-100 dark:bg-purple-900/20 text-purple-800 dark:text-purple-400'
                                )}
                              >
                                <ServerIcon className="h-3 w-3 mr-1" />
                                {scope.server_name || `Server #${scope.server_id}`}
                              </span>
                            ) : (
                              <span className={cn(theme.badges.tag.base, theme.badges.tag.neutral)}>
                                All Servers
                              </span>
                            )}
                            <span className={cn(theme.badges.tag.base, theme.badges.tag.success)}>
                              Pattern: {scope.stack_pattern}
                            </span>
                          </div>
                          <div className={cn('mt-1 text-sm', theme.text.muted)}>
                            <p>
                              {PERMISSIONS.find((p) => p.value === scope.permission)?.label ||
                                scope.permission}
                            </p>
                          </div>
                        </div>
                      </div>

                      <div className="flex-shrink-0">
                        <button
                          onClick={() => handleRemoveClick(scope.id)}
                          className={cn(
                            'inline-flex items-center text-sm leading-4',
                            theme.buttons.danger
                          )}
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

          <div className={cn(theme.intent.info.surface, 'mt-8 rounded-lg p-4')}>
            <div className="flex">
              <div className="flex-shrink-0">
                <ShieldCheckIcon className={cn('h-5 w-5', theme.intent.info.icon)} />
              </div>
              <div className="ml-3">
                <p className={cn('text-sm', theme.intent.info.textStrong)}>
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

      {/* Remove Scope Confirmation Modal */}
      <ConfirmationModal
        isOpen={!!scopeToRemove}
        onClose={() => setScopeToRemove(null)}
        onConfirm={confirmRemove}
        title="Remove Scope"
        message="Are you sure you want to remove this scope? The API key will lose these permissions."
        confirmText="Remove"
        variant="warning"
        isLoading={isRemoving}
      />

      {/* Error Modal */}
      <Modal
        isOpen={!!errorMessage}
        onClose={() => setErrorMessage(null)}
        title="Error"
        size="sm"
        footer={
          <div className="flex justify-end">
            <button onClick={() => setErrorMessage(null)} className={theme.buttons.primary}>
              OK
            </button>
          </div>
        }
      >
        <p className={cn(theme.text.standard)}>{errorMessage}</p>
      </Modal>
    </>
  );
}
