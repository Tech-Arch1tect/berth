import React, { useState } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { useQueryClient } from '@tanstack/react-query';
import { cn } from '../../../../shared/utils/cn';
import { theme } from '../../../../shared/theme';
import { ConfirmationModal } from '../../../../shared/components/ConfirmationModal';
import { LoadingSpinner } from '../../../../shared/components/LoadingSpinner';
import { Modal } from '../../../../shared/components/Modal';
import { Table } from '../../../../shared/components/Table';
import { useDocumentTitle } from '../../../../shared/hooks/useDocumentTitle';
import { PlusIcon, ShieldCheckIcon } from '@heroicons/react/24/outline';
import {
  useGetApiV1AdminRoles,
  usePostApiV1AdminRoles,
  usePutApiV1AdminRolesId,
  useDeleteApiV1AdminRolesId,
  getGetApiV1AdminRolesQueryKey,
} from '../../../../api/generated/admin/admin';
import type { RoleInfo } from '../../../../api/generated/models';

const EMPTY_FORM = { name: '', description: '' };

export default function AdminRoles() {
  useDocumentTitle('Roles');
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [editingRole, setEditingRole] = useState<RoleInfo | null>(null);
  const [roleToDelete, setRoleToDelete] = useState<RoleInfo | null>(null);
  const [formData, setFormData] = useState(EMPTY_FORM);
  const [formError, setFormError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const { data: rolesResponse, isLoading: rolesLoading } = useGetApiV1AdminRoles();
  const roles = rolesResponse?.data?.roles ?? [];

  const invalidateRoles = () =>
    queryClient.invalidateQueries({ queryKey: getGetApiV1AdminRolesQueryKey() });

  const createRoleMutation = usePostApiV1AdminRoles();
  const updateRoleMutation = usePutApiV1AdminRolesId();
  const deleteRoleMutation = useDeleteApiV1AdminRolesId();

  const saving = createRoleMutation.isPending || updateRoleMutation.isPending;

  const openCreateForm = () => {
    setEditingRole(null);
    setFormData(EMPTY_FORM);
    setFormError(null);
    setShowForm(true);
  };

  const openEditForm = (role: RoleInfo) => {
    if (role.is_admin) return;
    setEditingRole(role);
    setFormData({ name: role.name, description: role.description });
    setFormError(null);
    setShowForm(true);
  };

  const closeForm = () => {
    setShowForm(false);
    setEditingRole(null);
    setFormData(EMPTY_FORM);
    setFormError(null);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    const onSuccess = () => {
      invalidateRoles();
      closeForm();
    };

    const onError = (err: unknown) => {
      const errorData = err as { message?: string; error?: string };
      setFormError(errorData.message || errorData.error || 'Operation failed');
    };

    if (editingRole) {
      updateRoleMutation.mutate({ id: editingRole.id, data: formData }, { onSuccess, onError });
    } else {
      createRoleMutation.mutate({ data: formData }, { onSuccess, onError });
    }
  };

  const confirmDelete = () => {
    if (!roleToDelete) return;
    setError(null);

    deleteRoleMutation.mutate(
      { id: roleToDelete.id },
      {
        onSuccess: () => {
          invalidateRoles();
          setRoleToDelete(null);
        },
        onError: (err) => {
          const errorData = err as { message?: string; error?: string };
          setError(errorData.message || errorData.error || 'Failed to delete role');
          setRoleToDelete(null);
        },
      }
    );
  };

  const accessBadge = (role: RoleInfo) =>
    role.is_admin ? (
      <span className={cn(theme.badges.tag.base, theme.badges.tag.danger)}>
        Full access to all servers
      </span>
    ) : (
      <span className={cn(theme.badges.tag.base, theme.badges.tag.info)}>
        Pattern-based stack access
      </span>
    );

  const actionButtons = (role: RoleInfo) =>
    role.is_admin ? (
      <span className={cn('text-sm', theme.text.subtle)}>System role</span>
    ) : (
      <div className="flex flex-wrap justify-end gap-2">
        <button
          onClick={() => openEditForm(role)}
          aria-label={`Edit role ${role.name}`}
          className={cn('inline-flex min-h-[44px] items-center text-sm', theme.buttons.secondary)}
        >
          Edit
        </button>
        <button
          onClick={() =>
            navigate({
              to: '/admin/roles/$roleid/stack-permissions',
              params: { roleid: String(role.id) },
            })
          }
          aria-label={`Manage stack permissions for role ${role.name}`}
          className={cn('inline-flex min-h-[44px] items-center text-sm', theme.buttons.secondary)}
        >
          Permissions
        </button>
        <button
          onClick={() => setRoleToDelete(role)}
          aria-label={`Delete role ${role.name}`}
          className={cn('inline-flex min-h-[44px] items-center text-sm', theme.buttons.danger)}
        >
          Delete
        </button>
      </div>
    );

  if (rolesLoading) {
    return <LoadingSpinner size="lg" text="Loading roles..." fullScreen />;
  }

  return (
    <div className="h-full overflow-auto">
      <div className="max-w-7xl mx-auto px-4 py-6 sm:px-6 lg:px-8">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <h1 className={cn('text-2xl font-bold sm:text-3xl', theme.text.strong)}>Roles</h1>
          <button
            type="button"
            onClick={openCreateForm}
            className={cn('inline-flex items-center', theme.buttons.primary)}
          >
            <PlusIcon className="h-5 w-5 mr-2" />
            Add Role
          </button>
        </div>

        {error && (
          <div
            className={cn(
              'mb-4 p-4 rounded-md border',
              theme.intent.danger.surface,
              theme.intent.danger.border
            )}
          >
            <p className={cn('text-sm', theme.intent.danger.textStrong)}>{error}</p>
          </div>
        )}

        <div className={theme.table.panel}>
          <Table<RoleInfo>
            data={roles}
            keyExtractor={(role) => role.id.toString()}
            emptyMessage="No roles defined yet"
            emptyIcon={<ShieldCheckIcon className={cn('h-12 w-12 mx-auto', theme.text.info)} />}
            columns={[
              {
                key: 'role',
                header: 'Role',
                render: (role) => (
                  <div className="min-w-0">
                    <div className={cn('text-sm font-medium capitalize', theme.text.strong)}>
                      {role.name}
                    </div>
                    {role.description && (
                      <div className={cn('text-sm', theme.text.muted)}>{role.description}</div>
                    )}
                  </div>
                ),
              },
              {
                key: 'access',
                header: 'Access',
                render: accessBadge,
              },
              {
                key: 'actions',
                header: '',
                className: 'text-right',
                render: actionButtons,
              },
            ]}
            renderCard={(role) => (
              <div className="space-y-2">
                <div className="flex flex-wrap items-center gap-2">
                  <p className={cn('text-sm font-medium capitalize', theme.text.strong)}>
                    {role.name}
                  </p>
                  {accessBadge(role)}
                </div>
                {role.description && (
                  <p className={cn('text-sm', theme.text.muted)}>{role.description}</p>
                )}
                {actionButtons(role)}
              </div>
            )}
          />
        </div>
      </div>

      <Modal
        isOpen={showForm}
        onClose={closeForm}
        title={editingRole ? `Edit Role: ${editingRole.name}` : 'Add Role'}
        size="md"
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          {formError && (
            <div
              className={cn(
                'p-4 rounded-md border',
                theme.intent.danger.surface,
                theme.intent.danger.border
              )}
            >
              <p className={cn('text-sm', theme.intent.danger.textStrong)}>{formError}</p>
            </div>
          )}
          <div>
            <label htmlFor="role-name" className={theme.forms.label}>
              Name
            </label>
            <input
              type="text"
              id="role-name"
              required
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className={cn('mt-1', theme.forms.input)}
            />
          </div>
          <div>
            <label htmlFor="role-description" className={theme.forms.label}>
              Description
            </label>
            <textarea
              id="role-description"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              rows={3}
              className={cn('mt-1', theme.forms.textarea)}
            />
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={closeForm} className={theme.buttons.secondary}>
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className={cn(theme.buttons.primary, 'disabled:opacity-50')}
            >
              {saving ? 'Saving...' : editingRole ? 'Update Role' : 'Add Role'}
            </button>
          </div>
        </form>
      </Modal>

      <ConfirmationModal
        isOpen={roleToDelete !== null}
        onClose={() => setRoleToDelete(null)}
        onConfirm={confirmDelete}
        title="Delete Role"
        message={`Are you sure you want to delete the role "${roleToDelete?.name}"? Users assigned this role will lose the access it grants. This action cannot be undone.`}
        confirmText="Delete"
        variant="danger"
        isLoading={deleteRoleMutation.isPending}
      />
    </div>
  );
}
