import React, { useState } from 'react';
import { Head, Link, useForm, usePage } from '@inertiajs/react';
import Layout from '../../components/Layout';
import FlashMessages from '../../components/FlashMessages';
import { cn } from '../../utils/cn';
import { theme } from '../../theme';
import { EmptyState } from '../../components/common/EmptyState';
import { Table, Column } from '../../components/common/Table';
import { UserGroupIcon } from '@heroicons/react/24/outline';

interface User {
  id: number;
  username: string;
  email: string;
  created_at: string;
  last_login_at: string | null;
  totp_enabled: boolean;
  roles: Role[];
}

interface Role {
  id: number;
  name: string;
  description: string;
}

interface Props {
  title: string;
  users: User[];
  csrfToken?: string;
}

export default function AdminUsers({ title, users, csrfToken }: Props) {
  const [showCreateForm, setShowCreateForm] = useState(false);
  const { props } = usePage();
  const actualCsrfToken = csrfToken || (props.csrfToken as string | undefined);

  const { data, setData, post, processing, errors, reset } = useForm({
    username: '',
    email: '',
    password: '',
    password_confirm: '',
  });

  const handleCreateUser = (e: React.FormEvent) => {
    e.preventDefault();
    post('/admin/users', {
      headers: {
        'X-CSRF-Token': actualCsrfToken || '',
      },
      onSuccess: () => {
        reset();
        setShowCreateForm(false);
      },
    });
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-GB', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  return (
    <Layout>
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
              type="button"
              onClick={() => setShowCreateForm(!showCreateForm)}
              className={theme.buttons.primary}
            >
              {showCreateForm ? 'Cancel' : 'Create User'}
            </button>
          </div>
        </div>

        <FlashMessages />

        {showCreateForm && (
          <div className="mt-8 max-w-md">
            <div className={cn(theme.cards.shell, theme.cards.padded)}>
              <div>
                <h3 className={cn('text-lg leading-6 font-medium', theme.text.strong)}>
                  Create New User
                </h3>
                <div className={cn('mt-2 max-w-xl text-sm', theme.text.muted)}>
                  <p>
                    Add a new user to the system. They will be able to log in with the credentials
                    you provide.
                  </p>
                </div>
                <form onSubmit={handleCreateUser} className="mt-5">
                  <div className="space-y-4">
                    <div>
                      <label htmlFor="username" className={theme.forms.label}>
                        Username
                      </label>
                      <div className="mt-1">
                        <input
                          type="text"
                          id="username"
                          value={data.username}
                          onChange={(e) => setData('username', e.target.value)}
                          className={theme.forms.input}
                          placeholder="Enter username"
                        />
                        {errors.username && (
                          <p className={cn('mt-1 text-sm', theme.text.danger)}>{errors.username}</p>
                        )}
                      </div>
                    </div>

                    <div>
                      <label htmlFor="email" className={theme.forms.label}>
                        Email
                      </label>
                      <div className="mt-1">
                        <input
                          type="email"
                          id="email"
                          value={data.email}
                          onChange={(e) => setData('email', e.target.value)}
                          className={theme.forms.input}
                          placeholder="Enter email address"
                        />
                        {errors.email && (
                          <p className={cn('mt-1 text-sm', theme.text.danger)}>{errors.email}</p>
                        )}
                      </div>
                    </div>

                    <div>
                      <label htmlFor="password" className={theme.forms.label}>
                        Password
                      </label>
                      <div className="mt-1">
                        <input
                          type="password"
                          id="password"
                          value={data.password}
                          onChange={(e) => setData('password', e.target.value)}
                          className={theme.forms.input}
                          placeholder="Enter password"
                        />
                        {errors.password && (
                          <p className={cn('mt-1 text-sm', theme.text.danger)}>{errors.password}</p>
                        )}
                      </div>
                    </div>

                    <div>
                      <label htmlFor="password_confirm" className={theme.forms.label}>
                        Confirm Password
                      </label>
                      <div className="mt-1">
                        <input
                          type="password"
                          id="password_confirm"
                          value={data.password_confirm}
                          onChange={(e) => setData('password_confirm', e.target.value)}
                          className={theme.forms.input}
                          placeholder="Confirm password"
                        />
                        {errors.password_confirm && (
                          <p className={cn('mt-1 text-sm', theme.text.danger)}>
                            {errors.password_confirm}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="mt-5 flex justify-end space-x-3">
                    <button
                      type="button"
                      onClick={() => {
                        setShowCreateForm(false);
                        reset();
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
                      {processing ? 'Creating...' : 'Create User'}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </div>
        )}

        <div className="mt-8 flex flex-col">
          <div className="-my-2 -mx-4 overflow-x-auto sm:-mx-6 lg:-mx-8">
            <div className="inline-block min-w-full py-2 align-middle md:px-6 lg:px-8">
              <div className={theme.table.panel}>
                <Table<User>
                  data={users}
                  keyExtractor={(user) => user.id.toString()}
                  emptyMessage="No users found"
                  emptyIcon={<UserGroupIcon className="h-12 w-12 mx-auto text-blue-400" />}
                  columns={[
                    {
                      key: 'user',
                      header: 'User',
                      render: (user) => (
                        <div className="flex items-center">
                          <div className="flex-shrink-0 h-10 w-10">
                            <div
                              className={cn(
                                'h-10 w-10 rounded-full flex items-center justify-center',
                                theme.surface.muted
                              )}
                            >
                              <span className={cn('text-sm font-medium', theme.text.standard)}>
                                {user.username.charAt(0).toUpperCase()}
                              </span>
                            </div>
                          </div>
                          <div className="ml-4">
                            <div className={cn('text-sm font-medium', theme.text.strong)}>
                              {user.username}
                            </div>
                            <div className={cn('text-sm', theme.text.muted)}>{user.email}</div>
                          </div>
                        </div>
                      ),
                    },
                    {
                      key: 'roles',
                      header: 'Roles',
                      render: (user) => (
                        <div className="flex flex-wrap gap-2">
                          {user.roles.map((role) => (
                            <span
                              key={role.id}
                              className={cn(theme.badges.tag.base, theme.badges.tag.info)}
                            >
                              {role.name}
                            </span>
                          ))}
                          {user.roles.length === 0 && (
                            <span className={cn('text-sm', theme.text.subtle)}>No roles</span>
                          )}
                        </div>
                      ),
                    },
                    {
                      key: '2fa',
                      header: '2FA',
                      render: (user) => (
                        <span
                          className={cn(
                            theme.badges.tag.base,
                            user.totp_enabled ? theme.badges.tag.success : theme.badges.tag.neutral
                          )}
                        >
                          {user.totp_enabled ? 'Enabled' : 'Disabled'}
                        </span>
                      ),
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
                      render: (user) => (
                        <Link href={`/admin/users/${user.id}/roles`} className={theme.text.info}>
                          Manage Roles
                        </Link>
                      ),
                    },
                  ]}
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
}
