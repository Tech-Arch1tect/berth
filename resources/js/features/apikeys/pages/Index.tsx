import { useNavigate } from '@tanstack/react-router';
import { formatDistanceToNow } from 'date-fns';
import { useState } from 'react';
import { useDocumentTitle } from '../../../shared/hooks/useDocumentTitle';
import {
  KeyIcon,
  PlusIcon,
  TrashIcon,
  InformationCircleIcon,
  EyeIcon,
} from '@heroicons/react/24/outline';
import { cn } from '../../../shared/utils/cn';
import { theme } from '../../../shared/theme';
import { EmptyState } from '../../../shared/components/EmptyState';
import { LoadingSpinner } from '../../../shared/components/LoadingSpinner';
import { Modal } from '../../../shared/components/Modal';
import { ConfirmationModal } from '../../../shared/components/ConfirmationModal';
import {
  useGetApiV1ApiKeys,
  useDeleteApiV1ApiKeysId,
  getGetApiV1ApiKeysQueryKey,
} from '../../../api/generated/api-keys/api-keys';
import { useQueryClient } from '@tanstack/react-query';
import type { APIKeyInfo } from '../../../api/generated/models';
import { CreateApiKeyModal } from '../components/CreateApiKeyModal';

export default function APIKeysIndex() {
  useDocumentTitle('API Keys');
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [keyToRevoke, setKeyToRevoke] = useState<{ id: number; name: string } | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const { data: apiKeysResponse, isLoading: loading } = useGetApiV1ApiKeys();
  const apiKeys = apiKeysResponse?.data ?? [];

  const revokeMutation = useDeleteApiV1ApiKeysId({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetApiV1ApiKeysQueryKey() });
        setKeyToRevoke(null);
      },
      onError: (error) => {
        console.error('Failed to revoke API key:', error);
        setErrorMessage('Failed to revoke API key');
      },
    },
  });

  const handleRevokeClick = (id: number, name: string) => {
    setKeyToRevoke({ id, name });
  };

  const confirmRevoke = async () => {
    if (!keyToRevoke) return;
    revokeMutation.mutate({ id: keyToRevoke.id });
  };

  const formatDate = (dateString: string | null | undefined) => {
    if (!dateString) return 'Never';
    return formatDistanceToNow(new Date(dateString), { addSuffix: true });
  };

  return (
    <>
      <div className="h-full overflow-auto">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="py-8">
            <div className="mb-8 flex flex-wrap items-center justify-between gap-3">
              <h1 className={cn('text-3xl font-bold', theme.text.strong)}>API Keys</h1>
              <button
                onClick={() => setShowCreateModal(true)}
                className={cn('inline-flex items-center', theme.buttons.primary)}
              >
                <PlusIcon className="h-5 w-5 mr-2" />
                Create API Key
              </button>
            </div>

            <CreateApiKeyModal
              isOpen={showCreateModal}
              onClose={() => setShowCreateModal(false)}
              onCreated={() => {
                queryClient.invalidateQueries({ queryKey: getGetApiV1ApiKeysQueryKey() });
              }}
              onError={setErrorMessage}
            />

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
                  {apiKeys.map((apiKey: APIKeyInfo) => (
                    <li key={apiKey.id} className="px-4 py-4 sm:px-6">
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                        <div className="flex min-w-0 items-start gap-4">
                          <div className="flex-shrink-0">
                            <KeyIcon className={cn('h-8 w-8', theme.text.muted)} />
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="mb-1.5 flex flex-wrap items-center gap-2">
                              <p className={cn('text-sm font-medium', theme.text.strong)}>
                                {apiKey.name}
                              </p>
                              <span
                                className={cn(
                                  theme.badges.tag.base,
                                  theme.badges.tag.neutral,
                                  'font-mono'
                                )}
                              >
                                {apiKey.key_prefix}...
                              </span>
                              {apiKey.is_active ? (
                                <span
                                  className={cn(theme.badges.tag.base, theme.badges.tag.success)}
                                >
                                  Active
                                </span>
                              ) : (
                                <span
                                  className={cn(theme.badges.tag.base, theme.badges.tag.danger)}
                                >
                                  Inactive
                                </span>
                              )}
                            </div>
                            <p className={cn('text-sm', theme.text.muted)}>
                              Last used {formatDate(apiKey.last_used_at)} · {apiKey.scope_count}{' '}
                              scope{apiKey.scope_count !== 1 ? 's' : ''}
                            </p>
                            <p className={cn('mt-0.5 text-xs', theme.text.subtle)}>
                              Created {formatDate(apiKey.created_at)}
                              {apiKey.expires_at && <> · Expires {formatDate(apiKey.expires_at)}</>}
                            </p>
                          </div>
                        </div>

                        <div className="flex flex-shrink-0 gap-2 self-end sm:self-auto">
                          <button
                            onClick={() =>
                              navigate({
                                to: '/api-keys/$keyid/scopes',
                                params: { keyid: String(apiKey.id) },
                              })
                            }
                            className={cn(
                              'inline-flex min-h-[44px] items-center text-sm leading-4',
                              theme.buttons.secondary
                            )}
                          >
                            <EyeIcon className="h-4 w-4 mr-1" />
                            Manage Scopes
                          </button>
                          <button
                            onClick={() => handleRevokeClick(apiKey.id, apiKey.name)}
                            className={cn(
                              'inline-flex min-h-[44px] items-center text-sm leading-4',
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
                    <strong>Security Note:</strong> API keys provide access to your account. Keep
                    them secure and never share them publicly. Each key's permissions are limited by
                    scopes you assign and cannot exceed your own user permissions.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <ConfirmationModal
        isOpen={!!keyToRevoke}
        onClose={() => setKeyToRevoke(null)}
        onConfirm={confirmRevoke}
        title="Revoke API Key"
        message={`Are you sure you want to revoke the API key "${keyToRevoke?.name}"?`}
        confirmText="Revoke"
        variant="danger"
        isLoading={revokeMutation.isPending}
      />

      <Modal
        isOpen={!!errorMessage}
        onClose={() => setErrorMessage(null)}
        title="Error"
        size="sm"
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
