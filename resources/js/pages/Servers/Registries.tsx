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
  type RegistryCredential,
} from '../../components/registries';

interface Props {
  title?: string;
  server_id: number;
  server_name: string;
  credentials: RegistryCredential[];
  csrfToken?: string;
}

export default function Registries({
  title = 'Registry Credentials',
  server_id,
  server_name,
  credentials,
  csrfToken,
}: Props) {
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingCredential, setEditingCredential] = useState<RegistryCredential | null>(null);
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
        const response = await fetch(
          `/api/servers/${server_id}/registries/${editingCredential.id}`,
          {
            method: 'PUT',
            headers: {
              'Content-Type': 'application/json',
              'X-CSRF-Token': csrfToken || '',
            },
            credentials: 'include',
            body: JSON.stringify(data),
          }
        );

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || 'Update failed');
        }

        setEditingCredential(null);
        reset();
        router.reload();
      } else {
        const response = await fetch(`/api/servers/${server_id}/registries`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-CSRF-Token': csrfToken || '',
          },
          credentials: 'include',
          body: JSON.stringify(data),
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || 'Creation failed');
        }

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

  const handleEdit = (credential: RegistryCredential) => {
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
      const response = await fetch(`/api/servers/${server_id}/registries/${deleteConfirm.id}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-Token': csrfToken || '',
        },
        credentials: 'include',
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Delete failed');
      }

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
