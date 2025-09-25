import React, { useState, useEffect } from 'react';
import { Head } from '@inertiajs/react';
import Layout from '../../components/Layout';
import FlashMessages from '../../components/FlashMessages';

interface Webhook {
  id: number;
  created_at: string;
  updated_at: string;
  name: string;
  description: string;
  stack_pattern: string;
  is_active: boolean;
  last_triggered: string | null;
  trigger_count: number;
  expires_at: string | null;
  server_scopes: number[];
  user_name: string;
}

interface Props {
  title: string;
}

export default function AdminWebhooks({ title }: Props) {
  const [webhooks, setWebhooks] = useState<Webhook[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchWebhooks = async () => {
    setLoading(true);
    try {
      const response = await fetch('/admin/api/webhooks');
      const data = await response.json();
      setWebhooks(data || []);
    } catch (error) {
      console.error('Failed to fetch webhooks:', error);
    } finally {
      setLoading(false);
    }
  };

  const deleteWebhook = async (webhookId: number) => {
    if (!confirm('Are you sure you want to delete this webhook? This action cannot be undone.')) {
      return;
    }

    try {
      const response = await fetch(`/admin/api/webhooks/${webhookId}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        await fetchWebhooks(); // Refresh the list
      } else {
        const errorData = await response.json();
        alert('Failed to delete webhook: ' + (errorData.error || 'Unknown error'));
      }
    } catch (error) {
      console.error('Failed to delete webhook:', error);
      alert('Failed to delete webhook: ' + error);
    }
  };

  useEffect(() => {
    fetchWebhooks();
  }, []);

  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'Never';
    return new Date(dateString).toLocaleDateString('en-GB', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
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
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              Manage all user webhooks from the admin panel
            </p>
          </div>
        </div>

        <FlashMessages />

        {/* Webhooks Table */}
        <div className="mt-8 flex flex-col">
          <div className="-my-2 -mx-4 overflow-x-auto sm:-mx-6 lg:-mx-8">
            <div className="inline-block min-w-full py-2 align-middle md:px-6 lg:px-8">
              <div className="overflow-hidden shadow ring-1 ring-black dark:ring-white ring-opacity-5 dark:ring-opacity-10 md:rounded-lg">
                <table className="min-w-full divide-y divide-gray-300 dark:divide-gray-600">
                  <thead className="bg-gray-50 dark:bg-gray-800">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                        ID
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                        Webhook
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                        User
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
                    {loading ? (
                      <tr>
                        <td colSpan={8} className="px-6 py-4 text-center">
                          <div className="text-sm text-gray-500 dark:text-gray-400">Loading...</div>
                        </td>
                      </tr>
                    ) : webhooks.length === 0 ? (
                      <tr>
                        <td colSpan={8} className="px-6 py-4 text-center">
                          <div className="text-sm text-gray-500 dark:text-gray-400">
                            No webhooks found.
                          </div>
                        </td>
                      </tr>
                    ) : (
                      webhooks.map((webhook) => (
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
                            <div className="text-sm text-gray-900 dark:text-white">
                              {webhook.user_name || 'Unknown'}
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <code className="px-2 py-1 text-xs bg-gray-100 dark:bg-gray-700 rounded">
                              {webhook.stack_pattern}
                            </code>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span
                              className={`inline-flex items-center px-3 py-1 text-xs font-medium rounded-md focus:outline-none focus:ring-2 focus:ring-offset-2 transition-colors duration-200 ${
                                webhook.is_active
                                  ? 'text-green-700 bg-green-100 dark:bg-green-900/20 dark:text-green-400'
                                  : 'text-red-700 bg-red-100 dark:bg-red-900/20 dark:text-red-400'
                              }`}
                            >
                              <div
                                className={`w-2 h-2 rounded-full mr-2 ${webhook.is_active ? 'bg-green-500' : 'bg-red-500'}`}
                              />
                              {webhook.is_active ? 'Active' : 'Inactive'}
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm text-gray-900 dark:text-white">
                              {webhook.trigger_count} triggers
                            </div>
                            <div className="text-sm text-gray-500 dark:text-gray-400">
                              Last: {formatDate(webhook.last_triggered)}
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                            {formatDate(webhook.created_at)}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                            <div className="flex items-center justify-end space-x-2">
                              {/* Delete Button */}
                              <button
                                onClick={() => deleteWebhook(webhook.id)}
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
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
}
