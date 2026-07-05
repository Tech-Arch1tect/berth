import { useState } from 'react';
import { useParams } from '@tanstack/react-router';
import { useQueryClient } from '@tanstack/react-query';
import { ServerNavigation } from '../../../shared/layout/ServerNavigation';
import { Breadcrumb } from '../../../shared/components/Breadcrumb';
import { Modal } from '../../../shared/components/Modal';
import { ConfirmationModal } from '../../../shared/components/ConfirmationModal';
import { LoadingSpinner } from '../../../shared/components/LoadingSpinner';
import { theme } from '../../../shared/theme';
import { useDocumentTitle } from '../../../shared/hooks/useDocumentTitle';
import { RegistriesToolbar, RegistriesContent } from '../components';
import { useGetApiV1ServersServerid } from '../../../api/generated/servers/servers';
import {
  useGetApiV1ServersServeridRegistries,
  usePostApiV1ServersServeridRegistries,
  usePutApiV1ServersServeridRegistriesId,
  useDeleteApiV1ServersServeridRegistriesId,
  getGetApiV1ServersServeridRegistriesQueryKey,
} from '../../../api/generated/registries/registries';
import type { RegistryCredentialInfo } from '../../../api/generated/models';

export default function Registries() {
  const params = useParams({ strict: false }) as { serverid?: string };
  const serverid = Number(params.serverid);
  const queryClient = useQueryClient();

  const { data: serverResponse, isLoading: serverLoading } = useGetApiV1ServersServerid(serverid, {
    query: { enabled: Number.isFinite(serverid) && serverid > 0 },
  });
  const server = serverResponse?.data?.server;
  useDocumentTitle(server ? `Registry Credentials - ${server.name}` : 'Registry Credentials');

  const { data: credentialsResponse, isLoading: credentialsLoading } =
    useGetApiV1ServersServeridRegistries(serverid, {
      query: { enabled: Number.isFinite(serverid) && serverid > 0 },
    });
  const credentials = credentialsResponse?.data?.credentials ?? [];

  const invalidateCredentials = () =>
    queryClient.invalidateQueries({
      queryKey: getGetApiV1ServersServeridRegistriesQueryKey(serverid),
    });

  const [showAddForm, setShowAddForm] = useState(false);
  const [editingCredential, setEditingCredential] = useState<RegistryCredentialInfo | null>(null);
  const [processing, setProcessing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<{ id: number; url: string } | null>(null);

  const [data, setFormData] = useState({
    stack_pattern: '*',
    registry_url: '',
    image_pattern: '',
    username: '',
    password: '',
  });

  const createMutation = usePostApiV1ServersServeridRegistries();
  const updateMutation = usePutApiV1ServersServeridRegistriesId();
  const deleteMutation = useDeleteApiV1ServersServeridRegistriesId();

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
        await updateMutation.mutateAsync({
          serverid,
          id: editingCredential.id,
          data: {
            stack_pattern: data.stack_pattern,
            registry_url: data.registry_url,
            image_pattern: data.image_pattern,
            username: data.username,
            password: data.password,
          },
        });

        setEditingCredential(null);
        reset();
        invalidateCredentials();
      } else {
        await createMutation.mutateAsync({
          serverid,
          data: {
            stack_pattern: data.stack_pattern,
            registry_url: data.registry_url,
            image_pattern: data.image_pattern,
            username: data.username,
            password: data.password,
          },
        });

        setShowAddForm(false);
        reset();
        invalidateCredentials();
      }
    } catch (error) {
      console.error('Submit failed:', error);
      setErrorMessage(error instanceof Error ? error.message : 'Failed to save credential');
    } finally {
      setProcessing(false);
    }
  };

  const handleEdit = (credential: RegistryCredentialInfo) => {
    setEditingCredential(credential);
    setShowAddForm(true);
    setFormData({
      stack_pattern: credential.stack_pattern,
      registry_url: credential.registry_url,
      image_pattern: credential.image_pattern || '',
      username: credential.username,
      password: '',
    });
  };

  const handleDeleteClick = (credentialId: number, registryUrl: string) => {
    setDeleteConfirm({ id: credentialId, url: registryUrl });
  };

  const confirmDelete = async () => {
    if (!deleteConfirm) return;

    try {
      await deleteMutation.mutateAsync({
        serverid,
        id: deleteConfirm.id,
      });

      setDeleteConfirm(null);
      invalidateCredentials();
    } catch (error) {
      console.error('Delete failed:', error);
      setErrorMessage(error instanceof Error ? error.message : 'Failed to delete credential');
      setDeleteConfirm(null);
    }
  };

  const handleCancel = () => {
    setShowAddForm(false);
    setEditingCredential(null);
    reset();
  };

  const handleRefresh = () => {
    invalidateCredentials();
  };

  if (serverLoading || credentialsLoading || !server) {
    return <LoadingSpinner size="lg" text="Loading registries..." fullScreen />;
  }

  return (
    <>
      <Breadcrumb
        items={[
          { label: server.name, href: `/servers/${serverid}/stacks` },
          { label: 'Registry Credentials' },
        ]}
      />

      <ServerNavigation serverId={serverid} serverName={server.name} />

      <div className="flex h-full min-h-0 flex-col overflow-hidden">
        <div className="flex-shrink-0 border-b border-zinc-200 dark:border-zinc-800">
          <RegistriesToolbar
            serverName={server.name}
            onAddCredential={() => {
              setEditingCredential(null);
              reset();
              setShowAddForm(true);
            }}
            onRefresh={handleRefresh}
            disableAdd={showAddForm}
          />
        </div>

        <div className="min-h-0 flex-1 overflow-auto bg-white p-4 dark:bg-zinc-900 lg:p-6">
          <div className="mx-auto max-w-4xl">
            <RegistriesContent
              credentials={credentials}
              showForm={showAddForm || editingCredential !== null}
              isEditing={editingCredential !== null}
              processing={processing}
              formData={data}
              onFormDataChange={setData}
              onSubmit={handleSubmit}
              onCancel={handleCancel}
              onEdit={handleEdit}
              onDelete={handleDeleteClick}
              onShowAddForm={() => {
                setEditingCredential(null);
                reset();
                setShowAddForm(true);
              }}
            />
          </div>
        </div>
      </div>

      {/* Error Modal */}
      <Modal
        isOpen={!!errorMessage}
        onClose={() => setErrorMessage(null)}
        title="Error"
        size="sm"
        footer={
          <div className="flex justify-end">
            <button onClick={() => setErrorMessage(null)} className={theme.buttons.primary}>
              Close
            </button>
          </div>
        }
      >
        <p className={theme.text.standard}>{errorMessage}</p>
      </Modal>

      {/* Delete Confirmation Modal */}
      <ConfirmationModal
        isOpen={!!deleteConfirm}
        onClose={() => setDeleteConfirm(null)}
        onConfirm={confirmDelete}
        title="Delete Registry Credential"
        message={`Are you sure you want to delete the credential for ${deleteConfirm?.url}? This action cannot be undone.`}
        confirmText="Delete"
        variant="danger"
      />
    </>
  );
}
