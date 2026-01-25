import React, { useState } from 'react';
import { Head, router, useForm } from '@inertiajs/react';
import FlashMessages from '../../components/FlashMessages';
import { Modal } from '../../components/common/Modal';
import { ConfirmationModal } from '../../components/common/ConfirmationModal';
import { Table } from '../../components/common/Table';
import { cn } from '../../utils/cn';
import { theme } from '../../theme';
import {
  usePostApiV1AdminServers,
  usePutApiV1AdminServersId,
  useDeleteApiV1AdminServersId,
  usePostApiV1AdminServersIdTest,
} from '../../api/generated/admin/admin';

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
}

export default function AdminServers({ title = 'Servers', servers }: Props) {
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingServer, setEditingServer] = useState<Server | null>(null);
  const [testingConnection, setTestingConnection] = useState<number | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<{ id: number; name: string } | null>(null);
  const [testResultModal, setTestResultModal] = useState<{
    success: boolean;
    message: string;
  } | null>(null);

  const createServerMutation = usePostApiV1AdminServers();
  const updateServerMutation = usePutApiV1AdminServersId();
  const deleteServerMutation = useDeleteApiV1AdminServersId();
  const testConnectionMutation = usePostApiV1AdminServersIdTest();

  const processing =
    createServerMutation.isPending ||
    updateServerMutation.isPending ||
    deleteServerMutation.isPending;

  const { data, setData, reset } = useForm({
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

    const onSuccess = () => {
      router.reload();
      if (editingServer) {
        setEditingServer(null);
      } else {
        setShowAddForm(false);
      }
      reset();
    };

    const onError = (error: unknown) => {
      const errorData = error as { message?: string; error?: string };
      console.error('Operation failed:', errorData);
      alert(
        `Failed to ${editingServer ? 'update' : 'create'} server: ${errorData.message || errorData.error || 'Unknown error'}`
      );
    };

    if (editingServer) {
      updateServerMutation.mutate({ id: editingServer.id, data }, { onSuccess, onError });
    } else {
      createServerMutation.mutate({ data }, { onSuccess, onError });
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

  const handleDeleteClick = (serverId: number, serverName: string) => {
    setDeleteConfirm({ id: serverId, name: serverName });
  };

  const confirmDelete = () => {
    if (!deleteConfirm) return;

    deleteServerMutation.mutate(
      { id: deleteConfirm.id },
      {
        onSuccess: () => {
          router.reload();
          setDeleteConfirm(null);
        },
        onError: (error) => {
          const errorData = error as { message?: string; error?: string };
          console.error('Delete failed:', errorData);
          setTestResultModal({
            success: false,
            message: `Failed to delete server: ${errorData.message || errorData.error || 'Unknown error'}`,
          });
          setDeleteConfirm(null);
        },
      }
    );
  };

  const handleTestConnection = (serverid: number) => {
    setTestingConnection(serverid);
    testConnectionMutation.mutate(
      { id: serverid },
      {
        onSuccess: () => {
          setTestResultModal({
            success: true,
            message: 'Connection successful!',
          });
          setTestingConnection(null);
        },
        onError: (error) => {
          const errorData = error as { error?: string; details?: string };
          setTestResultModal({
            success: false,
            message:
              'Connection failed: ' + (errorData.error || errorData.details || 'Unknown error'),
          });
          setTestingConnection(null);
        },
      }
    );
  };

  const toggleServerStatus = (serverid: number, currentStatus: boolean) => {
    const server = servers.find((s) => s.id === serverid);
    if (!server) {
      console.error('Server not found');
      return;
    }

    updateServerMutation.mutate(
      {
        id: serverid,
        data: {
          name: server.name,
          description: server.description,
          host: server.host,
          port: server.port,
          skip_ssl_verification: server.skip_ssl_verification,
          is_active: !currentStatus,
          access_token: '',
        },
      },
      {
        onSuccess: () => {
          router.reload();
        },
        onError: (error) => {
          const errorData = error as { message?: string; error?: string };
          console.error('Update failed:', errorData);
          alert(
            `Failed to update server status: ${errorData.message || errorData.error || 'Unknown error'}`
          );
        },
      }
    );
  };

  return (
    <>
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
                <Table<Server>
                  data={servers}
                  keyExtractor={(server) => server.id.toString()}
                  emptyMessage="No servers configured yet."
                  columns={[
                    {
                      key: 'id',
                      header: 'ID',
                      render: (server) => (
                        <div className={cn('text-sm font-mono', theme.text.strong)}>
                          #{server.id}
                        </div>
                      ),
                    },
                    {
                      key: 'server',
                      header: 'Server',
                      render: (server) => (
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
                      ),
                    },
                    {
                      key: 'host',
                      header: 'Host',
                      render: (server) => (
                        <div className={cn('text-sm', theme.text.strong)}>
                          https://{server.host}:{server.port}
                          {server.skip_ssl_verification && (
                            <span className={cn('ml-2 text-xs', theme.text.warning)}>
                              (No SSL Verification)
                            </span>
                          )}
                        </div>
                      ),
                    },
                    {
                      key: 'status',
                      header: 'Status',
                      render: (server) => (
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
                      ),
                    },
                    {
                      key: 'created',
                      header: 'Created',
                      render: (server) => (
                        <span className={cn('text-sm', theme.text.subtle)}>
                          {formatDate(server.created_at)}
                        </span>
                      ),
                    },
                    {
                      key: 'actions',
                      header: '',
                      className: 'text-right',
                      render: (server) => (
                        <div className="text-sm font-medium space-x-2">
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
                            onClick={() => handleDeleteClick(server.id, server.name)}
                            className={cn('hover:underline', theme.text.danger)}
                          >
                            Delete
                          </button>
                        </div>
                      ),
                    },
                  ]}
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      <ConfirmationModal
        isOpen={!!deleteConfirm}
        onClose={() => setDeleteConfirm(null)}
        onConfirm={confirmDelete}
        title="Delete Server"
        message={`Are you sure you want to delete ${deleteConfirm?.name}? This action cannot be undone.`}
        confirmText="Delete"
        variant="danger"
      />

      {/* Test Result Modal */}
      <Modal
        isOpen={!!testResultModal}
        onClose={() => setTestResultModal(null)}
        title={testResultModal?.success ? 'Connection Successful' : 'Connection Failed'}
        size="sm"
        footer={
          <div className="flex justify-end">
            <button onClick={() => setTestResultModal(null)} className={theme.buttons.primary}>
              Close
            </button>
          </div>
        }
      >
        <p className={theme.text.standard}>{testResultModal?.message}</p>
      </Modal>
    </>
  );
}
