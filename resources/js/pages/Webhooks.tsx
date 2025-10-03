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
              className="inline-flex items-center px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-xl border border-blue-600 hover:border-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-all duration-200 dark:bg-blue-700 dark:hover:bg-blue-600 dark:border-blue-700 dark:hover:border-blue-600"
            >
              {editingWebhook ? (
                <>
                  <svg
                    className="w-4 h-4 mr-2"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M6 18L18 6M6 6l12 12"
                    />
                  </svg>
                  Cancel Edit
                </>
              ) : showCreateForm ? (
                <>
                  <svg
                    className="w-4 h-4 mr-2"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M6 18L18 6M6 6l12 12"
                    />
                  </svg>
                  Cancel
                </>
              ) : (
                <>
                  <svg
                    className="w-4 h-4 mr-2"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M12 6v6m0 0v6m0-6h6m-6 0H6"
                    />
                  </svg>
                  Create Webhook
                </>
              )}
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
                      className="inline-flex items-center px-2 py-1 text-xs font-medium rounded-md text-green-700 bg-green-50 hover:bg-green-100 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 dark:bg-green-900/30 dark:text-green-300 dark:hover:bg-green-900/40"
                      title="Copy API key to clipboard"
                    >
                      <svg
                        className="w-3 h-3 mr-1"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
                        />
                      </svg>
                      Copy
                    </button>
                  </div>
                </div>
                <div className="mt-3">
                  <button
                    onClick={() => setNewApiKey(null)}
                    className="inline-flex items-center px-3 py-1 text-sm font-medium rounded-md text-green-700 bg-green-100 hover:bg-green-200 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 dark:bg-green-800 dark:text-green-200 dark:hover:bg-green-700"
                  >
                    <svg
                      className="w-4 h-4 mr-2"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M5 13l4 4L19 7"
                      />
                    </svg>
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
                    className="inline-flex items-center px-4 py-2 bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 text-sm font-medium rounded-xl border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-all duration-200"
                  >
                    <svg
                      className="w-4 h-4 mr-2"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M6 18L18 6M6 6l12 12"
                      />
                    </svg>
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={processing}
                    className="inline-flex items-center px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-xl border border-blue-600 hover:border-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 dark:bg-blue-700 dark:hover:bg-blue-600 dark:border-blue-700 dark:hover:border-blue-600"
                  >
                    {processing ? (
                      <>
                        <svg className="w-4 h-4 mr-2 animate-spin" fill="none" viewBox="0 0 24 24">
                          <circle
                            className="opacity-25"
                            cx="12"
                            cy="12"
                            r="10"
                            stroke="currentColor"
                            strokeWidth="4"
                          ></circle>
                          <path
                            className="opacity-75"
                            fill="currentColor"
                            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                          ></path>
                        </svg>
                        Saving...
                      </>
                    ) : editingWebhook ? (
                      <>
                        <svg
                          className="w-4 h-4 mr-2"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"
                          />
                        </svg>
                        Update Webhook
                      </>
                    ) : (
                      <>
                        <svg
                          className="w-4 h-4 mr-2"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M12 6v6m0 0v6m0-6h6m-6 0H6"
                          />
                        </svg>
                        Create Webhook
                      </>
                    )}
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
                            className={`inline-flex items-center px-3 py-1 text-xs font-medium rounded-md focus:outline-none focus:ring-2 focus:ring-offset-2 transition-colors duration-200 ${
                              webhook.is_active
                                ? 'text-green-700 bg-green-100 hover:bg-green-200 focus:ring-green-500 dark:bg-green-900/20 dark:text-green-400 dark:hover:bg-green-900/30'
                                : 'text-red-700 bg-red-100 hover:bg-red-200 focus:ring-red-500 dark:bg-red-900/20 dark:text-red-400 dark:hover:bg-red-900/30'
                            }`}
                            title={`Click to ${webhook.is_active ? 'disable' : 'enable'} webhook`}
                          >
                            <div
                              className={`w-2 h-2 rounded-full mr-2 ${webhook.is_active ? 'bg-green-500' : 'bg-red-500'}`}
                            />
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
                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                          <div className="flex items-center justify-end space-x-2">
                            {/* Edit Button */}
                            <button
                              onClick={() => handleEdit(webhook)}
                              className="inline-flex items-center px-3 py-1 text-xs font-medium rounded-md text-blue-700 bg-blue-100 hover:bg-blue-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:bg-blue-900/20 dark:text-blue-400 dark:hover:bg-blue-900/30"
                              title="Edit webhook"
                            >
                              <svg
                                className="w-3 h-3 mr-1"
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                              >
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  strokeWidth={2}
                                  d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                                />
                              </svg>
                              Edit
                            </button>

                            {/* Regenerate Key Button */}
                            <button
                              onClick={() => handleRegenerateApiKey(webhook.id)}
                              disabled={generatingKey === webhook.id}
                              className="inline-flex items-center px-3 py-1 text-xs font-medium rounded-md text-yellow-700 bg-yellow-100 hover:bg-yellow-200 focus:outline-none focus:ring-2 focus:ring-yellow-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed dark:bg-yellow-900/20 dark:text-yellow-400 dark:hover:bg-yellow-900/30"
                              title="Regenerate API key"
                            >
                              {generatingKey === webhook.id ? (
                                <svg
                                  className="w-3 h-3 mr-1 animate-spin"
                                  fill="none"
                                  viewBox="0 0 24 24"
                                >
                                  <circle
                                    className="opacity-25"
                                    cx="12"
                                    cy="12"
                                    r="10"
                                    stroke="currentColor"
                                    strokeWidth="4"
                                  ></circle>
                                  <path
                                    className="opacity-75"
                                    fill="currentColor"
                                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                                  ></path>
                                </svg>
                              ) : (
                                <svg
                                  className="w-3 h-3 mr-1"
                                  fill="none"
                                  stroke="currentColor"
                                  viewBox="0 0 24 24"
                                >
                                  <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth={2}
                                    d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"
                                  />
                                </svg>
                              )}
                              {generatingKey === webhook.id ? 'Generating...' : 'Regenerate'}
                            </button>

                            {/* Delete Button */}
                            <button
                              onClick={() => handleDelete(webhook.id)}
                              className="inline-flex items-center px-3 py-1 text-xs font-medium rounded-md text-red-700 bg-red-100 hover:bg-red-200 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 dark:bg-red-900/20 dark:text-red-400 dark:hover:bg-red-900/30"
                              title="Delete webhook"
                            >
                              <svg
                                className="w-3 h-3 mr-1"
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                              >
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  strokeWidth={2}
                                  d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                                />
                              </svg>
                              Delete
                            </button>
                          </div>
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

        {/* CLI Usage Section */}
        <div className="mt-8 bg-white dark:bg-gray-800 shadow rounded-lg">
          <div className="px-4 py-5 sm:p-6">
            <h3 className="text-lg leading-6 font-medium text-gray-900 dark:text-white mb-4">
              CLI Usage
            </h3>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
              Trigger webhook operations using the Berth CLI. Replace the placeholder values with
              your actual webhook details.
            </p>

            <div className="bg-gray-50 dark:bg-gray-900 rounded-md p-4">
              <h4 className="text-sm font-medium text-gray-900 dark:text-white mb-2">
                Example Usage
              </h4>
              <pre className="text-xs font-mono text-gray-800 dark:text-gray-200 overflow-x-auto whitespace-pre-wrap break-all">
                {`berth-webhook \\
  --webhook-id {WEBHOOK_ID} \\
  --api-key "wh_your_webhook_api_key_here" \\
  --server-id {SERVER_ID} \\
  --stack "my_stack" \\
  --command "up" \\
  --options "-d,--remove-orphans" \\
  --services "web,db" \\
  --berth-url "https://your-berth-instance.com"`}
              </pre>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                The CLI streams operation output in real-time and exits with appropriate status
                codes for CI/CD integration.
              </p>
            </div>

            <div className="mt-4 p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-md">
              <h4 className="text-sm font-semibold text-blue-900 dark:text-blue-200 mb-2">
                Parameters
              </h4>
              <ul className="text-xs text-blue-800 dark:text-blue-300 space-y-1">
                <li>
                  <strong>--webhook-id:</strong> The webhook ID from the table above
                </li>
                <li>
                  <strong>--api-key:</strong> Your webhook's API key (starts with "wh_")
                </li>
                <li>
                  <strong>--server-id:</strong> ID of the target server (visible on server cards)
                </li>
                <li>
                  <strong>--stack:</strong> Name of the Docker stack to operate on
                </li>
                <li>
                  <strong>--command:</strong> Docker Compose command (e.g., "up", "down", "pull",
                  "restart")
                </li>
                <li>
                  <strong>--options:</strong> Comma-separated Docker Compose options (e.g.,
                  "-d,--remove-orphans")
                </li>
                <li>
                  <strong>--services:</strong> Comma-separated service names to target (optional)
                </li>
                <li>
                  <strong>--berth-url:</strong> URL of your Berth instance
                </li>
                <li>
                  <strong>--insecure:</strong> Skip TLS verification (optional)
                </li>
                <li>
                  <strong>--verbose:</strong> Enable verbose logging (optional)
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
