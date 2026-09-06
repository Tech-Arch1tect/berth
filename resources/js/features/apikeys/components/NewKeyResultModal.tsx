import { useNavigate } from '@tanstack/react-router';
import { useState } from 'react';
import {
  CheckIcon,
  ClipboardDocumentIcon,
  EyeIcon,
  InformationCircleIcon,
} from '@heroicons/react/24/outline';
import { cn } from '../../../shared/utils/cn';
import { theme } from '../../../shared/theme';
import { Modal } from '../../../shared/components/Modal';
import type { ServerInfo } from '../../../api/generated/models';

export interface CreatedApiKey {
  id: number;
  key: string;
  name: string;
}

export interface ScopeFailure {
  permission: string;
  stack_pattern: string;
  server_id?: number;
}

export interface ScopeProgress {
  total: number;
  applied: number;
  failures: ScopeFailure[];
  done: boolean;
}

interface NewKeyResultModalProps {
  isOpen: boolean;
  onClose: () => void;
  newKeyData: CreatedApiKey | null;
  scopeProgress: ScopeProgress | null;
  servers: ServerInfo[];
}

export function NewKeyResultModal({
  isOpen,
  onClose,
  newKeyData,
  scopeProgress,
  servers,
}: NewKeyResultModalProps) {
  const navigate = useNavigate();
  const [copiedKey, setCopiedKey] = useState(false);

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(true);
    setTimeout(() => setCopiedKey(false), 2000);
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="API Key Created Successfully"
      subtitle={newKeyData?.name}
      size="lg"
      footer={
        <button onClick={onClose} className={theme.buttons.primary}>
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
              <strong>Important:</strong> Copy this API key now. You won't be able to see it again!
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
            aria-label={copiedKey ? 'Copied' : 'Copy API key to clipboard'}
            className={cn(theme.buttons.ghost, 'p-3')}
          >
            {copiedKey ? (
              <CheckIcon className={cn('h-5 w-5', theme.text.success)} />
            ) : (
              <ClipboardDocumentIcon className={cn('h-5 w-5', theme.text.muted)} />
            )}
          </button>
        </div>
      </div>
      {scopeProgress && (
        <div>
          {!scopeProgress.done ? (
            <p className={cn('text-sm', theme.text.muted)}>
              Applying template scopes: {scopeProgress.applied} of {scopeProgress.total} applied...
            </p>
          ) : scopeProgress.failures.length === 0 ? (
            <p className={cn('text-sm', theme.text.success)}>
              All {scopeProgress.total} template scopes applied.
            </p>
          ) : (
            <div className={cn(theme.intent.warning.surface, 'rounded-lg p-4')}>
              <p className={cn('text-sm', theme.intent.warning.textStrong)}>
                Applied {scopeProgress.applied} of {scopeProgress.total} template scopes. The API
                key was created and stays editable; add the missing scopes from its Scopes page.
              </p>
              <ul className={cn('mt-2 text-sm', theme.intent.warning.textStrong)}>
                {scopeProgress.failures.map((failure) => (
                  <li
                    key={`${failure.permission}-${failure.stack_pattern}-${failure.server_id ?? 'all'}`}
                  >
                    {failure.permission} on{' '}
                    {failure.server_id
                      ? (servers.find((server) => server.id === failure.server_id)?.name ??
                        `server #${failure.server_id}`)
                      : 'all servers'}{' '}
                    (pattern "{failure.stack_pattern}")
                  </li>
                ))}
              </ul>
              <button
                onClick={() =>
                  navigate({
                    to: '/api-keys/$keyid/scopes',
                    params: { keyid: String(newKeyData?.id) },
                  })
                }
                className={cn(
                  'mt-3 inline-flex min-h-[44px] items-center text-sm leading-4',
                  theme.buttons.secondary
                )}
              >
                <EyeIcon className="h-4 w-4 mr-1" />
                Manage Scopes
              </button>
            </div>
          )}
        </div>
      )}
    </Modal>
  );
}
