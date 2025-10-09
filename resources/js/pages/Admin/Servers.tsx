import React, { useState } from 'react';
import { Head, router, useForm } from '@inertiajs/react';
import Layout from '../../components/Layout';
import FlashMessages from '../../components/FlashMessages';
import { cn } from '../../utils/cn';
import { theme } from '../../theme';

interface Server {
  id: number;
  name: string;
  description: string;
  host: string;
  port: number;
  skip_ssl_verification: boolean;
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
    skip_ssl_verification: true,
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
      skip_ssl_verification: server.skip_ssl_verification,
      access_token: '',
      is_active: server.is_active,
    });
  };

  const handleCancelEdit = () => {
    setEditingServer(null);
    reset();
  };

  const handleDelete = (serverid: number) => {
    if (confirm('Are you sure you want to delete this server?')) {
      router.delete(`/admin/servers/${serverid}`, {
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

  const handleTestConnection = async (serverid: number) => {
    setTestingConnection(serverid);
    try {
      const response = await fetch(`/admin/servers/${serverid}/test`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-Token': csrfToken || '',
        },
      });

      if (response.ok) {
        await response.json(); // Consume the response body
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

  const toggleServerStatus = (serverid: number, currentStatus: boolean) => {
    const server = servers.find((s) => s.id === serverid);
    if (!server) {
      console.error('Server not found');
      return;
    }

    router.put(
      `/admin/servers/${serverid}`,
      {
        name: server.name,
        description: server.description,
        host: server.host,
        port: server.port,
        skip_ssl_verification: server.skip_ssl_verification,
        is_active: !currentStatus,
      },
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
              onClick={() => {
                if (editingServer) {
                  handleCancelEdit();
                } else {
                  setShowAddForm(!showAddForm);
                }
              }}
              className={cn('ml-3', theme.buttons.primary)}
            >
              {editingServer ? 'Cancel Edit' : showAddForm ? 'Cancel' : 'Add Server'}
            </button>
          </div>
        </div>

        <FlashMessages />

        {(showAddForm || editingServer) && (
          <div className={cn('mt-8 shadow rounded-lg', theme.surface.panel)}>
            <div className="px-4 py-5 sm:p-6">
              <h3 className={cn('text-lg leading-6 font-medium mb-4', theme.text.strong)}>
                {editingServer ? `Edit Server: ${editingServer.name}` : 'Add New Server'}
              </h3>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div>
                    <label className={theme.forms.label}>Name</label>
                    <input
                      type="text"
                      required
                      value={data.name}
                      onChange={(e) => setData('name', e.target.value)}
                      className={cn('mt-1', theme.forms.input)}
                    />
                  </div>
                  <div>
                    <label className={theme.forms.label}>Host</label>
                    <input
                      type="text"
                      required
                      value={data.host}
                      onChange={(e) => setData('host', e.target.value)}
                      className={cn('mt-1', theme.forms.input)}
                    />
                  </div>
                  <div>
                    <label className={theme.forms.label}>Port</label>
                    <input
                      type="number"
                      required
                      value={data.port}
                      onChange={(e) => setData('port', parseInt(e.target.value))}
                      className={cn('mt-1', theme.forms.input)}
                    />
                  </div>
                  <div className="flex items-center">
                    <input
                      type="checkbox"
                      checked={data.skip_ssl_verification}
                      onChange={(e) => setData('skip_ssl_verification', e.target.checked)}
                      className={theme.forms.checkbox}
                    />
                    <label className={cn('ml-2 block text-sm', theme.text.standard)}>
                      Skip SSL Verification
                    </label>
                  </div>
                  <div className="sm:col-span-2">
                    <label className={theme.forms.label}>Description</label>
                    <textarea
                      value={data.description}
                      onChange={(e) => setData('description', e.target.value)}
                      rows={3}
                      className={cn('mt-1', theme.forms.textarea)}
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <label className={theme.forms.label}>
                      Access Token{' '}
                      {editingServer && (
                        <span className={cn('text-sm', theme.text.subtle)}>
                          (leave blank to keep current)
                        </span>
                      )}
                    </label>
                    <input
                      type="password"
                      required={!editingServer}
                      value={data.access_token}
                      onChange={(e) => setData('access_token', e.target.value)}
                      placeholder={editingServer ? 'Enter new token or leave blank' : ''}
                      className={cn('mt-1', theme.forms.input)}
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
                    className={theme.buttons.secondary}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={processing}
                    className={cn(theme.buttons.primary, 'disabled:opacity-50')}
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
                <table className="min-w-full divide-y divide-slate-300 dark:divide-slate-700">
                  <thead className={theme.table.head}>
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider">
                        ID
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider">
                        Server
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider">
                        Host
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider">
                        Status
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider">
                        Created
                      </th>
                      <th className="relative px-6 py-3">
                        <span className="sr-only">Actions</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody
                    className={cn(
                      theme.table.body,
                      'divide-y divide-slate-200 dark:divide-slate-700'
                    )}
                  >
                    {servers.map((server) => (
                      <tr key={server.id}>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className={cn('text-sm font-mono', theme.text.strong)}>
                            #{server.id}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center">
                            <div>
                              <div className={cn('text-sm font-medium', theme.text.strong)}>
                                {server.name}
                              </div>
                              {server.description && (
                                <div className={cn('text-sm', theme.text.subtle)}>
                                  {server.description}
                                </div>
                              )}
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className={cn('text-sm', theme.text.strong)}>
                            https://{server.host}:{server.port}
                            {server.skip_ssl_verification && (
                              <span className={cn('ml-2 text-xs', theme.text.warning)}>
                                (No SSL Verification)
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <button
                            onClick={() => toggleServerStatus(server.id, server.is_active)}
                            className={cn(
                              'inline-flex px-2 py-1 text-xs font-semibold rounded-full',
                              server.is_active
                                ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                                : 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
                            )}
                          >
                            {server.is_active ? 'Active' : 'Inactive'}
                          </button>
                        </td>
                        <td
                          className={cn('px-6 py-4 whitespace-nowrap text-sm', theme.text.subtle)}
                        >
                          {formatDate(server.created_at)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium space-x-2">
                          <button
                            onClick={() => handleEdit(server)}
                            className={cn('hover:underline', theme.text.info)}
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => handleTestConnection(server.id)}
                            disabled={testingConnection === server.id}
                            className={cn('hover:underline disabled:opacity-50', theme.text.info)}
                          >
                            {testingConnection === server.id ? 'Testing...' : 'Test'}
                          </button>
                          <button
                            onClick={() => handleDelete(server.id)}
                            className={cn('hover:underline', theme.text.danger)}
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
                    <p className={theme.text.subtle}>No servers configured yet.</p>
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
