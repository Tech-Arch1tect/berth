import React, { useState } from 'react';
import { Link } from '@tanstack/react-router';
import { useQueryClient } from '@tanstack/react-query';
import { cn } from '../../../../shared/utils/cn';
import { theme } from '../../../../shared/theme';
import { Table } from '../../../../shared/components/Table';
import { Modal } from '../../../../shared/components/Modal';
import { LoadingSpinner } from '../../../../shared/components/LoadingSpinner';
import { useDocumentTitle } from '../../../../shared/hooks/useDocumentTitle';
import { UserGroupIcon, PlusIcon } from '@heroicons/react/24/outline';
import {
  useGetApiV1AdminUsers,
  usePostApiV1AdminUsers,
  getGetApiV1AdminUsersQueryKey,
} from '../../../../api/generated/admin/admin';
import type { UserInfo } from '../../../../api/generated/models';

const EMPTY_FORM = {
  username: '',
  email: '',
  password: '',
  password_confirm: '',
};

export default function AdminUsers() {
  useDocumentTitle('Users');
  const queryClient = useQueryClient();

  const { data: usersResponse, isLoading: usersLoading } = useGetApiV1AdminUsers();
  const users = usersResponse?.data?.users ?? [];
  const [showCreateModal, setShowCreateModal] = useState(false);

  const [formData, setFormData] = useState(EMPTY_FORM);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const createUserMutation = usePostApiV1AdminUsers();

  const closeCreateModal = () => {
    setShowCreateModal(false);
    setFormData(EMPTY_FORM);
    setErrors({});
  };

  const handleCreateUser = (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});

    createUserMutation.mutate(
      { data: formData },
      {
        onSuccess: () => {
          closeCreateModal();
          queryClient.invalidateQueries({ queryKey: getGetApiV1AdminUsersQueryKey() });
        },
        onError: (error) => {
          const errorData = error as { message?: string; errors?: Record<string, string> };
          if (errorData.errors) {
            setErrors(errorData.errors);
          } else {
            setErrors({ general: errorData.message || 'Failed to create user' });
          }
        },
      }
    );
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-GB', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const roleBadges = (user: UserInfo) => (
    <div className="flex flex-wrap gap-1.5">
      {(user.roles ?? []).map((role) => (
        <span key={role.id} className={cn(theme.badges.tag.base, theme.badges.tag.info)}>
          {role.name}
        </span>
      ))}
      {(!user.roles || user.roles.length === 0) && (
        <span className={cn('text-sm', theme.text.subtle)}>No roles</span>
      )}
    </div>
  );

  const totpBadge = (user: UserInfo) => (
    <span
      className={cn(
        theme.badges.tag.base,
        user.totp_enabled ? theme.badges.tag.success : theme.badges.tag.neutral
      )}
    >
      {user.totp_enabled ? '2FA enabled' : '2FA off'}
    </span>
  );

  const manageRolesLink = (user: UserInfo) => (
    <Link
      to="/admin/users/$userid/roles"
      params={{ userid: String(user.id) }}
      aria-label={`Manage roles for ${user.username}`}
      className={cn('inline-flex min-h-[44px] items-center text-sm', theme.buttons.secondary)}
    >
      Manage roles
    </Link>
  );

  if (usersLoading) {
    return <LoadingSpinner size="lg" text="Loading users..." fullScreen />;
  }

  return (
    <div className="h-full overflow-auto">
      <div className="max-w-7xl mx-auto px-4 py-6 sm:px-6 lg:px-8">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <h1 className={cn('text-2xl font-bold sm:text-3xl', theme.text.strong)}>Users</h1>
          <button
            type="button"
            onClick={() => setShowCreateModal(true)}
            className={cn('inline-flex items-center', theme.buttons.primary)}
          >
            <PlusIcon className="h-5 w-5 mr-2" />
            Create User
          </button>
        </div>

        <div className={theme.table.panel}>
          <Table<UserInfo>
            data={users}
            keyExtractor={(user) => user.id.toString()}
            emptyMessage="No users found"
            emptyIcon={<UserGroupIcon className={cn('h-12 w-12 mx-auto', theme.text.info)} />}
            columns={[
              {
                key: 'user',
                header: 'User',
                render: (user) => (
                  <div className="min-w-0">
                    <div className={cn('text-sm font-medium', theme.text.strong)}>
                      {user.username}
                    </div>
                    <div className={cn('text-sm', theme.text.muted)}>{user.email}</div>
                  </div>
                ),
              },
              {
                key: 'roles',
                header: 'Roles',
                render: roleBadges,
              },
              {
                key: '2fa',
                header: '2FA',
                render: totpBadge,
              },
              {
                key: 'last_login',
                header: 'Last Login',
                render: (user) => (
                  <span className={cn('text-sm', theme.text.muted)}>
                    {user.last_login_at ? formatDate(user.last_login_at) : 'Never'}
                  </span>
                ),
              },
              {
                key: 'joined',
                header: 'Joined',
                render: (user) => (
                  <span className={cn('text-sm', theme.text.muted)}>
                    {formatDate(user.created_at)}
                  </span>
                ),
              },
              {
                key: 'actions',
                header: '',
                className: 'text-right',
                render: manageRolesLink,
              },
            ]}
            renderCard={(user) => (
              <div className="space-y-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="min-w-0">
                    <p className={cn('text-sm font-medium', theme.text.strong)}>{user.username}</p>
                    <p className={cn('truncate text-sm', theme.text.muted)}>{user.email}</p>
                  </div>
                  {manageRolesLink(user)}
                </div>
                <div className="flex flex-wrap items-center gap-1.5">
                  {roleBadges(user)}
                  {totpBadge(user)}
                </div>
                <p className={cn('text-xs', theme.text.subtle)}>
                  Last login {user.last_login_at ? formatDate(user.last_login_at) : 'never'} ·
                  Joined {formatDate(user.created_at)}
                </p>
              </div>
            )}
          />
        </div>
      </div>

      <Modal isOpen={showCreateModal} onClose={closeCreateModal} title="Create User" size="md">
        <form onSubmit={handleCreateUser} className="space-y-4">
          <p className={cn('text-sm', theme.text.muted)}>
            Add a new user to the system. They will be able to log in with the credentials you
            provide.
          </p>

          {errors.general && (
            <div
              className={cn(
                'p-4 rounded-md border',
                theme.intent.danger.surface,
                theme.intent.danger.border
              )}
            >
              <p className={cn('text-sm', theme.intent.danger.textStrong)}>{errors.general}</p>
            </div>
          )}

          <div>
            <label htmlFor="username" className={theme.forms.label}>
              Username
            </label>
            <input
              type="text"
              id="username"
              autoComplete="off"
              required
              value={formData.username}
              onChange={(e) => setFormData({ ...formData, username: e.target.value })}
              className={cn('mt-1', theme.forms.input)}
            />
            {errors.username && (
              <p className={cn('mt-1 text-sm', theme.text.danger)}>{errors.username}</p>
            )}
          </div>

          <div>
            <label htmlFor="email" className={theme.forms.label}>
              Email
            </label>
            <input
              type="email"
              id="email"
              autoComplete="off"
              required
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              className={cn('mt-1', theme.forms.input)}
            />
            {errors.email && (
              <p className={cn('mt-1 text-sm', theme.text.danger)}>{errors.email}</p>
            )}
          </div>

          <div>
            <label htmlFor="password" className={theme.forms.label}>
              Password
            </label>
            <input
              type="password"
              id="password"
              autoComplete="new-password"
              required
              value={formData.password}
              onChange={(e) => setFormData({ ...formData, password: e.target.value })}
              className={cn('mt-1', theme.forms.input)}
            />
            {errors.password && (
              <p className={cn('mt-1 text-sm', theme.text.danger)}>{errors.password}</p>
            )}
          </div>

          <div>
            <label htmlFor="password_confirm" className={theme.forms.label}>
              Confirm Password
            </label>
            <input
              type="password"
              id="password_confirm"
              autoComplete="new-password"
              required
              value={formData.password_confirm}
              onChange={(e) => setFormData({ ...formData, password_confirm: e.target.value })}
              className={cn('mt-1', theme.forms.input)}
            />
            {errors.password_confirm && (
              <p className={cn('mt-1 text-sm', theme.text.danger)}>{errors.password_confirm}</p>
            )}
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={closeCreateModal} className={theme.buttons.secondary}>
              Cancel
            </button>
            <button
              type="submit"
              disabled={createUserMutation.isPending}
              className={cn(theme.buttons.primary, 'disabled:opacity-50')}
            >
              {createUserMutation.isPending ? 'Creating...' : 'Create User'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
