import React, { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Modal } from '../../../../shared/components/Modal';
import { ConfirmationModal } from '../../../../shared/components/ConfirmationModal';
import { Table } from '../../../../shared/components/Table';
import { LoadingSpinner } from '../../../../shared/components/LoadingSpinner';
import { useDocumentTitle } from '../../../../shared/hooks/useDocumentTitle';
import { cn } from '../../../../shared/utils/cn';
import { theme } from '../../../../shared/theme';
import { PlusIcon, ServerStackIcon } from '@heroicons/react/24/outline';
import {
  useGetApiV1AdminServers,
  usePostApiV1AdminServers,
  usePutApiV1AdminServersId,
  useDeleteApiV1AdminServersId,
  usePostApiV1AdminServersIdTest,
  getGetApiV1AdminServersQueryKey,
} from '../../../../api/generated/admin/admin';
import type { ServerInfo } from '../../../../api/generated/models';

interface ServerForm {
  name: string;
  description: string;
  host: string;
  port: number;
  skip_ssl_verification: boolean;
  access_token: string;
  is_active: boolean;
}

const EMPTY_FORM: ServerForm = {
  name: '',
  description: '',
  host: '',
  port: 8080,
  skip_ssl_verification: false,
  access_token: '',
  is_active: true,
};

export default function AdminServers() {
  useDocumentTitle('Servers');
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [editingServer, setEditingServer] = useState<ServerInfo | null>(null);
  const [testingConnection, setTestingConnection] = useState<number | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<ServerInfo | null>(null);
  const [deactivateConfirm, setDeactivateConfirm] = useState<ServerInfo | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [resultModal, setResultModal] = useState<{
    title: string;
    message: string;
  } | null>(null);

  const { data: serversResponse, isLoading: serversLoading } = useGetApiV1AdminServers();
  const servers = serversResponse?.data?.servers ?? [];

  const invalidateServers = () =>
    queryClient.invalidateQueries({ queryKey: getGetApiV1AdminServersQueryKey() });

  const createServerMutation = usePostApiV1AdminServers();
  const updateServerMutation = usePutApiV1AdminServersId();
  const deleteServerMutation = useDeleteApiV1AdminServersId();
  const testConnectionMutation = usePostApiV1AdminServersIdTest();

  const saving = createServerMutation.isPending || updateServerMutation.isPending;

  const [data, setFormData] = useState<ServerForm>(EMPTY_FORM);

  const setData = <K extends keyof ServerForm>(field: K, value: ServerForm[K]) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-GB', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const openCreateForm = () => {
    setEditingServer(null);
    setFormData(EMPTY_FORM);
    setFormError(null);
    setShowForm(true);
  };

  const openEditForm = (server: ServerInfo) => {
    setEditingServer(server);
    setFormData({
      name: server.name,
      description: server.description,
      host: server.host,
      port: server.port,
      skip_ssl_verification: server.skip_ssl_verification,
      access_token: '',
      is_active: server.is_active,
    });
    setFormError(null);
    setShowForm(true);
  };

  const closeForm = () => {
    setShowForm(false);
    setEditingServer(null);
    setFormData(EMPTY_FORM);
    setFormError(null);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    const onSuccess = () => {
      invalidateServers();
      closeForm();
    };

    const onError = (error: unknown) => {
      const errorData = error as { message?: string; error?: string };
      setFormError(errorData.message || errorData.error || 'Unknown error');
    };

    if (editingServer) {
      updateServerMutation.mutate({ id: editingServer.id, data }, { onSuccess, onError });
    } else {
      createServerMutation.mutate({ data }, { onSuccess, onError });
    }
  };

  const confirmDelete = () => {
    if (!deleteConfirm) return;

    deleteServerMutation.mutate(
      { id: deleteConfirm.id },
      {
        onSuccess: () => {
          invalidateServers();
          setDeleteConfirm(null);
        },
        onError: (error) => {
          const errorData = error as { message?: string; error?: string };
          setResultModal({
            title: 'Delete Failed',
            message: `Failed to delete server: ${errorData.message || errorData.error || 'Unknown error'}`,
          });
          setDeleteConfirm(null);
        },
      }
    );
  };

  const handleTestConnection = (server: ServerInfo) => {
    setTestingConnection(server.id);
    testConnectionMutation.mutate(
      { id: server.id },
      {
        onSuccess: () => {
          setResultModal({
            title: 'Connection Successful',
            message: `Connected to ${server.name} (https://${server.host}:${server.port}).`,
          });
          setTestingConnection(null);
        },
        onError: (error) => {
          const errorData = error as { error?: string; details?: string };
          setResultModal({
            title: 'Connection Failed',
            message:
              'Connection failed: ' + (errorData.error || errorData.details || 'Unknown error'),
          });
          setTestingConnection(null);
        },
      }
    );
  };

  const setServerActive = (server: ServerInfo, isActive: boolean) => {
    updateServerMutation.mutate(
      {
        id: server.id,
        data: {
          name: server.name,
          description: server.description,
          host: server.host,
          port: server.port,
          skip_ssl_verification: server.skip_ssl_verification,
          is_active: isActive,
          access_token: '',
        },
      },
      {
        onSuccess: () => {
          invalidateServers();
          setDeactivateConfirm(null);
        },
        onError: (error) => {
          const errorData = error as { message?: string; error?: string };
          setResultModal({
            title: 'Update Failed',
            message: `Failed to update server status: ${errorData.message || errorData.error || 'Unknown error'}`,
          });
          setDeactivateConfirm(null);
        },
      }
    );
  };

  const statusBadge = (server: ServerInfo) => (
    <span
      className={cn(
        theme.badges.tag.base,
        server.is_active ? theme.badges.tag.success : theme.badges.tag.danger
      )}
    >
      {server.is_active ? 'Active' : 'Inactive'}
    </span>
  );

  const sslBadge = (server: ServerInfo) =>
    server.skip_ssl_verification ? (
      <span className={cn(theme.badges.tag.base, theme.badges.tag.warning)}>TLS unverified</span>
    ) : null;

  const hostText = (server: ServerInfo) => `https://${server.host}:${server.port}`;

  const actionButtons = (server: ServerInfo) => (
    <div className="flex flex-wrap justify-end gap-2 lg:flex-nowrap">
      <button
        onClick={() => openEditForm(server)}
        aria-label={`Edit server ${server.name}`}
        className={cn('inline-flex min-h-[44px] items-center text-sm', theme.buttons.secondary)}
      >
        Edit
      </button>
      <button
        onClick={() => handleTestConnection(server)}
        disabled={testingConnection === server.id}
        aria-label={`Test connection to ${server.name}`}
        className={cn(
          'inline-flex min-h-[44px] items-center text-sm disabled:opacity-50',
          theme.buttons.secondary
        )}
      >
        {testingConnection === server.id ? 'Testing...' : 'Test'}
      </button>
      {server.is_active ? (
        <button
          onClick={() => setDeactivateConfirm(server)}
          aria-label={`Deactivate server ${server.name}`}
          className={cn('inline-flex min-h-[44px] items-center text-sm', theme.buttons.secondary)}
        >
          Deactivate
        </button>
      ) : (
        <button
          onClick={() => setServerActive(server, true)}
          disabled={updateServerMutation.isPending}
          aria-label={`Activate server ${server.name}`}
          className={cn(
            'inline-flex min-h-[44px] items-center text-sm disabled:opacity-50',
            theme.buttons.secondary
          )}
        >
          Activate
        </button>
      )}
      <button
        onClick={() => setDeleteConfirm(server)}
        aria-label={`Delete server ${server.name}`}
        className={cn('inline-flex min-h-[44px] items-center text-sm', theme.buttons.danger)}
      >
        Delete
      </button>
    </div>
  );

  if (serversLoading) {
    return <LoadingSpinner size="lg" text="Loading servers..." fullScreen />;
  }

  return (
    <div className="h-full overflow-auto">
      <div className="max-w-7xl mx-auto px-4 py-6 sm:px-6 lg:px-8">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <h1 className={cn('text-2xl font-bold sm:text-3xl', theme.text.strong)}>Servers</h1>
          <button
            type="button"
            onClick={openCreateForm}
            className={cn('inline-flex items-center', theme.buttons.primary)}
          >
            <PlusIcon className="h-5 w-5 mr-2" />
            Add Server
          </button>
        </div>

        <div className={theme.table.panel}>
          <Table<ServerInfo>
            data={servers}
            keyExtractor={(server) => server.id.toString()}
            emptyMessage="No servers configured yet."
            emptyIcon={<ServerStackIcon className={cn('h-12 w-12 mx-auto', theme.text.info)} />}
            columns={[
              {
                key: 'server',
                header: 'Server',
                render: (server) => (
                  <div className="min-w-0">
                    <div className={cn('text-sm font-medium', theme.text.strong)}>
                      {server.name}
                    </div>
                    {server.description && (
                      <div className={cn('text-sm', theme.text.subtle)}>{server.description}</div>
                    )}
                    <div className={cn('text-xs', theme.text.subtle)}>
                      Added {formatDate(server.created_at)}
                    </div>
                  </div>
                ),
              },
              {
                key: 'host',
                header: 'Host',
                render: (server) => (
                  <div className="flex flex-wrap items-center gap-2 lg:flex-nowrap">
                    <span
                      className={cn('whitespace-nowrap text-sm font-mono', theme.text.standard)}
                    >
                      {hostText(server)}
                    </span>
                    {sslBadge(server)}
                  </div>
                ),
              },
              {
                key: 'status',
                header: 'Status',
                render: statusBadge,
              },
              {
                key: 'actions',
                header: '',
                className: 'text-right',
                render: actionButtons,
              },
            ]}
            renderCard={(server) => (
              <div className="space-y-2">
                <div className="flex flex-wrap items-center gap-2">
                  <p className={cn('text-sm font-medium', theme.text.strong)}>{server.name}</p>
                  {statusBadge(server)}
                  {sslBadge(server)}
                </div>
                {server.description && (
                  <p className={cn('text-sm', theme.text.muted)}>{server.description}</p>
                )}
                <p className={cn('text-xs font-mono', theme.text.muted)}>{hostText(server)}</p>
                <p className={cn('text-xs', theme.text.subtle)}>
                  Added {formatDate(server.created_at)}
                </p>
                {actionButtons(server)}
              </div>
            )}
          />
        </div>
      </div>

      <Modal
        isOpen={showForm}
        onClose={closeForm}
        title={editingServer ? `Edit Server: ${editingServer.name}` : 'Add Server'}
        size="lg"
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          {formError && (
            <div
              className={cn(
                'p-4 rounded-md border',
                theme.intent.danger.surface,
                theme.intent.danger.border
              )}
            >
              <p className={cn('text-sm', theme.intent.danger.textStrong)}>{formError}</p>
            </div>
          )}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="server-name" className={theme.forms.label}>
                Name
              </label>
              <input
                type="text"
                id="server-name"
                required
                value={data.name}
                onChange={(e) => setData('name', e.target.value)}
                className={cn('mt-1', theme.forms.input)}
              />
            </div>
            <div>
              <label htmlFor="server-host" className={theme.forms.label}>
                Host
              </label>
              <input
                type="text"
                id="server-host"
                required
                value={data.host}
                onChange={(e) => setData('host', e.target.value)}
                className={cn('mt-1', theme.forms.input)}
              />
            </div>
            <div>
              <label htmlFor="server-port" className={theme.forms.label}>
                Port
              </label>
              <input
                type="number"
                id="server-port"
                required
                value={data.port}
                onChange={(e) => setData('port', parseInt(e.target.value))}
                className={cn('mt-1', theme.forms.input)}
              />
            </div>
            <div className="sm:col-span-2">
              <label htmlFor="server-description" className={theme.forms.label}>
                Description
              </label>
              <textarea
                id="server-description"
                value={data.description}
                onChange={(e) => setData('description', e.target.value)}
                rows={3}
                className={cn('mt-1', theme.forms.textarea)}
              />
            </div>
            <div className="sm:col-span-2">
              <label htmlFor="server-token" className={theme.forms.label}>
                Access Token{' '}
                {editingServer && (
                  <span className={cn('text-sm', theme.text.subtle)}>
                    (leave blank to keep current)
                  </span>
                )}
              </label>
              <input
                type="password"
                id="server-token"
                autoComplete="off"
                required={!editingServer}
                value={data.access_token}
                onChange={(e) => setData('access_token', e.target.value)}
                placeholder={editingServer ? 'Enter new token or leave blank' : ''}
                className={cn('mt-1', theme.forms.input)}
              />
            </div>
            <div className="sm:col-span-2">
              <div className="flex items-center">
                <input
                  type="checkbox"
                  id="server-skip-ssl"
                  checked={data.skip_ssl_verification}
                  onChange={(e) => setData('skip_ssl_verification', e.target.checked)}
                  className={theme.forms.checkbox}
                />
                <label
                  htmlFor="server-skip-ssl"
                  className={cn('ml-2 block text-sm', theme.text.standard)}
                >
                  Skip SSL certificate verification
                </label>
              </div>
              {data.skip_ssl_verification && (
                <p className={cn('mt-2 text-sm', theme.text.warning)}>
                  Connections to this server will not verify its TLS certificate. Only use this for
                  agents with self-signed certificates on a trusted network.
                </p>
              )}
            </div>
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={closeForm} className={theme.buttons.secondary}>
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className={cn(theme.buttons.primary, 'disabled:opacity-50')}
            >
              {saving ? 'Saving...' : editingServer ? 'Update Server' : 'Add Server'}
            </button>
          </div>
        </form>
      </Modal>

      <ConfirmationModal
        isOpen={!!deleteConfirm}
        onClose={() => setDeleteConfirm(null)}
        onConfirm={confirmDelete}
        title="Delete Server"
        message={`Are you sure you want to delete ${deleteConfirm?.name}? This action cannot be undone.`}
        confirmText="Delete"
        variant="danger"
        isLoading={deleteServerMutation.isPending}
      />

      <ConfirmationModal
        isOpen={!!deactivateConfirm}
        onClose={() => setDeactivateConfirm(null)}
        onConfirm={() => deactivateConfirm && setServerActive(deactivateConfirm, false)}
        title="Deactivate Server"
        message={`Deactivate ${deactivateConfirm?.name}? berth will stop using this server and its stacks become unavailable until it is reactivated.`}
        confirmText="Deactivate"
        variant="warning"
        isLoading={updateServerMutation.isPending}
      />

      <Modal
        isOpen={!!resultModal}
        onClose={() => setResultModal(null)}
        title={resultModal?.title ?? ''}
        size="sm"
        footer={
          <div className="flex justify-end">
            <button onClick={() => setResultModal(null)} className={theme.buttons.primary}>
              Close
            </button>
          </div>
        }
      >
        <p className={theme.text.standard}>{resultModal?.message}</p>
      </Modal>
    </div>
  );
}
