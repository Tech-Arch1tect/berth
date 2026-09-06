import { useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { cn } from '../../../shared/utils/cn';
import { theme } from '../../../shared/theme';
import { Modal } from '../../../shared/components/Modal';
import {
  usePostApiV1ApiKeys,
  usePostApiV1ApiKeysIdScopes,
  getGetApiV1ApiKeysIdScopesQueryKey,
} from '../../../api/generated/api-keys/api-keys';
import { useGetApiV1Servers } from '../../../api/generated/servers/servers';
import { fieldErrorsFromApiError } from '../../../shared/utils/api-errors';
import type { ServerInfo } from '../../../api/generated/models';
import {
  ApiKeyTemplateSection,
  berthCodeScopePayloads,
  stackPatternError,
  EMPTY_TEMPLATE_STATE,
} from './ApiKeyTemplateSection';
import type { BerthCodeScopePayload, BerthCodeTemplateState } from './ApiKeyTemplateSection';
import { NewKeyResultModal } from './NewKeyResultModal';
import type { CreatedApiKey, ScopeProgress } from './NewKeyResultModal';

interface NewAPIKeyForm {
  name: string;
  expires_at: string;
}

const EMPTY_FORM: NewAPIKeyForm = { name: '', expires_at: '' };

interface CreateApiKeyModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreated?: (key: CreatedApiKey) => void;
  onError?: (message: string) => void;
}

export function CreateApiKeyModal({ isOpen, onClose, onCreated, onError }: CreateApiKeyModalProps) {
  const queryClient = useQueryClient();
  const [formData, setFormData] = useState<NewAPIKeyForm>(EMPTY_FORM);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [templateState, setTemplateState] = useState<BerthCodeTemplateState>(EMPTY_TEMPLATE_STATE);
  const [templateError, setTemplateError] = useState<string | null>(null);
  const [newKeyData, setNewKeyData] = useState<CreatedApiKey | null>(null);
  const [scopeProgress, setScopeProgress] = useState<ScopeProgress | null>(null);
  const pendingTemplateScopes = useRef<BerthCodeScopePayload[]>([]);

  const setData = <K extends keyof NewAPIKeyForm>(field: K, value: NewAPIKeyForm[K]) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };
  const reset = () => {
    setFormData(EMPTY_FORM);
    setErrors({});
    setTemplateState(EMPTY_TEMPLATE_STATE);
    setTemplateError(null);
  };

  const { data: serversResponse } = useGetApiV1Servers({
    query: {
      enabled: isOpen && templateState.kind === 'berth-code',
    },
  });
  const servers: ServerInfo[] = serversResponse?.data?.servers ?? [];

  const addScopeMutation = usePostApiV1ApiKeysIdScopes();

  const applyTemplateScopes = async (keyId: number, payloads: BerthCodeScopePayload[]) => {
    setScopeProgress({ total: payloads.length, applied: 0, failures: [], done: false });
    const failures: BerthCodeScopePayload[] = [];
    let applied = 0;
    await Promise.all(
      payloads.map(async (payload) => {
        try {
          await addScopeMutation.mutateAsync({ id: keyId, data: payload });
          applied += 1;
        } catch {
          failures.push(payload);
        }
      })
    );
    queryClient.invalidateQueries({
      queryKey: getGetApiV1ApiKeysIdScopesQueryKey(keyId),
    });
    setScopeProgress({ total: payloads.length, applied, failures, done: true });
  };

  const createMutation = usePostApiV1ApiKeys({
    mutation: {
      onSuccess: (response) => {
        const payloads = pendingTemplateScopes.current;
        pendingTemplateScopes.current = [];
        const created: CreatedApiKey = {
          id: response.data.api_key.id,
          key: response.data.plain_key,
          name: response.data.api_key.name,
        };
        setNewKeyData(created);
        onClose();
        reset();
        onCreated?.(created);
        if (payloads.length > 0) {
          void applyTemplateScopes(response.data.api_key.id, payloads);
        }
      },
      onError: (error: unknown) => {
        console.error('Failed to create API key:', error);
        setErrors(fieldErrorsFromApiError(error));
        onError?.((error as { message?: string })?.message || 'Failed to create API key');
      },
    },
  });

  const validateTemplate = (): string | null => {
    if (templateState.kind !== 'berth-code') return null;
    const invalid = templateState.stackPatterns.find(
      (pattern) => pattern.length > 0 && stackPatternError(pattern) !== null
    );
    if (invalid !== undefined) {
      return 'Fix the highlighted stack patterns';
    }
    if (!templateState.stackPatterns.some((pattern) => pattern.length > 0)) {
      return 'Add at least one stack pattern';
    }
    if (!templateState.allServers && templateState.serverIds.length === 0) {
      return 'Select at least one server';
    }
    return null;
  };

  const createAPIKey = async (e: React.FormEvent) => {
    e.preventDefault();

    const templateErrorValue = validateTemplate();
    setTemplateError(templateErrorValue);
    if (templateErrorValue) return;

    const payload: { name: string; expires_at?: string } = { name: formData.name };
    if (formData.expires_at) {
      payload.expires_at = new Date(formData.expires_at).toISOString();
    }

    pendingTemplateScopes.current =
      templateState.kind === 'berth-code' ? berthCodeScopePayloads(templateState) : [];

    createMutation.mutate({ data: payload });
  };

  const closeResult = () => {
    setNewKeyData(null);
    setScopeProgress(null);
  };

  return (
    <>
      <NewKeyResultModal
        isOpen={!!newKeyData}
        onClose={closeResult}
        newKeyData={newKeyData}
        scopeProgress={scopeProgress}
        servers={servers}
      />
      <Modal
        isOpen={isOpen}
        onClose={() => {
          onClose();
          reset();
        }}
        title="Create New API Key"
        size="md"
        footer={
          <div className="flex justify-end space-x-3 w-full">
            <button
              type="button"
              onClick={() => {
                onClose();
                reset();
              }}
              className={theme.buttons.secondary}
            >
              Cancel
            </button>
            <button
              type="submit"
              form="create-api-key-form"
              disabled={createMutation.isPending}
              className={cn(theme.buttons.primary, createMutation.isPending && 'opacity-50')}
            >
              Create
            </button>
          </div>
        }
      >
        <form id="create-api-key-form" onSubmit={createAPIKey}>
          <div className="mb-4">
            <label htmlFor="api-key-name" className={cn(theme.forms.label, 'mb-2')}>
              Name
            </label>
            <input
              id="api-key-name"
              type="text"
              value={formData.name}
              onChange={(e) => setData('name', e.target.value)}
              className={cn('w-full', theme.forms.input)}
              placeholder="My API Key"
              required
            />
            {errors.name && <p className={cn('mt-1 text-sm', theme.text.danger)}>{errors.name}</p>}
          </div>
          <div className="mb-4">
            <label htmlFor="api-key-expires-at" className={cn(theme.forms.label, 'mb-2')}>
              Expires At (Optional)
            </label>
            <input
              id="api-key-expires-at"
              type="datetime-local"
              value={formData.expires_at}
              onChange={(e) => setData('expires_at', e.target.value)}
              className={cn('w-full', theme.forms.input)}
            />
            {errors.expires_at && (
              <p className={cn('mt-1 text-sm', theme.text.danger)}>{errors.expires_at}</p>
            )}
          </div>
          <ApiKeyTemplateSection
            state={templateState}
            servers={servers}
            onChange={setTemplateState}
          />
          {templateError && (
            <p className={cn('mb-4 text-sm', theme.text.danger)}>{templateError}</p>
          )}
        </form>
      </Modal>
    </>
  );
}
