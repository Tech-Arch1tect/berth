import React, { useState } from 'react';
import { Head, router } from '@inertiajs/react';
import FlashMessages from '../../components/FlashMessages';
import { cn } from '../../utils/cn';
import { theme } from '../../theme';
import { EmptyState } from '../../components/common/EmptyState';
import { ConfirmationModal } from '../../components/common/ConfirmationModal';
import { ShieldCheckIcon } from '@heroicons/react/24/outline';

interface Role {
  id: number;
  name: string;
  description: string;
  is_admin: boolean;
}

interface Props {
  title: string;
  roles: Role[];
  csrfToken?: string;
}

export default function AdminRoles({ title, roles, csrfToken }: Props) {
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingRole, setEditingRole] = useState<Role | null>(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [roleToDelete, setRoleToDelete] = useState<{ id: number; name: string } | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
  });
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setProcessing(true);

    try {
      const url = editingRole ? `/api/v1/admin/roles/${editingRole.id}` : '/api/v1/admin/roles';
      const method = editingRole ? 'PUT' : 'POST';

      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-Token': csrfToken || '',
        },
        credentials: 'include',
        body: JSON.stringify(formData),
      });

      if (response.ok) {
        router.reload();
        setEditingRole(null);
        setShowAddForm(false);
        setFormData({ name: '', description: '' });
      } else {
        const errorData = await response.json();
        setError(errorData.message || errorData.error || 'Operation failed');
      }
    } catch (err) {
      setError('Network error: ' + err);
    } finally {
      setProcessing(false);
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

  const confirmDelete = async () => {
    if (!roleToDelete) return;

    setError(null);
    setProcessing(true);

    try {
      const response = await fetch(`/api/v1/admin/roles/${roleToDelete.id}`, {
        method: 'DELETE',
        headers: {
          'X-CSRF-Token': csrfToken || '',
        },
        credentials: 'include',
      });

      if (response.ok) {
        router.reload();
        setShowDeleteModal(false);
        setRoleToDelete(null);
      } else {
        const errorData = await response.json();
        setError(errorData.message || errorData.error || 'Failed to delete role');
        setShowDeleteModal(false);
      }
    } catch (err) {
      setError('Network error: ' + err);
      setShowDeleteModal(false);
    } finally {
      setProcessing(false);
      setRoleToDelete(null);
    }
  };

  return (
    <>
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
              className={cn('ml-3', theme.buttons.primary)}
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

        <div className="mt-8 grid gap-6">
          {roles.map((role) => (
            <div key={role.id} className={cn(theme.cards.shell)}>
              <div className={cn('px-6 py-4 border-b', theme.surface.muted)}>
                <div className="flex items-center justify-between">
                  <div>
                    <h3
                      className={cn(
                        'text-lg font-medium capitalize flex items-center',
                        theme.text.strong
                      )}
                    >
                      {role.name}
                      {role.is_admin && (
                        <span
                          className={cn('ml-3', theme.badges.tag.base, theme.badges.tag.danger)}
                        >
                          Admin
                        </span>
                      )}
                      <span className={cn('ml-3', theme.badges.tag.base, theme.badges.tag.info)}>
                        {role.is_admin ? 'Full Access' : 'Stack Permissions'}
                      </span>
                    </h3>
                    <p className={cn('mt-1 text-sm', theme.text.muted)}>{role.description}</p>
                  </div>
                  <div className="flex items-center space-x-3">
                    {!role.is_admin && (
                      <>
                        <button
                          onClick={() => handleEdit(role)}
                          className={cn('text-sm font-medium', theme.text.info)}
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => handleDeleteClick(role.id, role.name, role.is_admin)}
                          className={cn('text-sm font-medium', theme.text.danger)}
                        >
                          Delete
                        </button>
                      </>
                    )}
                    {!role.is_admin && (
                      <button
                        onClick={() => router.visit(`/admin/roles/${role.id}/stack-permissions`)}
                        className={theme.buttons.secondary}
                      >
                        Stack Permissions
                      </button>
                    )}
                  </div>
                </div>
              </div>
              <div className="px-6 py-4">
                {role.is_admin ? (
                  <div className={cn('text-sm', theme.text.muted)}>
                    Admin users have full access to all servers and functionality. This role cannot
                    be modified or deleted.
                  </div>
                ) : (
                  <div className={cn('text-sm', theme.text.muted)}>
                    Stack permissions are managed using patterns. Click "Stack Permissions" to
                    configure access to specific stacks using patterns like *dev* or *prod*.
                  </div>
                )}
              </div>
            </div>
          ))}

          {roles.length === 0 && (
            <EmptyState
              icon={ShieldCheckIcon}
              title="No roles defined"
              description="Create your first role to manage user permissions and access control."
              variant="info"
              size="md"
            />
          )}
        </div>
      </div>

      {/* Delete Role Confirmation Modal */}
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
