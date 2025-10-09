import Layout from '../../components/Layout';
import FlashMessages from '../../components/FlashMessages';
import { Head, useForm, usePage, router } from '@inertiajs/react';
import { formatDistanceToNow } from 'date-fns';
import { useState, useEffect } from 'react';
import {
  KeyIcon,
  PlusIcon,
  TrashIcon,
  ClipboardDocumentIcon,
  CheckIcon,
  InformationCircleIcon,
  EyeIcon,
  ClockIcon,
  ShieldCheckIcon,
} from '@heroicons/react/24/outline';
import axios from 'axios';
import { cn } from '../../utils/cn';
import { theme } from '../../theme';

interface APIKey {
  id: number;
  name: string;
  key_prefix: string;
  last_used_at: string | null;
  expires_at: string | null;
  is_active: boolean;
  created_at: string;
  scope_count: number;
}

interface APIKeysProps {
  title: string;
}

interface NewAPIKeyModal {
  name: string;
  expires_at: string;
}

export default function APIKeysIndex({ title }: APIKeysProps) {
  const { props } = usePage();
  const csrfToken = props.csrfToken as string | undefined;
  const [apiKeys, setApiKeys] = useState<APIKey[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newKeyData, setNewKeyData] = useState<{ key: string; name: string } | null>(null);
  const [copiedKey, setCopiedKey] = useState(false);
  const [selectedKeyScopes, setSelectedKeyScopes] = useState<number | null>(null);

  const {
    data: formData,
    setData,
    processing,
    errors,
    reset,
  } = useForm<NewAPIKeyModal>({
    name: '',
    expires_at: '',
  });

  const loadAPIKeys = async () => {
    try {
      const response = await axios.get('/api/api-keys');
      if (response.data.success) {
        setApiKeys(response.data.data);
      }
    } catch (error) {
      console.error('Failed to load API keys:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAPIKeys();
  }, []);

  const createAPIKey = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      const payload: any = { name: formData.name };
      if (formData.expires_at) {
        payload.expires_at = new Date(formData.expires_at).toISOString();
      }

      const response = await axios.post('/api/api-keys', payload, {
        headers: {
          'X-CSRF-Token': csrfToken || '',
        },
      });

      if (response.data.success) {
        setNewKeyData({
          key: response.data.data.plain_key,
          name: response.data.data.api_key.name,
        });
        setShowCreateModal(false);
        reset();
        loadAPIKeys();
      }
    } catch (error: any) {
      console.error('Failed to create API key:', error);
      alert(error.response?.data?.message || 'Failed to create API key');
    }
  };

  const revokeAPIKey = async (id: number, name: string) => {
    if (
      !confirm(
        `Are you sure you want to revoke the API key "${name}"? This action cannot be undone.`
      )
    ) {
      return;
    }

    try {
      await axios.delete(`/api/api-keys/${id}`, {
        headers: {
          'X-CSRF-Token': csrfToken || '',
        },
      });
      loadAPIKeys();
      router.reload({ only: ['flash'] });
    } catch (error) {
      console.error('Failed to revoke API key:', error);
      alert('Failed to revoke API key');
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(true);
    setTimeout(() => setCopiedKey(false), 2000);
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'Never';
    return formatDistanceToNow(new Date(dateString), { addSuffix: true });
  };

  return (
    <Layout>
      <Head title="API Keys" />
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="py-8">
          <div className="flex justify-between items-center mb-8">
            <h1 className={cn('text-3xl font-bold', theme.text.strong)}>API Keys</h1>
            <button
              onClick={() => setShowCreateModal(true)}
              className={cn('inline-flex items-center', theme.buttons.primary)}
            >
              <PlusIcon className="h-5 w-5 mr-2" />
              Create API Key
            </button>
          </div>

          <FlashMessages className="mb-6" />

          {/* New Key Display Modal */}
          {newKeyData && (
            <div className={theme.modal.overlay}>
              <div className={cn(theme.modal.content, 'max-w-2xl')}>
                <h3 className={cn(theme.modal.header, 'mb-4')}>API Key Created Successfully</h3>
                <div className={cn(theme.intent.warning.surface, 'rounded-lg p-4 mb-4')}>
                  <div className="flex">
                    <div className="flex-shrink-0">
                      <InformationCircleIcon className={cn('h-5 w-5', theme.intent.warning.icon)} />
                    </div>
                    <div className="ml-3">
                      <p className={cn('text-sm', theme.intent.warning.textStrong)}>
                        <strong>Important:</strong> Copy this API key now. You won't be able to see
                        it again!
                      </p>
                    </div>
                  </div>
                </div>
                <div className="mb-4">
                  <label className={cn(theme.forms.label, 'mb-2')}>
                    API Key: {newKeyData.name}
                  </label>
                  <div className="flex items-center space-x-2">
                    <input
                      type="text"
                      value={newKeyData.key}
                      readOnly
                      className={cn(
                        theme.forms.input,
                        theme.surface.code,
                        'flex-1 font-mono text-sm'
                      )}
                    />
                    <button
                      onClick={() => copyToClipboard(newKeyData.key)}
                      className={cn(theme.buttons.ghost, 'p-3')}
                    >
                      {copiedKey ? (
                        <CheckIcon className={cn('h-5 w-5', theme.text.success)} />
                      ) : (
                        <ClipboardDocumentIcon className={cn('h-5 w-5', theme.text.muted)} />
                      )}
                    </button>
                  </div>
                </div>
                <div className="flex justify-end">
                  <button onClick={() => setNewKeyData(null)} className={theme.buttons.primary}>
                    Done
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Create Modal */}
          {showCreateModal && (
            <div className={theme.modal.overlay}>
              <div className={cn(theme.modal.content, 'max-w-md')}>
                <h3 className={cn(theme.modal.header, 'mb-4')}>Create New API Key</h3>
                <form onSubmit={createAPIKey}>
                  <div className="mb-4">
                    <label className={cn(theme.forms.label, 'mb-2')}>Name</label>
                    <input
                      type="text"
                      value={formData.name}
                      onChange={(e) => setData('name', e.target.value)}
                      className={cn('w-full', theme.forms.input)}
                      placeholder="My API Key"
                      required
                    />
                    {errors.name && (
                      <p className={cn('mt-1 text-sm', theme.text.danger)}>{errors.name}</p>
                    )}
                  </div>
                  <div className="mb-4">
                    <label className={cn(theme.forms.label, 'mb-2')}>Expires At (Optional)</label>
                    <input
                      type="datetime-local"
                      value={formData.expires_at}
                      onChange={(e) => setData('expires_at', e.target.value)}
                      className={cn('w-full', theme.forms.input)}
                    />
                    {errors.expires_at && (
                      <p className={cn('mt-1 text-sm', theme.text.danger)}>{errors.expires_at}</p>
                    )}
                  </div>
                  <div className="flex justify-end space-x-3">
                    <button
                      type="button"
                      onClick={() => {
                        setShowCreateModal(false);
                        reset();
                      }}
                      className={theme.buttons.secondary}
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={processing}
                      className={cn(theme.buttons.primary, processing && 'opacity-50')}
                    >
                      Create
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}

          {/* API Keys List */}
          {loading ? (
            <div className="text-center py-12">
              <p className={theme.text.muted}>Loading API keys...</p>
            </div>
          ) : apiKeys.length === 0 ? (
            <div className={cn('text-center py-12', theme.surface.panel, 'rounded-lg shadow')}>
              <KeyIcon className={cn('mx-auto h-12 w-12', theme.text.subtle)} />
              <h3 className={cn('mt-2 text-sm font-medium', theme.text.strong)}>No API keys</h3>
              <p className={cn('mt-1 text-sm', theme.text.muted)}>
                Get started by creating a new API key.
              </p>
              <div className="mt-6">
                <button
                  onClick={() => setShowCreateModal(true)}
                  className={cn('inline-flex items-center', theme.buttons.primary)}
                >
                  <PlusIcon className="h-5 w-5 mr-2" />
                  Create API Key
                </button>
              </div>
            </div>
          ) : (
            <div className={cn(theme.surface.panel, 'shadow overflow-hidden sm:rounded-md')}>
              <ul className="divide-y divide-slate-200 dark:divide-slate-800">
                {apiKeys.map((apiKey) => (
                  <li key={apiKey.id} className="px-6 py-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-4 flex-1">
                        <div className="flex-shrink-0">
                          <KeyIcon className={cn('h-8 w-8', theme.text.muted)} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center space-x-2 mb-2">
                            <p className={cn('text-sm font-medium', theme.text.strong)}>
                              {apiKey.name}
                            </p>
                            <span className={cn(theme.badges.tag.base, theme.badges.tag.neutral)}>
                              {apiKey.key_prefix}...
                            </span>
                            {apiKey.is_active ? (
                              <span className={cn(theme.badges.tag.base, theme.badges.tag.success)}>
                                Active
                              </span>
                            ) : (
                              <span className={cn(theme.badges.tag.base, theme.badges.tag.danger)}>
                                Inactive
                              </span>
                            )}
                          </div>
                          <div className={cn('mt-1 text-sm space-y-1', theme.text.muted)}>
                            <p className="flex items-center">
                              <ClockIcon className="h-4 w-4 mr-1" />
                              <span className="font-medium">Last used:</span>{' '}
                              {formatDate(apiKey.last_used_at)}
                            </p>
                            <p className="flex items-center">
                              <ShieldCheckIcon className="h-4 w-4 mr-1" />
                              <span className="font-medium">Scopes:</span> {apiKey.scope_count}
                            </p>
                            {apiKey.expires_at && (
                              <p className="flex items-center">
                                <span className="font-medium">Expires:</span>{' '}
                                {formatDate(apiKey.expires_at)}
                              </p>
                            )}
                            <p className="flex items-center">
                              <span className="font-medium">Created:</span>{' '}
                              {formatDate(apiKey.created_at)}
                            </p>
                          </div>
                        </div>
                      </div>

                      <div className="flex-shrink-0 flex space-x-2">
                        <button
                          onClick={() =>
                            router.visit(`/api-keys/${apiKey.id}/scopes`, { preserveState: false })
                          }
                          className={cn(
                            'inline-flex items-center text-sm leading-4',
                            theme.buttons.secondary
                          )}
                        >
                          <EyeIcon className="h-4 w-4 mr-1" />
                          Manage Scopes
                        </button>
                        <button
                          onClick={() => revokeAPIKey(apiKey.id, apiKey.name)}
                          className={cn(
                            'inline-flex items-center text-sm leading-4',
                            theme.buttons.danger
                          )}
                        >
                          <TrashIcon className="h-4 w-4 mr-1" />
                          Revoke
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
                <InformationCircleIcon className={cn('h-5 w-5', theme.intent.info.icon)} />
              </div>
              <div className="ml-3">
                <p className={cn('text-sm', theme.intent.info.textStrong)}>
                  <strong>Security Note:</strong> API keys provide access to your account. Keep them
                  secure and never share them publicly. Each key's permissions are limited by scopes
                  you assign and cannot exceed your own user permissions.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
}
