import React, { useState } from 'react';
import { Head, router, useForm } from '@inertiajs/react';
import Layout from '../../components/Layout';
import FlashMessages from '../../components/FlashMessages';

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

  const { data, setData, post, put, processing, reset } = useForm({
    name: '',
    description: '',
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingRole) {
      put(`/admin/roles/${editingRole.id}`, {
        headers: {
          'X-CSRF-Token': csrfToken || '',
        },
        onSuccess: () => {
          setEditingRole(null);
          reset();
        },
      });
    } else {
      post('/admin/roles', {
        headers: {
          'X-CSRF-Token': csrfToken || '',
        },
        onSuccess: () => {
          setShowAddForm(false);
          reset();
        },
      });
    }
  };

  const handleEdit = (role: Role) => {
    if (role.is_admin) return;
    setEditingRole(role);
    setShowAddForm(false);
    setData({
      name: role.name,
      description: role.description,
    });
  };

  const handleCancelEdit = () => {
    setEditingRole(null);
    reset();
  };

  const handleDelete = (roleId: number, roleName: string, isAdmin: boolean) => {
    if (isAdmin) return;
    if (confirm(`Are you sure you want to delete the role "${roleName}"?`)) {
      router.delete(`/admin/roles/${roleId}`, {
        headers: {
          'X-CSRF-Token': csrfToken || '',
        },
      });
    }
  };

  return (
    <Layout>
      <Head title={title} />

      <div className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        <div className="md:flex md:items-center md:justify-between">
          <div className="flex-1 min-w-0">
            <h2 className="text-2xl font-bold leading-7 text-gray-900 dark:text-white sm:text-3xl sm:truncate">
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
              className="ml-3 inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 dark:bg-blue-700 dark:hover:bg-blue-600"
            >
              {editingRole ? 'Cancel Edit' : showAddForm ? 'Cancel' : 'Add Role'}
            </button>
          </div>
        </div>

        <FlashMessages />

        {(showAddForm || editingRole) && (
          <div className="mt-8 bg-white dark:bg-gray-800 shadow rounded-lg">
            <div className="px-4 py-5 sm:p-6">
              <h3 className="text-lg leading-6 font-medium text-gray-900 dark:text-white mb-4">
                {editingRole ? `Edit Role: ${editingRole.name}` : 'Add New Role'}
              </h3>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div className="sm:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                      Name
                    </label>
                    <input
                      type="text"
                      required
                      value={data.name}
                      onChange={(e) => setData('name', e.target.value)}
                      className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                      Description
                    </label>
                    <textarea
                      value={data.description}
                      onChange={(e) => setData('description', e.target.value)}
                      rows={3}
                      className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
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
                      }
                    }}
                    className="bg-white dark:bg-gray-700 py-2 px-4 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={processing}
                    className="bg-blue-600 dark:bg-blue-700 py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white hover:bg-blue-700 dark:hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
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
            <div key={role.id} className="bg-white dark:bg-gray-800 shadow rounded-lg">
              <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-lg font-medium text-gray-900 dark:text-white capitalize flex items-center">
                      {role.name}
                      {role.is_admin && (
                        <span className="ml-3 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 dark:bg-red-900 text-red-800 dark:text-red-200">
                          Admin
                        </span>
                      )}
                      <span
                        className={`ml-3 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200`}
                      >
                        {role.is_admin ? 'Full Access' : 'Stack Permissions'}
                      </span>
                    </h3>
                    <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                      {role.description}
                    </p>
                  </div>
                  <div className="flex items-center space-x-3">
                    {!role.is_admin && (
                      <>
                        <button
                          onClick={() => handleEdit(role)}
                          className="text-indigo-600 hover:text-indigo-900 dark:text-indigo-400 dark:hover:text-indigo-300 text-sm font-medium"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => handleDelete(role.id, role.name, role.is_admin)}
                          className="text-red-600 hover:text-red-900 dark:text-red-400 dark:hover:text-red-300 text-sm font-medium"
                        >
                          Delete
                        </button>
                      </>
                    )}
                    {!role.is_admin && (
                      <button
                        onClick={() => router.visit(`/admin/roles/${role.id}/stack-permissions`)}
                        className="inline-flex items-center px-3 py-2 border border-gray-300 dark:border-gray-600 shadow-sm text-sm leading-4 font-medium rounded-md text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                      >
                        Stack Permissions
                      </button>
                    )}
                  </div>
                </div>
              </div>
              <div className="px-6 py-4">
                {role.is_admin ? (
                  <div className="text-sm text-gray-500 dark:text-gray-400">
                    Admin users have full access to all servers and functionality. This role cannot
                    be modified or deleted.
                  </div>
                ) : (
                  <div className="text-sm text-gray-500 dark:text-gray-400">
                    Stack permissions are managed using patterns. Click "Stack Permissions" to
                    configure access to specific stacks using patterns like *dev* or *prod*.
                  </div>
                )}
              </div>
            </div>
          ))}

          {roles.length === 0 && (
            <div className="text-center py-12">
              <div className="text-sm text-gray-500 dark:text-gray-400">No roles found.</div>
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
}
