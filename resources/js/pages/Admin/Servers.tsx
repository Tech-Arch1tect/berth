import React, { useState } from 'react';
import { Head, router, useForm } from '@inertiajs/react';
import Layout from '../../components/Layout';
import FlashMessages from '../../components/FlashMessages';

interface Server {
  id: number;
  name: string;
  description: string;
  host: string;
  port: number;
  use_https: boolean;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

interface Props {
  title?: string;
  servers: Server[];
  csrfToken?: string;
}

export default function AdminServers({ title = 'Servers', servers, csrfToken }: Props) {
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingServer, setEditingServer] = useState<Server | null>(null);
  const [testingConnection, setTestingConnection] = useState<number | null>(null);

  const { data, setData, post, put, processing, reset } = useForm({
    name: '',
    description: '',
    host: '',
    port: 8080,
    use_https: false,
    access_token: '',
    is_active: true,
  });

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-GB', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingServer) {
      put(`/admin/servers/${editingServer.id}`, {
        headers: {
          'X-CSRF-Token': csrfToken || '',
        },
        onSuccess: () => {
          setEditingServer(null);
          reset();
        },
        onError: (errors) => {
          console.error('Update failed:', errors);
        },
      });
    } else {
      post('/admin/servers', {
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

  const handleEdit = (server: Server) => {
    setEditingServer(server);
    setShowAddForm(false);
    setData({
      name: server.name,
      description: server.description,
      host: server.host,
      port: server.port,
      use_https: server.use_https,
      access_token: '',
      is_active: server.is_active,
    });
  };

  const handleCancelEdit = () => {
    setEditingServer(null);
    reset();
  };

  const handleDelete = (serverId: number) => {
    if (confirm('Are you sure you want to delete this server?')) {
      router.delete(`/admin/servers/${serverId}`, {
        headers: {
          'X-CSRF-Token': csrfToken || '',
        },
        onSuccess: () => {},
        onError: (errors) => {
          console.error('Delete failed:', errors);
          alert('Failed to delete server');
        },
      });
    }
  };

  const handleTestConnection = async (serverId: number) => {
    setTestingConnection(serverId);
    try {
      const response = await fetch(`/admin/servers/${serverId}/test`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-Token': csrfToken || '',
        },
      });

      if (response.ok) {
        const data = await response.json();
        alert('Connection successful!');
      } else {
        const errorData = await response.json();
        alert('Connection failed: ' + (errorData.error || errorData.details || 'Unknown error'));
      }
    } catch (error) {
      alert('Connection failed: ' + error);
    } finally {
      setTestingConnection(null);
    }
  };

  const toggleServerStatus = (serverId: number, currentStatus: boolean) => {
    router.put(
      `/admin/servers/${serverId}`,
      { is_active: !currentStatus },
      {
        headers: {
          'X-CSRF-Token': csrfToken || '',
        },
        onError: (errors) => {
          console.error('Update failed:', errors);
        },
      }
    );
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
                if (editingServer) {
                  handleCancelEdit();
                } else {
                  setShowAddForm(!showAddForm);
                }
              }}
              className="ml-3 inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 dark:bg-blue-700 dark:hover:bg-blue-600"
            >
              {editingServer ? 'Cancel Edit' : showAddForm ? 'Cancel' : 'Add Server'}
            </button>
          </div>
        </div>

        <FlashMessages />

        {(showAddForm || editingServer) && (
          <div className="mt-8 bg-white dark:bg-gray-800 shadow rounded-lg">
            <div className="px-4 py-5 sm:p-6">
              <h3 className="text-lg leading-6 font-medium text-gray-900 dark:text-white mb-4">
                {editingServer ? `Edit Server: ${editingServer.name}` : 'Add New Server'}
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
                      onChange={(e) => setData('name', e.target.value)}
                      className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                      Host
                    </label>
                    <input
                      type="text"
                      required
                      value={data.host}
                      onChange={(e) => setData('host', e.target.value)}
                      className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                      Port
                    </label>
                    <input
                      type="number"
                      required
                      value={data.port}
                      onChange={(e) => setData('port', parseInt(e.target.value))}
                      className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                    />
                  </div>
                  <div className="flex items-center">
                    <input
                      type="checkbox"
                      checked={data.use_https}
                      onChange={(e) => setData('use_https', e.target.checked)}
                      className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                    />
                    <label className="ml-2 block text-sm text-gray-700 dark:text-gray-300">
                      Use HTTPS
                    </label>
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
                  <div className="sm:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                      Access Token{' '}
                      {editingServer && (
                        <span className="text-sm text-gray-500">(leave blank to keep current)</span>
                      )}
                    </label>
                    <input
                      type="password"
                      required={!editingServer}
                      value={data.access_token}
                      onChange={(e) => setData('access_token', e.target.value)}
                      placeholder={editingServer ? 'Enter new token or leave blank' : ''}
                      className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                    />
                  </div>
                </div>
                <div className="flex justify-end space-x-3">
                  <button
                    type="button"
                    onClick={() => {
                      if (editingServer) {
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
                    {processing ? 'Saving...' : editingServer ? 'Update Server' : 'Add Server'}
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
                        Server
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                        Host
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                        Status
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
                    {servers.map((server) => (
                      <tr key={server.id}>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center">
                            <div>
                              <div className="text-sm font-medium text-gray-900 dark:text-white">
                                {server.name}
                              </div>
                              {server.description && (
                                <div className="text-sm text-gray-500 dark:text-gray-400">
                                  {server.description}
                                </div>
                              )}
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm text-gray-900 dark:text-white">
                            {server.use_https ? 'https' : 'http'}://{server.host}:{server.port}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <button
                            onClick={() => toggleServerStatus(server.id, server.is_active)}
                            className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                              server.is_active
                                ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                                : 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
                            }`}
                          >
                            {server.is_active ? 'Active' : 'Inactive'}
                          </button>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                          {formatDate(server.created_at)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium space-x-2">
                          <button
                            onClick={() => handleEdit(server)}
                            className="text-indigo-600 hover:text-indigo-900 dark:text-indigo-400 dark:hover:text-indigo-300"
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => handleTestConnection(server.id)}
                            disabled={testingConnection === server.id}
                            className="text-blue-600 hover:text-blue-900 dark:text-blue-400 dark:hover:text-blue-300 disabled:opacity-50"
                          >
                            {testingConnection === server.id ? 'Testing...' : 'Test'}
                          </button>
                          <button
                            onClick={() => handleDelete(server.id)}
                            className="text-red-600 hover:text-red-900 dark:text-red-400 dark:hover:text-red-300"
                          >
                            Delete
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {servers.length === 0 && (
                  <div className="text-center py-8">
                    <p className="text-gray-500 dark:text-gray-400">No servers configured yet.</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
}
