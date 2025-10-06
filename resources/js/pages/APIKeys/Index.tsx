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
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">API Keys</h1>
            <button
              onClick={() => setShowCreateModal(true)}
              className="inline-flex items-center px-4 py-2 bg-blue-600 dark:bg-blue-700 text-white rounded-md hover:bg-blue-700 dark:hover:bg-blue-600"
            >
              <PlusIcon className="h-5 w-5 mr-2" />
              Create API Key
            </button>
          </div>

          <FlashMessages className="mb-6" />

          {/* New Key Display Modal */}
          {newKeyData && (
            <div className="fixed inset-0 bg-gray-500 bg-opacity-75 flex items-center justify-center z-50">
              <div className="bg-white dark:bg-gray-800 rounded-lg p-6 max-w-2xl w-full mx-4">
                <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">
                  API Key Created Successfully
                </h3>
                <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4 mb-4">
                  <div className="flex">
                    <div className="flex-shrink-0">
                      <InformationCircleIcon className="h-5 w-5 text-yellow-400" />
                    </div>
                    <div className="ml-3">
                      <p className="text-sm text-yellow-700 dark:text-yellow-300">
                        <strong>Important:</strong> Copy this API key now. You won't be able to see
                        it again!
                      </p>
                    </div>
                  </div>
                </div>
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    API Key: {newKeyData.name}
                  </label>
                  <div className="flex items-center space-x-2">
                    <input
                      type="text"
                      value={newKeyData.key}
                      readOnly
                      className="flex-1 font-mono text-sm p-3 border border-gray-300 dark:border-gray-600 rounded-md bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-white"
                    />
                    <button
                      onClick={() => copyToClipboard(newKeyData.key)}
                      className="p-3 bg-gray-200 dark:bg-gray-700 rounded-md hover:bg-gray-300 dark:hover:bg-gray-600"
                    >
                      {copiedKey ? (
                        <CheckIcon className="h-5 w-5 text-green-600" />
                      ) : (
                        <ClipboardDocumentIcon className="h-5 w-5 text-gray-600 dark:text-gray-400" />
                      )}
                    </button>
                  </div>
                </div>
                <div className="flex justify-end">
                  <button
                    onClick={() => setNewKeyData(null)}
                    className="px-4 py-2 bg-blue-600 dark:bg-blue-700 text-white rounded-md hover:bg-blue-700 dark:hover:bg-blue-600"
                  >
                    Done
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Create Modal */}
          {showCreateModal && (
            <div className="fixed inset-0 bg-gray-500 bg-opacity-75 flex items-center justify-center z-50">
              <div className="bg-white dark:bg-gray-800 rounded-lg p-6 max-w-md w-full mx-4">
                <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">
                  Create New API Key
                </h3>
                <form onSubmit={createAPIKey}>
                  <div className="mb-4">
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Name
                    </label>
                    <input
                      type="text"
                      value={formData.name}
                      onChange={(e) => setData('name', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-900 text-gray-900 dark:text-white"
                      placeholder="My API Key"
                      required
                    />
                    {errors.name && <p className="mt-1 text-sm text-red-600">{errors.name}</p>}
                  </div>
                  <div className="mb-4">
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Expires At (Optional)
                    </label>
                    <input
                      type="datetime-local"
                      value={formData.expires_at}
                      onChange={(e) => setData('expires_at', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-900 text-gray-900 dark:text-white"
                    />
                    {errors.expires_at && (
                      <p className="mt-1 text-sm text-red-600">{errors.expires_at}</p>
                    )}
                  </div>
                  <div className="flex justify-end space-x-3">
                    <button
                      type="button"
                      onClick={() => {
                        setShowCreateModal(false);
                        reset();
                      }}
                      className="px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-md hover:bg-gray-50 dark:hover:bg-gray-700"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={processing}
                      className="px-4 py-2 bg-blue-600 dark:bg-blue-700 text-white rounded-md hover:bg-blue-700 dark:hover:bg-blue-600 disabled:opacity-50"
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
              <p className="text-gray-500 dark:text-gray-400">Loading API keys...</p>
            </div>
          ) : apiKeys.length === 0 ? (
            <div className="text-center py-12 bg-white dark:bg-gray-800 rounded-lg shadow">
              <KeyIcon className="mx-auto h-12 w-12 text-gray-400" />
              <h3 className="mt-2 text-sm font-medium text-gray-900 dark:text-white">
                No API keys
              </h3>
              <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                Get started by creating a new API key.
              </p>
              <div className="mt-6">
                <button
                  onClick={() => setShowCreateModal(true)}
                  className="inline-flex items-center px-4 py-2 bg-blue-600 dark:bg-blue-700 text-white rounded-md hover:bg-blue-700 dark:hover:bg-blue-600"
                >
                  <PlusIcon className="h-5 w-5 mr-2" />
                  Create API Key
                </button>
              </div>
            </div>
          ) : (
            <div className="bg-white dark:bg-gray-800 shadow overflow-hidden sm:rounded-md">
              <ul className="divide-y divide-gray-200 dark:divide-gray-700">
                {apiKeys.map((apiKey) => (
                  <li key={apiKey.id} className="px-6 py-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-4 flex-1">
                        <div className="flex-shrink-0">
                          <KeyIcon className="h-8 w-8 text-gray-600 dark:text-gray-400" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center space-x-2 mb-2">
                            <p className="text-sm font-medium text-gray-900 dark:text-white">
                              {apiKey.name}
                            </p>
                            <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-300">
                              {apiKey.key_prefix}...
                            </span>
                            {apiKey.is_active ? (
                              <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 dark:bg-green-900/20 text-green-800 dark:text-green-400">
                                Active
                              </span>
                            ) : (
                              <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-red-100 dark:bg-red-900/20 text-red-800 dark:text-red-400">
                                Inactive
                              </span>
                            )}
                          </div>
                          <div className="mt-1 text-sm text-gray-500 dark:text-gray-400 space-y-1">
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
                          className="inline-flex items-center px-3 py-2 border border-gray-300 dark:border-gray-600 text-sm leading-4 font-medium rounded-md text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700"
                        >
                          <EyeIcon className="h-4 w-4 mr-1" />
                          Manage Scopes
                        </button>
                        <button
                          onClick={() => revokeAPIKey(apiKey.id, apiKey.name)}
                          className="inline-flex items-center px-3 py-2 border border-transparent text-sm leading-4 font-medium rounded-md text-red-700 dark:text-red-400 bg-red-100 dark:bg-red-900/20 hover:bg-red-200 dark:hover:bg-red-900/30"
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

          <div className="mt-8 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
            <div className="flex">
              <div className="flex-shrink-0">
                <InformationCircleIcon className="h-5 w-5 text-blue-400" />
              </div>
              <div className="ml-3">
                <p className="text-sm text-blue-700 dark:text-blue-300">
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
