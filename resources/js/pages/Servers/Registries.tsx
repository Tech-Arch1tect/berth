import React, { useState } from 'react';
import { Head, Link, router } from '@inertiajs/react';
import Layout from '../../components/Layout';
import FlashMessages from '../../components/FlashMessages';
import { ServerNavigation } from '../../components/ServerNavigation';
import {
  KeyIcon,
  TrashIcon,
  PencilIcon,
  PlusIcon,
  XMarkIcon,
  HomeIcon,
  ChevronRightIcon,
} from '@heroicons/react/24/outline';
import { cn } from '../../utils/cn';
import { theme } from '../../theme';

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

      {/* Breadcrumb */}
      <nav className="flex mb-6" aria-label="Breadcrumb">
        <ol className="flex items-center space-x-4">
          <li>
            <Link
              href="/"
              className={cn(
                theme.text.subtle,
                'hover:text-slate-700 dark:hover:text-slate-300 transition-colors'
              )}
            >
              <HomeIcon className="h-5 w-5" />
            </Link>
          </li>
          <li>
            <div className="flex items-center">
              <ChevronRightIcon className={cn('h-5 w-5', theme.text.subtle)} />
              <Link
                href={`/servers/${server_id}/stacks`}
                className={cn(
                  'ml-4 text-sm font-medium transition-colors',
                  theme.text.muted,
                  'hover:text-slate-700 dark:hover:text-slate-300'
                )}
              >
                {server_name}
              </Link>
            </div>
          </li>
          <li>
            <div className="flex items-center">
              <ChevronRightIcon className={cn('h-5 w-5', theme.text.subtle)} />
              <span className={cn('ml-4 text-sm font-medium', theme.text.strong)}>
                Registry Credentials
              </span>
            </div>
          </li>
        </ol>
      </nav>

      {/* Server Navigation */}
      <div className="mb-8">
        <ServerNavigation serverId={server_id} serverName={server_name} />
      </div>

      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className={cn('text-3xl font-bold', theme.text.strong)}>Registry Credentials</h1>
            <p className={cn('mt-2', theme.text.muted)}>
              Manage private registry credentials for {server_name}
            </p>
          </div>
          <button
            onClick={() => setShowAddForm(!showAddForm)}
            disabled={editingCredential !== null}
            className={cn(theme.buttons.primary, 'rounded-lg')}
          >
            <PlusIcon className="w-5 h-5 mr-2" />
            Add Credential
          </button>
        </div>
      </div>

      <FlashMessages />

      {/* Add/Edit Form */}
      {(showAddForm || editingCredential) && (
        <div className={cn(theme.containers.panel, 'mb-6')}>
          <div className="flex items-center justify-between mb-6">
            <h2 className={cn('text-xl font-semibold', theme.text.strong)}>
              {editingCredential ? 'Edit Credential' : 'Add Credential'}
            </h2>
            <button onClick={handleCancel} className={cn(theme.buttons.ghost, theme.text.subtle)}>
              <XMarkIcon className="w-5 h-5" />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className={cn(theme.forms.label, 'mb-2')}>Stack Pattern *</label>
                <input
                  type="text"
                  value={data.stack_pattern}
                  onChange={(e) => setData('stack_pattern', e.target.value)}
                  placeholder="* (all stacks) or pattern like *dev*"
                  className={cn(theme.forms.input, 'rounded-xl')}
                  required
                />
                <p className={cn('mt-1 text-xs', theme.text.subtle)}>
                  Pattern to match stack names (e.g., "*", "*dev*", "production_*")
                </p>
              </div>

              <div>
                <label className={cn(theme.forms.label, 'mb-2')}>Registry URL *</label>
                <input
                  type="text"
                  value={data.registry_url}
                  onChange={(e) => setData('registry_url', e.target.value)}
                  placeholder="ghcr.io or registry.company.com"
                  className={cn(theme.forms.input, 'rounded-xl')}
                  required
                />
                <p className={cn('mt-1 text-xs', theme.text.subtle)}>
                  Registry hostname (e.g., "ghcr.io", "docker.io", "registry.gitlab.com")
                </p>
              </div>

              <div>
                <label className={cn(theme.forms.label, 'mb-2')}>Image Pattern (optional)</label>
                <input
                  type="text"
                  value={data.image_pattern}
                  onChange={(e) => setData('image_pattern', e.target.value)}
                  placeholder="ghcr.io/myorg/*"
                  className={cn(theme.forms.input, 'rounded-xl')}
                />
                <p className={cn('mt-1 text-xs', theme.text.subtle)}>
                  Specific image pattern for more granular control
                </p>
              </div>

              <div>
                <label className={cn(theme.forms.label, 'mb-2')}>Username *</label>
                <input
                  type="text"
                  value={data.username}
                  onChange={(e) => setData('username', e.target.value)}
                  placeholder="registry username"
                  className={cn(theme.forms.input, 'rounded-xl')}
                  required
                />
              </div>
            </div>

            <div>
              <label className={cn(theme.forms.label, 'mb-2')}>Password / Token *</label>
              <input
                type="password"
                value={data.password}
                onChange={(e) => setData('password', e.target.value)}
                placeholder={
                  editingCredential
                    ? 'Leave blank to keep current password'
                    : 'registry password or token'
                }
                className={cn(theme.forms.input, 'rounded-xl')}
                required={!editingCredential}
              />
            </div>

            <div className="flex justify-end space-x-3 pt-4">
              <button
                type="button"
                onClick={handleCancel}
                className={cn(theme.buttons.secondary, 'rounded-xl')}
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={processing}
                className={cn(
                  'px-4 py-2 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-xl hover:from-blue-700 hover:to-purple-700 transition-all duration-200',
                  processing && 'opacity-50 cursor-not-allowed'
                )}
              >
                {processing ? 'Saving...' : editingCredential ? 'Update' : 'Add'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Credentials List */}
      <div className={cn(theme.containers.panel, 'overflow-hidden')}>
        <div className={cn(theme.containers.sectionHeader, 'p-6')}>
          <h2 className={cn('text-lg font-semibold flex items-center', theme.text.strong)}>
            <KeyIcon className={cn('w-5 h-5 mr-2', theme.text.info)} />
            Configured Credentials ({credentials.length})
          </h2>
        </div>

        {credentials.length === 0 ? (
          <div className="p-12 text-center">
            <div className={theme.icon.emptyState}>
              <KeyIcon className="w-8 h-8" />
            </div>
            <h3 className={cn('text-lg font-medium mb-2', theme.text.strong)}>
              No credentials configured
            </h3>
            <p className={cn('mb-4', theme.text.muted)}>
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
          <div className={cn('divide-y', theme.intent.neutral.border)}>
            {credentials.map((credential) => (
              <div
                key={credential.id}
                className={cn(
                  'p-6 transition-colors',
                  theme.surface.muted,
                  'hover:bg-slate-100/70 dark:hover:bg-slate-800/70'
                )}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center space-x-3 mb-2">
                      <h3 className={cn('text-lg font-semibold', theme.text.strong)}>
                        {credential.registry_url}
                      </h3>
                      <span
                        className={cn(theme.badges.tag.base, theme.badges.tag.info, 'rounded-full')}
                      >
                        {credential.stack_pattern}
                      </span>
                    </div>
                    <div className={cn('space-y-1 text-sm', theme.text.muted)}>
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
                      className={cn(
                        'p-2 rounded-lg transition-colors',
                        theme.text.info,
                        'hover:bg-blue-50 dark:hover:bg-blue-900/30'
                      )}
                      title="Edit"
                    >
                      <PencilIcon className="w-5 h-5" />
                    </button>
                    <button
                      onClick={() => handleDelete(credential.id)}
                      className={cn(
                        'p-2 rounded-lg transition-colors',
                        theme.text.danger,
                        'hover:bg-red-50 dark:hover:bg-red-900/30'
                      )}
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
    </Layout>
  );
}
