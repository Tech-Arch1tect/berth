import { useState } from 'react';
import { Head, router } from '@inertiajs/react';
import FlashMessages from '../../components/FlashMessages';
import { cn } from '../../utils/cn';
import { theme } from '../../theme';
import { ConfirmationModal } from '../../components/common/ConfirmationModal';
import { Table } from '../../components/common/Table';
import { ShieldCheckIcon } from '@heroicons/react/24/outline';
import {
  usePostApiV1AdminRoles,
  usePutApiV1AdminRolesId,
  useDeleteApiV1AdminRolesId,
} from '../../api/generated/admin/admin';

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
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingRole, setEditingRole] = useState<Role | null>(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [roleToDelete, setRoleToDelete] = useState<{ id: number; name: string } | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
  });
  const [error, setError] = useState<string | null>(null);

  const createRoleMutation = usePostApiV1AdminRoles();
  const updateRoleMutation = usePutApiV1AdminRolesId();
  const deleteRoleMutation = useDeleteApiV1AdminRolesId();

  const processing =
    createRoleMutation.isPending || updateRoleMutation.isPending || deleteRoleMutation.isPending;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const onSuccess = () => {
      router.reload();
      setEditingRole(null);
      setShowAddForm(false);
      setFormData({ name: '', description: '' });
    };

    const onError = (err: unknown) => {
      const errorData = err as { message?: string; error?: string };
      setError(errorData.message || errorData.error || 'Operation failed');
    };

    if (editingRole) {
      updateRoleMutation.mutate({ id: editingRole.id, data: formData }, { onSuccess, onError });
    } else {
      createRoleMutation.mutate({ data: formData }, { onSuccess, onError });
    }
  };

  const handleEdit = (role: Role) => {
    if (role.is_admin) return;
    setEditingRole(role);
    setShowAddForm(false);
    setError(null);
    setFormData({
      name: role.name,
      description: role.description,
    });
  };

  const handleCancelEdit = () => {
    setEditingRole(null);
    setError(null);
    setFormData({ name: '', description: '' });
  };

  const handleDeleteClick = (roleId: number, roleName: string, isAdmin: boolean) => {
    if (isAdmin) return;
    setRoleToDelete({ id: roleId, name: roleName });
    setShowDeleteModal(true);
  };

  const confirmDelete = () => {
    if (!roleToDelete) return;
    setError(null);

    deleteRoleMutation.mutate(
      { id: roleToDelete.id },
      {
        onSuccess: () => {
          router.reload();
          setShowDeleteModal(false);
          setRoleToDelete(null);
        },
        onError: (err) => {
          const errorData = err as { message?: string; error?: string };
          setError(errorData.message || errorData.error || 'Failed to delete role');
          setShowDeleteModal(false);
          setRoleToDelete(null);
        },
      }
    );
  };

  return (
    <>
      <Head title={title} />

      <div className="h-full overflow-auto">
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
            </div>
            <div className="mt-4 flex md:mt-0 md:ml-4">
              <button
                onClick={() => {
                  if (editingRole) {
                    handleCancelEdit();
                  } else {
                    setShowAddForm(!showAddForm);
                  }
                }}
                className={theme.buttons.primary}
              >
                {editingRole ? 'Cancel Edit' : showAddForm ? 'Cancel' : 'Add Role'}
              </button>
            </div>
          </div>

          <FlashMessages />

          {(showAddForm || editingRole) && (
            <div className={cn('mt-8', theme.cards.shell, theme.cards.padded)}>
              <div>
                <h3 className={cn('text-lg leading-6 font-medium mb-4', theme.text.strong)}>
                  {editingRole ? `Edit Role: ${editingRole.name}` : 'Add New Role'}
                </h3>
                <form onSubmit={handleSubmit} className="space-y-4">
                  {error && (
                    <div
                      className={cn(
                        'p-4 rounded-md',
                        theme.intent.danger.surface,
                        theme.intent.danger.border
                      )}
                    >
                      <p className={cn('text-sm', theme.intent.danger.textStrong)}>{error}</p>
                    </div>
                  )}
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <div className="sm:col-span-2">
                      <label className={theme.forms.label}>Name</label>
                      <input
                        type="text"
                        required
                        value={formData.name}
                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                        className={cn('mt-1', theme.forms.input)}
                      />
                    </div>
                    <div className="sm:col-span-2">
                      <label className={theme.forms.label}>Description</label>
                      <textarea
                        value={formData.description}
                        onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                        rows={3}
                        className={cn('mt-1', theme.forms.textarea)}
                      />
                    </div>
                  </div>
                  <div className="flex justify-end space-x-3">
                    <button
                      type="button"
                      onClick={() => {
                        if (editingRole) {
                          handleCancelEdit();
                        } else {
                          setShowAddForm(false);
                          setError(null);
                          setFormData({ name: '', description: '' });
                        }
                      }}
                      className={theme.buttons.secondary}
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={processing}
                      className={cn(
                        theme.buttons.primary,
                        processing && 'opacity-50 cursor-not-allowed'
                      )}
                    >
                      {processing ? 'Saving...' : editingRole ? 'Update Role' : 'Add Role'}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}

          <div className="mt-8 flex flex-col">
            <div className="-my-2 -mx-4 overflow-x-auto sm:-mx-6 lg:-mx-8">
              <div className="inline-block min-w-full py-2 align-middle md:px-6 lg:px-8">
                <div className={theme.table.panel}>
                  <Table<Role>
                    data={roles}
                    keyExtractor={(role) => role.id.toString()}
                    emptyMessage="No roles defined yet"
                    emptyIcon={
                      <ShieldCheckIcon className={cn('h-12 w-12 mx-auto', theme.text.info)} />
                    }
                    columns={[
                      {
                        key: 'role',
                        header: 'Role',
                        render: (role) => (
                          <div className="flex items-center">
                            <div
                              className={cn(
                                'flex-shrink-0 h-10 w-10 rounded-full flex items-center justify-center',
                                role.is_admin
                                  ? 'bg-amber-100 dark:bg-amber-900/30'
                                  : theme.surface.muted
                              )}
                            >
                              <ShieldCheckIcon
                                className={cn(
                                  'h-5 w-5',
                                  role.is_admin
                                    ? 'text-amber-600 dark:text-amber-400'
                                    : theme.text.muted
                                )}
                              />
                            </div>
                            <div className="ml-4">
                              <div
                                className={cn('text-sm font-medium capitalize', theme.text.strong)}
                              >
                                {role.name}
                              </div>
                              {role.description && (
                                <div className={cn('text-sm', theme.text.muted)}>
                                  {role.description}
                                </div>
                              )}
                            </div>
                          </div>
                        ),
                      },
                      {
                        key: 'type',
                        header: 'Type',
                        render: (role) => (
                          <div className="flex flex-wrap gap-2">
                            {role.is_admin && (
                              <span className={cn(theme.badges.tag.base, theme.badges.tag.danger)}>
                                Admin
                              </span>
                            )}
                            <span className={cn(theme.badges.tag.base, theme.badges.tag.info)}>
                              {role.is_admin ? 'Full Access' : 'Stack Permissions'}
                            </span>
                          </div>
                        ),
                      },
                      {
                        key: 'info',
                        header: 'Info',
                        render: (role) => (
                          <span className={cn('text-sm', theme.text.muted)}>
                            {role.is_admin
                              ? 'Full access to all servers'
                              : 'Pattern-based stack access'}
                          </span>
                        ),
                      },
                      {
                        key: 'actions',
                        header: '',
                        className: 'text-right',
                        render: (role) => (
                          <div className="text-sm font-medium space-x-2">
                            {!role.is_admin && (
                              <>
                                <button
                                  onClick={() => handleEdit(role)}
                                  className={cn('hover:underline', theme.text.info)}
                                >
                                  Edit
                                </button>
                                <button
                                  onClick={() =>
                                    router.visit(`/admin/roles/${role.id}/stack-permissions`)
                                  }
                                  className={cn('hover:underline', theme.text.info)}
                                >
                                  Permissions
                                </button>
                                <button
                                  onClick={() =>
                                    handleDeleteClick(role.id, role.name, role.is_admin)
                                  }
                                  className={cn('hover:underline', theme.text.danger)}
                                >
                                  Delete
                                </button>
                              </>
                            )}
                            {role.is_admin && (
                              <span className={cn('text-sm', theme.text.subtle)}>System role</span>
                            )}
                          </div>
                        ),
                      },
                    ]}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <ConfirmationModal
        isOpen={showDeleteModal}
        onClose={() => {
          setShowDeleteModal(false);
          setRoleToDelete(null);
        }}
        onConfirm={confirmDelete}
        title="Delete Role"
        message={`Are you sure you want to delete the role "${roleToDelete?.name}"? This action cannot be undone.`}
        variant="danger"
      />
    </>
  );
}
