import React, { useState } from 'react';
import { Head, router, usePage } from '@inertiajs/react';
import Layout from '../components/Layout';
import FlashMessages from '../components/FlashMessages';
import { Webhook, WebhookWithAPIKey, Server } from '../types';

interface Props {
  title?: string;
  webhooks: Webhook[];
  servers: Server[];
  csrfToken?: string;
}

export default function Webhooks({ title = 'Webhooks', webhooks, servers, csrfToken }: Props) {
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [editingWebhook, setEditingWebhook] = useState<Webhook | null>(null);
  const [generatingKey, setGeneratingKey] = useState<number | null>(null);
  const [newApiKey, setNewApiKey] = useState<string | null>(null);
  const [processing, setProcessing] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const { props } = usePage();
  const actualCsrfToken = csrfToken || (props.csrfToken as string | undefined);

  const [data, setData] = useState({
    name: '',
    description: '',
    stack_pattern: '*',
    server_scopes: [] as number[],
    expires_at: null as string | null,
  });

  const resetForm = () => {
    setData({
      name: '',
      description: '',
      stack_pattern: '*',
      server_scopes: [] as number[],
      expires_at: null,
    });
    setErrors({});
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-GB', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setProcessing(true);
    setErrors({});

    try {
      if (editingWebhook) {
        const response = await fetch(`/api/webhooks/${editingWebhook.id}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'X-CSRF-Token': actualCsrfToken || '',
          },
          credentials: 'include',
          body: JSON.stringify(data),
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || 'Update failed');
        }

        setEditingWebhook(null);
        resetForm();
        router.reload();
      } else {
        const response = await fetch('/api/webhooks', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-CSRF-Token': actualCsrfToken || '',
          },
          credentials: 'include',
          body: JSON.stringify(data),
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || 'Creation failed');
        }

        const webhookWithKey = (await response.json()) as WebhookWithAPIKey;
        if (webhookWithKey.api_key) {
          setNewApiKey(webhookWithKey.api_key);
        }
        setShowCreateForm(false);
        resetForm();
        router.reload();
      }
    } catch (error) {
      console.error('Submit failed:', error);
      alert(
        'Failed to save webhook: ' + (error instanceof Error ? error.message : 'Unknown error')
      );
    } finally {
      setProcessing(false);
    }
  };

  const handleEdit = (webhook: Webhook) => {
    setEditingWebhook(webhook);
    setShowCreateForm(false);
    setData({
      name: webhook.name,
      description: webhook.description,
      stack_pattern: webhook.stack_pattern,
      server_scopes: webhook.server_scopes || [],
      expires_at: webhook.expires_at,
    });
    setErrors({});
  };

  const handleCancelEdit = () => {
    setEditingWebhook(null);
    resetForm();
  };

  const handleDelete = async (webhookId: number) => {
    if (!confirm('Are you sure you want to delete this webhook? This action cannot be undone.'))
      return;

    try {
      const response = await fetch(`/api/webhooks/${webhookId}`, {
        method: 'DELETE',
        headers: {
          'X-CSRF-Token': actualCsrfToken || '',
        },
        credentials: 'include',
      });

      if (response.ok) {
        router.reload();
      } else {
        const errorData = await response.json();
        alert('Failed to delete webhook: ' + (errorData.error || 'Unknown error'));
      }
    } catch (error) {
      alert('Failed to delete webhook: ' + error);
    }
  };

  const handleRegenerateApiKey = async (webhookId: number) => {
    if (
      confirm(
        'Are you sure you want to regenerate the API key? The old key will stop working immediately.'
      )
    ) {
      setGeneratingKey(webhookId);
      try {
        const response = await fetch(`/api/webhooks/${webhookId}/regenerate`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-CSRF-Token': actualCsrfToken || '',
          },
        });

        if (response.ok) {
          const data = await response.json();
          setNewApiKey(data.api_key);
        } else {
          const errorData = await response.json();
          alert('Failed to regenerate API key: ' + (errorData.error || 'Unknown error'));
        }
      } catch (error) {
        alert('Failed to regenerate API key: ' + error);
      } finally {
        setGeneratingKey(null);
      }
    }
  };

  const toggleWebhookStatus = async (webhookId: number, currentStatus: boolean) => {
    const webhook = webhooks.find((w) => w.id === webhookId);
    if (!webhook) {
      console.error('Webhook not found');
      return;
    }

    try {
      const response = await fetch(`/api/webhooks/${webhookId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-Token': actualCsrfToken || '',
        },
        credentials: 'include',
        body: JSON.stringify({
          name: webhook.name,
          description: webhook.description,
          stack_pattern: webhook.stack_pattern,
          is_active: !currentStatus,
          server_scopes: webhook.server_scopes,
          expires_at: webhook.expires_at,
        }),
      });

      if (response.ok) {
        router.reload();
      } else {
        const errorData = await response.json();
        alert('Failed to update webhook: ' + (errorData.error || 'Unknown error'));
      }
    } catch (error) {
      alert('Failed to update webhook: ' + error);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text).then(() => {
      alert('API key copied to clipboard');
    });
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
            <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
              Manage webhooks for triggering operations remotely
            </p>
          </div>
          <div className="mt-4 flex md:mt-0 md:ml-4">
            <button
              onClick={() => {
                if (editingWebhook) {
                  handleCancelEdit();
                } else {
                  setShowCreateForm(!showCreateForm);
                }
              }}
              className="ml-3 inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 dark:bg-blue-700 dark:hover:bg-blue-600"
            >
              {editingWebhook ? 'Cancel Edit' : showCreateForm ? 'Cancel' : 'Create Webhook'}
            </button>
          </div>
        </div>

        <FlashMessages />

        {/* New API Key Display */}
        {newApiKey && (
          <div className="mt-8 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-md p-4">
            <div className="flex">
              <div className="flex-shrink-0">
                <svg className="h-5 w-5 text-green-400" viewBox="0 0 20 20" fill="currentColor">
                  <path
                    fillRule="evenodd"
                    d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                    clipRule="evenodd"
                  />
                </svg>
              </div>
              <div className="ml-3">
                <h3 className="text-sm font-medium text-green-800 dark:text-green-200">
                  API Key Generated Successfully
                </h3>
                <div className="mt-2 text-sm text-green-700 dark:text-green-300">
                  <p className="mb-2">
                    Please copy and save this API key. It will not be shown again.
                  </p>
                  <div className="flex items-center space-x-2">
                    <code className="bg-green-100 dark:bg-green-800 px-2 py-1 rounded text-xs font-mono">
                      {newApiKey}
                    </code>
                    <button
                      onClick={() => copyToClipboard(newApiKey)}
                      className="text-green-600 dark:text-green-400 hover:text-green-500 dark:hover:text-green-300"
                    >
                      Copy
                    </button>
                  </div>
                </div>
                <div className="mt-3">
                  <button
                    onClick={() => setNewApiKey(null)}
                    className="text-sm bg-green-100 dark:bg-green-800 hover:bg-green-200 dark:hover:bg-green-700 text-green-800 dark:text-green-200 px-3 py-1 rounded"
                  >
                    I've saved it
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {(showCreateForm || editingWebhook) && (
          <div className="mt-8 bg-white dark:bg-gray-800 shadow rounded-lg">
            <div className="px-4 py-5 sm:p-6">
              <h3 className="text-lg leading-6 font-medium text-gray-900 dark:text-white mb-4">
                {editingWebhook ? `Edit Webhook: ${editingWebhook.name}` : 'Create New Webhook'}
              </h3>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                      Name
                    </label>
                    <input
                      type="text"
                      required
                      value={data.name}
                      onChange={(e) => setData({ ...data, name: e.target.value })}
                      className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                      placeholder="Enter webhook name"
                    />
                    {errors.name && <p className="mt-1 text-sm text-red-600">{errors.name}</p>}
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                      Stack Pattern <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      value={data.stack_pattern}
                      onChange={(e) => setData({ ...data, stack_pattern: e.target.value })}
                      className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                      placeholder="e.g., *, prod_*, test_stack"
                    />
                    <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                      Examples: <code>*</code> (all), <code>prod_*</code> (prefix),{' '}
                      <code>*_stack</code> (suffix)
                    </p>
                    {errors.stack_pattern && (
                      <p className="mt-1 text-sm text-red-600">{errors.stack_pattern}</p>
                    )}
                  </div>
                  <div className="sm:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                      Description
                    </label>
                    <textarea
                      value={data.description}
                      onChange={(e) => setData({ ...data, description: e.target.value })}
                      rows={3}
                      className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                      placeholder="Enter webhook description"
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Server Scopes (optional)
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                      {servers.map((server) => (
                        <label key={server.id} className="flex items-center">
                          <input
                            type="checkbox"
                            checked={data.server_scopes.includes(server.id)}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setData({
                                  ...data,
                                  server_scopes: [...data.server_scopes, server.id],
                                });
                              } else {
                                setData({
                                  ...data,
                                  server_scopes: data.server_scopes.filter(
                                    (id) => id !== server.id
                                  ),
                                });
                              }
                            }}
                            className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                          />
                          <span className="ml-2 text-sm text-gray-700 dark:text-gray-300">
                            {server.name}
                          </span>
                        </label>
                      ))}
                    </div>
                    <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                      Leave empty to allow all servers you have access to
                    </p>
                  </div>
                </div>
                <div className="flex justify-end space-x-3">
                  <button
                    type="button"
                    onClick={() => {
                      if (editingWebhook) {
                        handleCancelEdit();
                      } else {
                        setShowCreateForm(false);
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
                    {processing
                      ? 'Saving...'
                      : editingWebhook
                        ? 'Update Webhook'
                        : 'Create Webhook'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        <div className="mt-8 flex flex-col">
          <div className="-my-2 -mx-4 overflow-x-auto sm:-mx-6 lg:-mx-8">
            <div className="inline-block min-w-full py-2 align-middle md:px-6 lg:px-8">
              <div className="overflow-hidden shadow ring-1 ring-black ring-opacity-5 md:rounded-lg">
                <table className="min-w-full divide-y divide-gray-300 dark:divide-gray-700">
                  <thead className="bg-gray-50 dark:bg-gray-800">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                        ID
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                        Webhook
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                        Stack Pattern
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                        Status
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                        Usage
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                        Created
                      </th>
                      <th className="relative px-6 py-3">
                        <span className="sr-only">Actions</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white dark:bg-gray-900 divide-y divide-gray-200 dark:divide-gray-700">
                    {webhooks.map((webhook) => (
                      <tr key={webhook.id}>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm font-mono text-gray-900 dark:text-white">
                            #{webhook.id}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center">
                            <div>
                              <div className="text-sm font-medium text-gray-900 dark:text-white">
                                {webhook.name}
                              </div>
                              {webhook.description && (
                                <div className="text-sm text-gray-500 dark:text-gray-400">
                                  {webhook.description}
                                </div>
                              )}
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <code className="px-2 py-1 text-xs bg-gray-100 dark:bg-gray-700 rounded">
                            {webhook.stack_pattern}
                          </code>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <button
                            onClick={() => toggleWebhookStatus(webhook.id, webhook.is_active)}
                            className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                              webhook.is_active
                                ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                                : 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
                            }`}
                          >
                            {webhook.is_active ? 'Active' : 'Inactive'}
                          </button>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm text-gray-900 dark:text-white">
                            {webhook.trigger_count} triggers
                          </div>
                          <div className="text-sm text-gray-500 dark:text-gray-400">
                            {webhook.last_triggered
                              ? `Last: ${formatDate(webhook.last_triggered)}`
                              : 'Never triggered'}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                          {formatDate(webhook.created_at)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium space-x-2">
                          <button
                            onClick={() => handleEdit(webhook)}
                            className="text-indigo-600 hover:text-indigo-900 dark:text-indigo-400 dark:hover:text-indigo-300"
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => handleRegenerateApiKey(webhook.id)}
                            disabled={generatingKey === webhook.id}
                            className="text-yellow-600 hover:text-yellow-900 dark:text-yellow-400 dark:hover:text-yellow-300 disabled:opacity-50"
                          >
                            {generatingKey === webhook.id ? 'Generating...' : 'Regenerate Key'}
                          </button>
                          <button
                            onClick={() => handleDelete(webhook.id)}
                            className="text-red-600 hover:text-red-900 dark:text-red-400 dark:hover:text-red-300"
                          >
                            Delete
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {webhooks.length === 0 && (
                  <div className="text-center py-12">
                    <div className="text-sm text-gray-500 dark:text-gray-400">
                      No webhooks created yet.
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Curl Example Section */}
        <div className="mt-8 bg-white dark:bg-gray-800 shadow rounded-lg">
          <div className="px-4 py-5 sm:p-6">
            <h3 className="text-lg leading-6 font-medium text-gray-900 dark:text-white mb-4">
              API Usage Example
            </h3>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
              Trigger webhook operations programmatically using curl. Replace the placeholder values
              with your actual webhook details.
            </p>

            <div className="bg-gray-50 dark:bg-gray-900 rounded-md p-4">
              <h4 className="text-sm font-medium text-gray-900 dark:text-white mb-2">
                Single Operation Example
              </h4>
              <pre className="text-xs font-mono text-gray-800 dark:text-gray-200 overflow-x-auto whitespace-pre-wrap break-all">
                {`curl -X POST "https://your-berth-instance.com/api/v1/webhooks/{WEBHOOK_ID}/trigger" \\
  -H "Content-Type: application/json" \\
  -d '{
    "api_key": "wh_your_webhook_api_key_here",
    "server_id": 1,
    "stack_name": "my_stack",
    "command": "up",
    "options": ["-d"],
    "services": ["web", "db"]
  }'`}
              </pre>
            </div>

            <div className="bg-gray-50 dark:bg-gray-900 rounded-md p-4 mt-4">
              <h4 className="text-sm font-medium text-gray-900 dark:text-white mb-2">
                Multiple Operations Example
              </h4>
              <pre className="text-xs font-mono text-gray-800 dark:text-gray-200 overflow-x-auto whitespace-pre-wrap break-all">
                {`curl -X POST "https://your-berth-instance.com/api/v1/webhooks/{WEBHOOK_ID}/trigger" \\
  -H "Content-Type: application/json" \\
  -d '{
    "api_key": "wh_your_webhook_api_key_here",
    "server_id": 1,
    "stack_name": "my_stack",
    "operations": [
      {
        "command": "pull",
        "options": []
      },
      {
        "command": "up",
        "options": ["-d", "--remove-orphans"]
      }
    ]
  }'`}
              </pre>
            </div>

            <div className="mt-4 p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-md">
              <h4 className="text-sm font-semibold text-blue-900 dark:text-blue-200 mb-2">
                Parameters
              </h4>
              <ul className="text-xs text-blue-800 dark:text-blue-300 space-y-1">
                <li>
                  <strong>api_key:</strong> Your webhook's API key (starts with "wh_")
                </li>
                <li>
                  <strong>server_id:</strong> ID of the target server (number)
                </li>
                <li>
                  <strong>stack_name:</strong> Name of the Docker stack to operate on
                </li>
                <li>
                  <strong>command:</strong> Docker Compose command (e.g., "up", "down", "pull",
                  "restart")
                </li>
                <li>
                  <strong>options:</strong> Array of command line options (e.g., ["-d",
                  "--remove-orphans"])
                </li>
                <li>
                  <strong>services:</strong> Array of specific services to target (optional)
                </li>
                <li>
                  <strong>operations:</strong> Array of multiple operations (alternative to single
                  command)
                </li>
              </ul>
            </div>

            <div className="mt-4 p-4 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-md">
              <h4 className="text-sm font-semibold text-yellow-900 dark:text-yellow-200 mb-2">
                Rate Limiting
              </h4>
              <p className="text-xs text-yellow-800 dark:text-yellow-300">
                Webhook triggers are rate limited to 100 requests per minute. Ensure your automation
                respects these limits.
              </p>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
}
