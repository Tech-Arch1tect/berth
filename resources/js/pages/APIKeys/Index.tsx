import FlashMessages from '../../components/FlashMessages';
import { Head, useForm, usePage, router } from '@inertiajs/react';
import { formatDistanceToNow } from 'date-fns';
import { useState, useEffect } from 'react';
import {
  KeyIcon,
  PlusIcon,
  TrashIcon,
  ClipboardDocumentIcon,
  CheckIcon,
  InformationCircleIcon,
  EyeIcon,
  ClockIcon,
  ShieldCheckIcon,
} from '@heroicons/react/24/outline';
import axios from 'axios';
import { cn } from '../../utils/cn';
import { theme } from '../../theme';
import { EmptyState } from '../../components/common/EmptyState';
import { LoadingSpinner } from '../../components/common/LoadingSpinner';
import { Modal } from '../../components/common/Modal';
import { ConfirmationModal } from '../../components/common/ConfirmationModal';

interface APIKey {
  id: number;
  name: string;
  key_prefix: string;
  last_used_at: string | null;
  expires_at: string | null;
  is_active: boolean;
  created_at: string;
  scope_count: number;
}

interface APIKeysProps {
  title: string;
}

interface NewAPIKeyModal {
  name: string;
  expires_at: string;
}

export default function APIKeysIndex({ title }: APIKeysProps) {
  const { props } = usePage();
  const csrfToken = props.csrfToken as string | undefined;
  const [apiKeys, setApiKeys] = useState<APIKey[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newKeyData, setNewKeyData] = useState<{ key: string; name: string } | null>(null);
  const [copiedKey, setCopiedKey] = useState(false);
  const [selectedKeyScopes, setSelectedKeyScopes] = useState<number | null>(null);
  const [keyToRevoke, setKeyToRevoke] = useState<{ id: number; name: string } | null>(null);
  const [isRevoking, setIsRevoking] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const {
    data: formData,
    setData,
    processing,
    errors,
    reset,
  } = useForm<NewAPIKeyModal>({
    name: '',
    expires_at: '',
  });

  const loadAPIKeys = async () => {
    try {
      const response = await axios.get('/api/api-keys');
      if (response.data.success) {
        setApiKeys(response.data.data);
      }
    } catch (error) {
      console.error('Failed to load API keys:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAPIKeys();
  }, []);

  const createAPIKey = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      const payload: any = { name: formData.name };
      if (formData.expires_at) {
        payload.expires_at = new Date(formData.expires_at).toISOString();
      }

      const response = await axios.post('/api/api-keys', payload, {
        headers: {
          'X-CSRF-Token': csrfToken || '',
        },
      });

      if (response.data.success) {
        setNewKeyData({
          key: response.data.data.plain_key,
          name: response.data.data.api_key.name,
        });
        setShowCreateModal(false);
        reset();
        loadAPIKeys();
      }
    } catch (error: any) {
      console.error('Failed to create API key:', error);
      setErrorMessage(error.response?.data?.message || 'Failed to create API key');
    }
  };

  const handleRevokeClick = (id: number, name: string) => {
    setKeyToRevoke({ id, name });
  };

  const confirmRevoke = async () => {
    if (!keyToRevoke) return;

    try {
      setIsRevoking(true);
      await axios.delete(`/api/api-keys/${keyToRevoke.id}`, {
        headers: {
          'X-CSRF-Token': csrfToken || '',
        },
      });
      loadAPIKeys();
      router.reload({ only: ['flash'] });
      setKeyToRevoke(null);
    } catch (error) {
      console.error('Failed to revoke API key:', error);
      setErrorMessage('Failed to revoke API key');
    } finally {
      setIsRevoking(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(true);
    setTimeout(() => setCopiedKey(false), 2000);
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'Never';
    return formatDistanceToNow(new Date(dateString), { addSuffix: true });
  };

  return (
    <>
      <Head title="API Keys" />
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="py-8">
          <div className="flex justify-between items-center mb-8">
            <h1 className={cn('text-3xl font-bold', theme.text.strong)}>API Keys</h1>
            <button
              onClick={() => setShowCreateModal(true)}
              className={cn('inline-flex items-center', theme.buttons.primary)}
            >
              <PlusIcon className="h-5 w-5 mr-2" />
              Create API Key
            </button>
          </div>

          <FlashMessages className="mb-6" />

          {/* New Key Display Modal */}
          <Modal
            isOpen={!!newKeyData}
            onClose={() => setNewKeyData(null)}
            title="API Key Created Successfully"
            subtitle={newKeyData?.name}
            size="lg"
            footer={
              <button onClick={() => setNewKeyData(null)} className={theme.buttons.primary}>
                Done
              </button>
            }
          >
            <div className={cn(theme.intent.warning.surface, 'rounded-lg p-4 mb-4')}>
              <div className="flex">
                <div className="flex-shrink-0">
                  <InformationCircleIcon className={cn('h-5 w-5', theme.intent.warning.icon)} />
                </div>
                <div className="ml-3">
                  <p className={cn('text-sm', theme.intent.warning.textStrong)}>
                    <strong>Important:</strong> Copy this API key now. You won't be able to see it
                    again!
                  </p>
                </div>
              </div>
            </div>
            <div className="mb-4">
              <label className={cn(theme.forms.label, 'mb-2')}>API Key</label>
              <div className="flex items-center space-x-2">
                <input
                  type="text"
                  value={newKeyData?.key || ''}
                  readOnly
                  className={cn(theme.forms.input, theme.surface.code, 'flex-1 font-mono text-sm')}
                />
                <button
                  onClick={() => copyToClipboard(newKeyData?.key || '')}
                  className={cn(theme.buttons.ghost, 'p-3')}
                  title={copiedKey ? 'Copied!' : 'Copy to clipboard'}
                >
                  {copiedKey ? (
                    <CheckIcon className={cn('h-5 w-5', theme.text.success)} />
                  ) : (
                    <ClipboardDocumentIcon className={cn('h-5 w-5', theme.text.muted)} />
                  )}
                </button>
              </div>
            </div>
          </Modal>

          {/* Create Modal */}
          <Modal
            isOpen={showCreateModal}
            onClose={() => {
              setShowCreateModal(false);
              reset();
            }}
            title="Create New API Key"
            size="md"
            footer={
              <div className="flex justify-end space-x-3 w-full">
                <button
                  type="button"
                  onClick={() => {
                    setShowCreateModal(false);
                    reset();
                  }}
                  className={theme.buttons.secondary}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  form="create-api-key-form"
                  disabled={processing}
                  className={cn(theme.buttons.primary, processing && 'opacity-50')}
                >
                  Create
                </button>
              </div>
            }
          >
            <form id="create-api-key-form" onSubmit={createAPIKey}>
              <div className="mb-4">
                <label className={cn(theme.forms.label, 'mb-2')}>Name</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setData('name', e.target.value)}
                  className={cn('w-full', theme.forms.input)}
                  placeholder="My API Key"
                  required
                />
                {errors.name && (
                  <p className={cn('mt-1 text-sm', theme.text.danger)}>{errors.name}</p>
                )}
              </div>
              <div className="mb-4">
                <label className={cn(theme.forms.label, 'mb-2')}>Expires At (Optional)</label>
                <input
                  type="datetime-local"
                  value={formData.expires_at}
                  onChange={(e) => setData('expires_at', e.target.value)}
                  className={cn('w-full', theme.forms.input)}
                />
                {errors.expires_at && (
                  <p className={cn('mt-1 text-sm', theme.text.danger)}>{errors.expires_at}</p>
                )}
              </div>
            </form>
          </Modal>

          {/* API Keys List */}
          {loading ? (
            <LoadingSpinner size="lg" text="Loading API keys..." />
          ) : apiKeys.length === 0 ? (
            <EmptyState
              icon={KeyIcon}
              title="No API keys"
              description="Get started by creating a new API key."
              variant="info"
              action={{
                label: 'Create API Key',
                onClick: () => setShowCreateModal(true),
              }}
            />
          ) : (
            <div className={cn(theme.surface.panel, 'shadow overflow-hidden sm:rounded-md')}>
              <ul className="divide-y divide-slate-200 dark:divide-slate-800">
                {apiKeys.map((apiKey) => (
                  <li key={apiKey.id} className="px-6 py-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-4 flex-1">
                        <div className="flex-shrink-0">
                          <KeyIcon className={cn('h-8 w-8', theme.text.muted)} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center space-x-2 mb-2">
                            <p className={cn('text-sm font-medium', theme.text.strong)}>
                              {apiKey.name}
                            </p>
                            <span className={cn(theme.badges.tag.base, theme.badges.tag.neutral)}>
                              {apiKey.key_prefix}...
                            </span>
                            {apiKey.is_active ? (
                              <span className={cn(theme.badges.tag.base, theme.badges.tag.success)}>
                                Active
                              </span>
                            ) : (
                              <span className={cn(theme.badges.tag.base, theme.badges.tag.danger)}>
                                Inactive
                              </span>
                            )}
                          </div>
                          <div className={cn('mt-1 text-sm space-y-1', theme.text.muted)}>
                            <p className="flex items-center">
                              <ClockIcon className="h-4 w-4 mr-1" />
                              <span className="font-medium">Last used:</span>{' '}
                              {formatDate(apiKey.last_used_at)}
                            </p>
                            <p className="flex items-center">
                              <ShieldCheckIcon className="h-4 w-4 mr-1" />
                              <span className="font-medium">Scopes:</span> {apiKey.scope_count}
                            </p>
                            {apiKey.expires_at && (
                              <p className="flex items-center">
                                <span className="font-medium">Expires:</span>{' '}
                                {formatDate(apiKey.expires_at)}
                              </p>
                            )}
                            <p className="flex items-center">
                              <span className="font-medium">Created:</span>{' '}
                              {formatDate(apiKey.created_at)}
                            </p>
                          </div>
                        </div>
                      </div>

                      <div className="flex-shrink-0 flex space-x-2">
                        <button
                          onClick={() =>
                            router.visit(`/api-keys/${apiKey.id}/scopes`, { preserveState: false })
                          }
                          className={cn(
                            'inline-flex items-center text-sm leading-4',
                            theme.buttons.secondary
                          )}
                        >
                          <EyeIcon className="h-4 w-4 mr-1" />
                          Manage Scopes
                        </button>
                        <button
                          onClick={() => handleRevokeClick(apiKey.id, apiKey.name)}
                          className={cn(
                            'inline-flex items-center text-sm leading-4',
                            theme.buttons.danger
                          )}
                        >
                          <TrashIcon className="h-4 w-4 mr-1" />
                          Revoke
                        </button>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className={cn(theme.intent.info.surface, 'mt-8 rounded-lg p-4')}>
            <div className="flex">
              <div className="flex-shrink-0">
                <InformationCircleIcon className={cn('h-5 w-5', theme.intent.info.icon)} />
              </div>
              <div className="ml-3">
                <p className={cn('text-sm', theme.intent.info.textStrong)}>
                  <strong>Security Note:</strong> API keys provide access to your account. Keep them
                  secure and never share them publicly. Each key's permissions are limited by scopes
                  you assign and cannot exceed your own user permissions.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Revoke Confirmation Modal */}
      <ConfirmationModal
        isOpen={!!keyToRevoke}
        onClose={() => setKeyToRevoke(null)}
        onConfirm={confirmRevoke}
        title="Revoke API Key"
        message={`Are you sure you want to revoke the API key "${keyToRevoke?.name}"?`}
        confirmText="Revoke"
        variant="danger"
        isLoading={isRevoking}
      />

      {/* Error Modal */}
      <Modal
        isOpen={!!errorMessage}
        onClose={() => setErrorMessage(null)}
        title="Error"
        size="sm"
        variant="danger"
        footer={
          <div className="flex justify-end">
            <button onClick={() => setErrorMessage(null)} className={theme.buttons.primary}>
              OK
            </button>
          </div>
        }
      >
        <p className={cn(theme.text.standard)}>{errorMessage}</p>
      </Modal>
    </>
  );
}
