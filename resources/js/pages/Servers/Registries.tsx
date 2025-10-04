import React, { useState } from 'react';
import { Head, router } from '@inertiajs/react';
import Layout from '../../components/Layout';
import FlashMessages from '../../components/FlashMessages';
import { ServerNavigation } from '../../components/ServerNavigation';
import { KeyIcon, TrashIcon, PencilIcon, PlusIcon, XMarkIcon } from '@heroicons/react/24/outline';

interface RegistryCredential {
  id: number;
  server_id: number;
  stack_pattern: string;
  registry_url: string;
  image_pattern?: string;
  username: string;
  created_at: string;
  updated_at: string;
}

interface Props {
  title?: string;
  server_id: number;
  server_name: string;
  credentials: RegistryCredential[];
  csrfToken?: string;
}

export default function Registries({
  title = 'Registry Credentials',
  server_id,
  server_name,
  credentials,
  csrfToken,
}: Props) {
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingCredential, setEditingCredential] = useState<RegistryCredential | null>(null);
  const [processing, setProcessing] = useState(false);

  const [data, setFormData] = useState({
    stack_pattern: '*',
    registry_url: '',
    image_pattern: '',
    username: '',
    password: '',
  });

  const setData = (key: string, value: string) => {
    setFormData((prev) => ({ ...prev, [key]: value }));
  };

  const reset = () => {
    setFormData({
      stack_pattern: '*',
      registry_url: '',
      image_pattern: '',
      username: '',
      password: '',
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setProcessing(true);

    try {
      if (editingCredential) {
        const response = await fetch(
          `/api/servers/${server_id}/registries/${editingCredential.id}`,
          {
            method: 'PUT',
            headers: {
              'Content-Type': 'application/json',
              'X-CSRF-Token': csrfToken || '',
            },
            credentials: 'include',
            body: JSON.stringify(data),
          }
        );

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || 'Update failed');
        }

        setEditingCredential(null);
        reset();
        router.reload();
      } else {
        const response = await fetch(`/api/servers/${server_id}/registries`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-CSRF-Token': csrfToken || '',
          },
          credentials: 'include',
          body: JSON.stringify(data),
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || 'Creation failed');
        }

        setShowAddForm(false);
        reset();
        router.reload();
      }
    } catch (error) {
      console.error('Submit failed:', error);
      alert(error instanceof Error ? error.message : 'Failed to save credential');
    } finally {
      setProcessing(false);
    }
  };

  const handleEdit = (credential: RegistryCredential) => {
    setEditingCredential(credential);
    setShowAddForm(false);
    setFormData({
      stack_pattern: credential.stack_pattern,
      registry_url: credential.registry_url,
      image_pattern: credential.image_pattern || '',
      username: credential.username,
      password: '',
    });
  };

  const handleDelete = async (credentialId: number) => {
    if (!confirm('Are you sure you want to delete this registry credential?')) {
      return;
    }

    try {
      const response = await fetch(`/api/servers/${server_id}/registries/${credentialId}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-Token': csrfToken || '',
        },
        credentials: 'include',
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Delete failed');
      }

      router.reload();
    } catch (error) {
      console.error('Delete failed:', error);
      alert(error instanceof Error ? error.message : 'Failed to delete credential');
    }
  };

  const handleCancel = () => {
    setShowAddForm(false);
    setEditingCredential(null);
    reset();
  };

  return (
    <Layout>
      <Head title={title} />
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-slate-100 dark:from-slate-900 dark:via-slate-800 dark:to-slate-900">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {/* Header */}
          <div className="mb-8">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 dark:from-blue-400 dark:to-purple-400 bg-clip-text text-transparent">
                  Registry Credentials
                </h1>
                <p className="mt-2 text-slate-600 dark:text-slate-400">{server_name}</p>
              </div>
              <button
                onClick={() => setShowAddForm(!showAddForm)}
                disabled={editingCredential !== null}
                className="inline-flex items-center px-4 py-2 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-xl hover:from-blue-700 hover:to-purple-700 transition-all duration-200 shadow-lg hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <PlusIcon className="w-5 h-5 mr-2" />
                Add Credential
              </button>
            </div>

            <ServerNavigation serverId={server_id} serverName={server_name} />
          </div>

          <FlashMessages />

          {/* Add/Edit Form */}
          {(showAddForm || editingCredential) && (
            <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-xl border border-slate-200/50 dark:border-slate-700/50 p-6 mb-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-semibold text-slate-900 dark:text-white">
                  {editingCredential ? 'Edit Credential' : 'Add Credential'}
                </h2>
                <button
                  onClick={handleCancel}
                  className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
                >
                  <XMarkIcon className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                      Stack Pattern *
                    </label>
                    <input
                      type="text"
                      value={data.stack_pattern}
                      onChange={(e) => setData('stack_pattern', e.target.value)}
                      placeholder="* (all stacks) or pattern like *dev*"
                      className="w-full px-4 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-600 text-slate-900 dark:text-white rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                      required
                    />
                    <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                      Pattern to match stack names (e.g., "*", "*dev*", "production_*")
                    </p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                      Registry URL *
                    </label>
                    <input
                      type="text"
                      value={data.registry_url}
                      onChange={(e) => setData('registry_url', e.target.value)}
                      placeholder="ghcr.io or registry.company.com"
                      className="w-full px-4 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-600 text-slate-900 dark:text-white rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                      required
                    />
                    <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                      Registry hostname (e.g., "ghcr.io", "docker.io", "registry.gitlab.com")
                    </p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                      Image Pattern (optional)
                    </label>
                    <input
                      type="text"
                      value={data.image_pattern}
                      onChange={(e) => setData('image_pattern', e.target.value)}
                      placeholder="ghcr.io/myorg/*"
                      className="w-full px-4 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-600 text-slate-900 dark:text-white rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                    />
                    <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                      Specific image pattern for more granular control
                    </p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                      Username *
                    </label>
                    <input
                      type="text"
                      value={data.username}
                      onChange={(e) => setData('username', e.target.value)}
                      placeholder="registry username"
                      className="w-full px-4 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-600 text-slate-900 dark:text-white rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                      required
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                    Password / Token *
                  </label>
                  <input
                    type="password"
                    value={data.password}
                    onChange={(e) => setData('password', e.target.value)}
                    placeholder={
                      editingCredential
                        ? 'Leave blank to keep current password'
                        : 'registry password or token'
                    }
                    className="w-full px-4 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-600 text-slate-900 dark:text-white rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                    required={!editingCredential}
                  />
                </div>

                <div className="flex justify-end space-x-3 pt-4">
                  <button
                    type="button"
                    onClick={handleCancel}
                    className="px-4 py-2 text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-700 rounded-xl hover:bg-slate-200 dark:hover:bg-slate-600 transition-all"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={processing}
                    className="px-4 py-2 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-xl hover:from-blue-700 hover:to-purple-700 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {processing ? 'Saving...' : editingCredential ? 'Update' : 'Add'}
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* Credentials List */}
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-xl border border-slate-200/50 dark:border-slate-700/50 overflow-hidden">
            <div className="p-6 border-b border-slate-200 dark:border-slate-700">
              <h2 className="text-lg font-semibold text-slate-900 dark:text-white flex items-center">
                <KeyIcon className="w-5 h-5 mr-2 text-blue-600 dark:text-blue-400" />
                Configured Credentials ({credentials.length})
              </h2>
            </div>

            {credentials.length === 0 ? (
              <div className="p-12 text-center">
                <KeyIcon className="w-16 h-16 mx-auto text-slate-300 dark:text-slate-600 mb-4" />
                <h3 className="text-lg font-medium text-slate-900 dark:text-white mb-2">
                  No credentials configured
                </h3>
                <p className="text-slate-600 dark:text-slate-400 mb-4">
                  Add registry credentials to enable pulling from private registries
                </p>
                <button
                  onClick={() => setShowAddForm(true)}
                  className="inline-flex items-center px-4 py-2 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-xl hover:from-blue-700 hover:to-purple-700 transition-all duration-200 shadow-lg hover:shadow-xl"
                >
                  <PlusIcon className="w-5 h-5 mr-2" />
                  Add First Credential
                </button>
              </div>
            ) : (
              <div className="divide-y divide-slate-200 dark:divide-slate-700">
                {credentials.map((credential) => (
                  <div
                    key={credential.id}
                    className="p-6 hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center space-x-3 mb-2">
                          <h3 className="text-lg font-semibold text-slate-900 dark:text-white">
                            {credential.registry_url}
                          </h3>
                          <span className="px-3 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 text-xs font-medium rounded-full">
                            {credential.stack_pattern}
                          </span>
                        </div>
                        <div className="space-y-1 text-sm text-slate-600 dark:text-slate-400">
                          <p>
                            <span className="font-medium">Username:</span> {credential.username}
                          </p>
                          {credential.image_pattern && (
                            <p>
                              <span className="font-medium">Image Pattern:</span>{' '}
                              {credential.image_pattern}
                            </p>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center space-x-2 ml-4">
                        <button
                          onClick={() => handleEdit(credential)}
                          className="p-2 text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded-lg transition-colors"
                          title="Edit"
                        >
                          <PencilIcon className="w-5 h-5" />
                        </button>
                        <button
                          onClick={() => handleDelete(credential.id)}
                          className="p-2 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg transition-colors"
                          title="Delete"
                        >
                          <TrashIcon className="w-5 h-5" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </Layout>
  );
}
