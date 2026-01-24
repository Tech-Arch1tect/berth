import { useState } from 'react';
import { Head, router } from '@inertiajs/react';
import FlashMessages from '../../components/FlashMessages';
import { ServerNavigation } from '../../components/layout/ServerNavigation';
import { Breadcrumb } from '../../components/common/Breadcrumb';
import { Modal } from '../../components/common/Modal';
import { ConfirmationModal } from '../../components/common/ConfirmationModal';
import { theme } from '../../theme';
import { PanelLayout } from '../../components/common/PanelLayout';
import {
  RegistriesToolbar,
  RegistriesSidebar,
  RegistriesContent,
  RegistriesStatusBar,
} from '../../components/registries';
import {
  usePostApiV1ServersServeridRegistries,
  usePutApiV1ServersServeridRegistriesId,
  useDeleteApiV1ServersServeridRegistriesId,
} from '../../api/generated/registries/registries';
import type { GetApiV1ServersServeridRegistries200DataCredentialsItem } from '../../api/generated/models';

interface Props {
  title?: string;
  server_id: number;
  server_name: string;
  credentials: GetApiV1ServersServeridRegistries200DataCredentialsItem[];
}

export default function Registries({
  title = 'Registry Credentials',
  server_id,
  server_name,
  credentials,
}: Props) {
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingCredential, setEditingCredential] =
    useState<GetApiV1ServersServeridRegistries200DataCredentialsItem | null>(null);
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
          serverid: server_id,
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
        router.reload();
      } else {
        await createMutation.mutateAsync({
          serverid: server_id,
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
        router.reload();
      }
    } catch (error) {
      console.error('Submit failed:', error);
      setErrorMessage(error instanceof Error ? error.message : 'Failed to save credential');
    } finally {
      setProcessing(false);
    }
  };

  const handleEdit = (credential: GetApiV1ServersServeridRegistries200DataCredentialsItem) => {
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
        serverid: server_id,
        id: deleteConfirm.id,
      });

      setDeleteConfirm(null);
      router.reload();
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
    router.reload();
  };

  return (
    <>
      <Head title={title} />

      {/* Breadcrumb */}
      <Breadcrumb
        items={[
          { label: server_name, href: `/servers/${server_id}/stacks` },
          { label: 'Registry Credentials' },
        ]}
      />

      {/* Server Navigation */}
      <ServerNavigation serverId={server_id} serverName={server_name} />

      <FlashMessages />

      <PanelLayout
        storageKey="registries"
        sidebarTitle="Summary"
        defaultWidth={260}
        maxWidthPercent={35}
        toolbar={
          <RegistriesToolbar
            serverName={server_name}
            onAddCredential={() => {
              setEditingCredential(null);
              reset();
              setShowAddForm(true);
            }}
            onRefresh={handleRefresh}
            disableAdd={showAddForm}
          />
        }
        sidebar={<RegistriesSidebar credentials={credentials} />}
        content={
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
        }
        statusBar={<RegistriesStatusBar credentialCount={credentials.length} />}
      />

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
