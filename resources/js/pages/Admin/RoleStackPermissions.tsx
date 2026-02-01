import React, { useState } from 'react';
import { Head, router } from '@inertiajs/react';
import FlashMessages from '../../components/FlashMessages';
import { Breadcrumb } from '../../components/common/Breadcrumb';
import { Modal } from '../../components/common/Modal';
import { ConfirmationModal } from '../../components/common/ConfirmationModal';
import { cn } from '../../utils/cn';
import { theme } from '../../theme';
import { EmptyState } from '../../components/common/EmptyState';
import { ShieldCheckIcon } from '@heroicons/react/24/outline';
import {
  usePostApiV1AdminRolesRoleIdStackPermissions,
  useDeleteApiV1AdminRolesRoleIdStackPermissionsPermissionId,
} from '../../api/generated/admin/admin';

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
  skip_ssl_verification: boolean;
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
}

export default function RoleStackPermissions({
  title,
  role,
  servers = [],
  permissions = [],
  permissionRules = [],
}: Props) {
  const [showAddRule, setShowAddRule] = useState(false);
  const [showAddToPattern, setShowAddToPattern] = useState<{
    serverid: number;
    stackPattern: string;
  } | null>(null);
  const [ruleToDelete, setRuleToDelete] = useState<number | null>(null);

  const createPermissionMutation = usePostApiV1AdminRolesRoleIdStackPermissions();
  const deletePermissionMutation = useDeleteApiV1AdminRolesRoleIdStackPermissionsPermissionId();

  const adding = createPermissionMutation.isPending;
  const deleting = deletePermissionMutation.isPending ? ruleToDelete : null;
  const [errorModal, setErrorModal] = useState<{ isOpen: boolean; message: string }>({
    isOpen: false,
    message: '',
  });

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

  const getServerName = (serverid: number) => {
    return servers.find((s) => s.id === serverid)?.name || 'Unknown Server';
  };

  const getPermissionName = (permissionId: number) => {
    return permissions.find((p) => p.id === permissionId)?.name || 'Unknown Permission';
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

  const handleShowAddToPattern = (serverid: number, stackPattern: string) => {
    setShowAddToPattern({ serverid, stackPattern });
    setAddToPatternRule({
      server_id: serverid,
      permission_ids: [],
      stack_pattern: stackPattern,
    });
  };

  const getAvailablePermissionsForPattern = (serverid: number, stackPattern: string) => {
    const existingRules = (permissionRules || []).filter(
      (rule) => rule.server_id === serverid && rule.stack_pattern === stackPattern
    );
    const existingPermissionIds = existingRules.map((rule) => rule.permission_id);
    return permissions.filter((permission) => !existingPermissionIds.includes(permission.id));
  };

  const handleAddRule = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newRule.server_id || newRule.permission_ids.length === 0) return;

    try {
      const promises = newRule.permission_ids.map((permissionId) =>
        createPermissionMutation.mutateAsync({
          roleId: role.id,
          data: {
            server_id: parseInt(newRule.server_id),
            permission_id: permissionId,
            stack_pattern: newRule.stack_pattern || '*',
          },
        })
      );

      await Promise.all(promises);
      router.reload();
      setShowAddRule(false);
      setNewRule({ server_id: '', permission_ids: [], stack_pattern: '*' });
    } catch (error) {
      const errorData = error as { message?: string; error?: string };
      setErrorModal({
        isOpen: true,
        message:
          'Failed to add permission rules: ' +
          (errorData.message || errorData.error || 'Unknown error'),
      });
    }
  };

  const handleAddToPattern = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!addToPatternRule.server_id || addToPatternRule.permission_ids.length === 0) return;

    try {
      const promises = addToPatternRule.permission_ids.map((permissionId) =>
        createPermissionMutation.mutateAsync({
          roleId: role.id,
          data: {
            server_id: addToPatternRule.server_id,
            permission_id: permissionId,
            stack_pattern: addToPatternRule.stack_pattern,
          },
        })
      );

      await Promise.all(promises);
      router.reload();
      setShowAddToPattern(null);
      setAddToPatternRule({ server_id: 0, permission_ids: [], stack_pattern: '' });
    } catch (error) {
      const errorData = error as { message?: string; error?: string };
      setErrorModal({
        isOpen: true,
        message:
          'Failed to add permissions to pattern: ' +
          (errorData.message || errorData.error || 'Unknown error'),
      });
    }
  };

  const handleDeleteRule = () => {
    if (ruleToDelete === null) return;

    deletePermissionMutation.mutate(
      { roleId: role.id, permissionId: ruleToDelete },
      {
        onSuccess: () => {
          router.reload();
          setRuleToDelete(null);
        },
        onError: (error) => {
          const errorData = error as { message?: string; error?: string };
          setErrorModal({
            isOpen: true,
            message:
              'Failed to delete permission rule: ' +
              (errorData.message || errorData.error || 'Unknown error'),
          });
          setRuleToDelete(null);
        },
      }
    );
  };

  const groupedRules = (permissionRules || []).reduce(
    (acc, rule) => {
      const serverName = getServerName(rule.server_id);
      const key = `${serverName}-${rule.stack_pattern}`;
      if (!acc[key]) {
        acc[key] = {
          serverName,
          serverid: rule.server_id,
          stackPattern: rule.stack_pattern,
          rules: [],
        };
      }
      acc[key].rules.push(rule);
      return acc;
    },
    {} as Record<
      string,
      { serverName: string; serverid: number; stackPattern: string; rules: PermissionRule[] }
    >
  );

  return (
    <>
      <Head title={title} />

      <div className="h-full overflow-auto">
        <div className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
          <div className="md:flex md:items-center md:justify-between">
            <div className="flex-1 min-w-0">
              <Breadcrumb
                homeHref="/admin/roles"
                items={[
                  { label: 'Roles', href: '/admin/roles' },
                  { label: `${role.name} Stack Permissions` },
                ]}
              />
              <h2
                className={cn(
                  'mt-2 text-2xl font-bold leading-7 sm:text-3xl sm:truncate',
                  theme.text.strong
                )}
              >
                {title}
              </h2>
              <p className={cn('mt-1 text-sm', theme.text.subtle)}>
                Manage stack-based permissions for the <strong>{role.name}</strong> role using
                patterns
              </p>
            </div>
            <div className="mt-4 flex md:mt-0 md:ml-4">
              <button onClick={() => setShowAddRule(true)} className={theme.buttons.primary}>
                Add Permission Rule
              </button>
            </div>
          </div>

          <FlashMessages />

          {/* Add Rule Modal */}
          <Modal
            isOpen={showAddRule}
            onClose={() => setShowAddRule(false)}
            title="Add Permission Rule"
            size="md"
            footer={
              <div className="flex justify-end space-x-3">
                <button
                  type="button"
                  onClick={() => setShowAddRule(false)}
                  className={theme.buttons.secondary}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  form="add-rule-form"
                  disabled={adding}
                  className={cn(theme.buttons.primary, 'disabled:opacity-50')}
                >
                  {adding ? 'Adding...' : 'Add Rule'}
                </button>
              </div>
            }
          >
            <form id="add-rule-form" onSubmit={handleAddRule} className="space-y-4">
              <div>
                <label className={cn('block mb-1', theme.forms.label)}>Server</label>
                <select
                  value={newRule.server_id}
                  onChange={(e) => setNewRule({ ...newRule, server_id: e.target.value })}
                  className={cn('w-full', theme.forms.select)}
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
                <label className={cn('block mb-3', theme.forms.label)}>Permissions</label>
                <div className="space-y-3">
                  {permissions.map((permission) => (
                    <div key={permission.id} className="flex items-start">
                      <div className="flex items-center h-5">
                        <input
                          id={`permission-${permission.id}`}
                          type="checkbox"
                          checked={newRule.permission_ids.includes(permission.id)}
                          onChange={() => handlePermissionToggle(permission.id)}
                          className={theme.forms.checkbox}
                        />
                      </div>
                      <div className="ml-3 text-sm">
                        <label
                          htmlFor={`permission-${permission.id}`}
                          className={cn('font-medium cursor-pointer', theme.text.standard)}
                        >
                          {permission.name}
                        </label>
                        <p className={theme.text.subtle}>{permission.description}</p>
                      </div>
                    </div>
                  ))}
                </div>
                {newRule.permission_ids.length === 0 && (
                  <p className={cn('mt-2 text-sm', theme.text.danger)}>
                    Please select at least one permission.
                  </p>
                )}
              </div>
              <div>
                <label className={cn('block mb-1', theme.forms.label)}>Stack Pattern</label>
                <input
                  type="text"
                  value={newRule.stack_pattern}
                  onChange={(e) => setNewRule({ ...newRule, stack_pattern: e.target.value })}
                  className={cn('w-full', theme.forms.input)}
                  placeholder="* (all stacks)"
                />
                <p className={cn('mt-1 text-xs', theme.text.subtle)}>
                  Use * for all stacks, *dev* for stacks containing 'dev', *dev*test* for complex
                  patterns
                </p>
              </div>
            </form>
          </Modal>

          {/* Add To Pattern Modal */}
          <Modal
            isOpen={showAddToPattern !== null}
            onClose={() => setShowAddToPattern(null)}
            title="Add Permissions to Pattern"
            size="md"
            footer={
              <div className="flex justify-end space-x-3">
                <button
                  type="button"
                  onClick={() => setShowAddToPattern(null)}
                  className={theme.buttons.secondary}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  form="add-to-pattern-form"
                  disabled={adding || addToPatternRule.permission_ids.length === 0}
                  className={cn(theme.buttons.primary, 'disabled:opacity-50')}
                >
                  {adding ? 'Adding...' : 'Add Permissions'}
                </button>
              </div>
            }
          >
            {showAddToPattern && (
              <>
                <div className={cn('mb-4 p-3 rounded-md', theme.intent.info.surface)}>
                  <p className={cn('text-sm', theme.intent.info.textStrong)}>
                    <strong>Server:</strong> {getServerName(showAddToPattern.serverid)}
                    <br />
                    <strong>Pattern:</strong>{' '}
                    <code className={cn('px-1 rounded', theme.surface.code)}>
                      {showAddToPattern.stackPattern}
                    </code>
                  </p>
                </div>
                <form id="add-to-pattern-form" onSubmit={handleAddToPattern} className="space-y-4">
                  <div>
                    <label className={cn('block mb-3', theme.forms.label)}>
                      Available Permissions
                    </label>
                    <div className="space-y-3">
                      {getAvailablePermissionsForPattern(
                        showAddToPattern.serverid,
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
                              className={theme.forms.checkbox}
                            />
                          </div>
                          <div className="ml-3 text-sm">
                            <label
                              htmlFor={`add-permission-${permission.id}`}
                              className={cn('font-medium cursor-pointer', theme.text.standard)}
                            >
                              {permission.name}
                            </label>
                            <p className={theme.text.subtle}>{permission.description}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                    {addToPatternRule.permission_ids.length === 0 && (
                      <p className={cn('mt-2 text-sm', theme.text.danger)}>
                        Please select at least one permission.
                      </p>
                    )}
                  </div>
                </form>
              </>
            )}
          </Modal>

          {/* Permission Rules */}
          <div className="mt-8">
            {(permissionRules || []).length === 0 ? (
              <EmptyState
                icon={ShieldCheckIcon}
                title="No permission rules"
                description="Get started by creating your first permission rule for this role."
                variant="info"
                action={{
                  label: 'Add Permission Rule',
                  onClick: () => setShowAddRule(true),
                }}
              />
            ) : (
              <div className="space-y-3">
                {Object.entries(groupedRules).map(([key, group]) => (
                  <div
                    key={key}
                    className={cn(
                      theme.surface.panel,
                      'border border-slate-200 dark:border-slate-700 rounded-lg overflow-hidden'
                    )}
                  >
                    <div className="px-4 py-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <h3 className={cn('text-base font-medium', theme.text.strong)}>
                            {group.serverName}
                          </h3>
                          <span className={cn(theme.badges.tag.base, theme.badges.tag.info)}>
                            {group.stackPattern}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          {getAvailablePermissionsForPattern(group.serverid, group.stackPattern)
                            .length > 0 && (
                            <button
                              onClick={() =>
                                handleShowAddToPattern(group.serverid, group.stackPattern)
                              }
                              className={cn(
                                'inline-flex items-center px-2 py-1 text-xs font-medium rounded',
                                theme.buttons.secondary
                              )}
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
                            onClick={() => setRuleToDelete(rule.id)}
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
          <div
            className={cn(
              'mt-6 rounded-lg p-4',
              theme.intent.info.surface,
              theme.intent.info.border
            )}
          >
            <h3 className={cn('text-sm font-medium mb-2', theme.intent.info.textStrong)}>
              Pattern Examples
            </h3>
            <div className={cn('text-xs space-y-2', theme.intent.info.textMuted)}>
              <div className="flex flex-wrap gap-x-4 gap-y-1">
                <span>
                  <code className={cn('px-1 rounded', theme.surface.code)}>*</code> All stacks
                </span>
                <span>
                  <code className={cn('px-1 rounded', theme.surface.code)}>*dev*</code> Contains
                  "dev"
                </span>
                <span>
                  <code className={cn('px-1 rounded', theme.surface.code)}>*prod*</code> Contains
                  "prod"
                </span>
                <span>
                  <code className={cn('px-1 rounded', theme.surface.code)}>app*</code> Starts with
                  "app"
                </span>
                <span>
                  <code className={cn('px-1 rounded', theme.surface.code)}>*-staging</code> Ends
                  with "-staging"
                </span>
              </div>
              <div className="flex flex-wrap gap-x-4 gap-y-1">
                <span>
                  <code className={cn('px-1 rounded', theme.surface.code)}>*dev*test*</code>{' '}
                  Contains "dev" then "test"
                </span>
                <span>
                  <code className={cn('px-1 rounded', theme.surface.code)}>api*staging*v1*</code>{' '}
                  Complex matching
                </span>
              </div>
              <p className="text-xs mt-2">
                Pattern matching is case-insensitive. Use multiple rules for different permissions
                per pattern.
              </p>
            </div>
          </div>

          {/* Delete Confirmation Modal */}
          <ConfirmationModal
            isOpen={ruleToDelete !== null}
            onClose={() => setRuleToDelete(null)}
            onConfirm={handleDeleteRule}
            title="Delete Permission Rule"
            message="Are you sure you want to delete this permission rule? This action cannot be undone."
            confirmText="Delete"
            variant="danger"
            isLoading={deleting !== null}
          />

          {/* Error Modal */}
          <Modal
            isOpen={errorModal.isOpen}
            onClose={() => setErrorModal({ isOpen: false, message: '' })}
            title="Error"
            size="sm"
            footer={
              <div className="flex justify-end">
                <button
                  onClick={() => setErrorModal({ isOpen: false, message: '' })}
                  className={theme.buttons.primary}
                >
                  OK
                </button>
              </div>
            }
          >
            <p className={cn(theme.text.standard)}>{errorModal.message}</p>
          </Modal>
        </div>
      </div>
    </>
  );
}
