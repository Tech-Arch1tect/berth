import { TrashIcon } from '@heroicons/react/24/outline';
import { cn } from '../../../shared/utils/cn';
import { theme } from '../../../shared/theme';
import type { ServerInfo } from '../../../api/generated/models';
import {
  PERM_FILES_READ,
  PERM_FILES_WRITE,
  PERM_SERVERS_READ,
  PERM_STACKS_READ,
} from '../../../shared/constants/permissions';

export type TemplateKind = 'none' | 'berth-code';

export interface BerthCodeTemplateState {
  kind: TemplateKind;
  stackPatterns: string[];
  allServers: boolean;
  serverIds: number[];
  fileEditing: boolean;
}

export const EMPTY_TEMPLATE_STATE: BerthCodeTemplateState = {
  kind: 'none',
  stackPatterns: [''],
  allServers: true,
  serverIds: [],
  fileEditing: false,
};

const MAX_STACK_PATTERN_LENGTH = 255;
const STACK_PATTERN_ALLOWED = /^[A-Za-z0-9._*-]+$/;

export function stackPatternError(pattern: string): string | null {
  if (pattern.length === 0) {
    return 'Stack pattern is required';
  }
  if (pattern.length > MAX_STACK_PATTERN_LENGTH) {
    return `Stack pattern must be ${MAX_STACK_PATTERN_LENGTH} characters or fewer`;
  }
  if (!STACK_PATTERN_ALLOWED.test(pattern)) {
    return 'Only letters, numbers, dash, underscore, dot, and asterisk are allowed';
  }
  return null;
}

export interface BerthCodeScopePayload {
  stack_pattern: string;
  permission: string;
  server_id?: number;
}

export function berthCodeScopePayloads(state: BerthCodeTemplateState): BerthCodeScopePayload[] {
  const patterns = state.stackPatterns.filter((pattern) => pattern.length > 0);
  const permissions = state.fileEditing
    ? [PERM_SERVERS_READ, PERM_STACKS_READ, PERM_FILES_READ, PERM_FILES_WRITE]
    : [PERM_SERVERS_READ, PERM_STACKS_READ, PERM_FILES_READ];

  const payloads: BerthCodeScopePayload[] = [];
  for (const permission of permissions) {
    for (const stack_pattern of patterns) {
      if (state.allServers) {
        payloads.push({ stack_pattern, permission });
      } else {
        for (const server_id of state.serverIds) {
          payloads.push({ stack_pattern, permission, server_id });
        }
      }
    }
  }
  return payloads;
}

interface ApiKeyTemplateSectionProps {
  state: BerthCodeTemplateState;
  servers: ServerInfo[];
  onChange: (state: BerthCodeTemplateState) => void;
}

export function ApiKeyTemplateSection({ state, servers, onChange }: ApiKeyTemplateSectionProps) {
  const patch = (update: Partial<BerthCodeTemplateState>) => onChange({ ...state, ...update });

  const setPattern = (index: number, value: string) => {
    patch({
      stackPatterns: state.stackPatterns.map((pattern, i) => (i === index ? value : pattern)),
    });
  };

  const addPattern = () => {
    patch({ stackPatterns: [...state.stackPatterns, ''] });
  };

  const removePattern = (index: number) => {
    patch({ stackPatterns: state.stackPatterns.filter((_, i) => i !== index) });
  };

  const toggleServer = (serverId: number, checked: boolean) => {
    patch({
      serverIds: checked
        ? [...state.serverIds, serverId]
        : state.serverIds.filter((id) => id !== serverId),
    });
  };

  return (
    <>
      <div className="mb-4">
        <label htmlFor="api-key-template" className={cn(theme.forms.label, 'mb-2')}>
          Template
        </label>
        <select
          id="api-key-template"
          value={state.kind}
          onChange={(e) => patch({ kind: e.target.value as TemplateKind })}
          className={cn('w-full', theme.forms.select)}
        >
          <option value="none">None</option>
          <option value="berth-code">Berth Code</option>
        </select>
        {state.kind === 'berth-code' && (
          <p className={cn('mt-1 text-sm', theme.text.muted)}>
            Grants read access to servers, stacks and files for the chosen stacks and servers, one
            scope per permission and pattern.
          </p>
        )}
      </div>

      {state.kind === 'berth-code' && (
        <>
          <div className="mb-4">
            <label htmlFor="api-key-stack-pattern-1" className={cn(theme.forms.label, 'mb-2')}>
              Stack patterns
            </label>
            <div className="space-y-2">
              {state.stackPatterns.map((pattern, index) => {
                const patternId = `api-key-stack-pattern-${index + 1}`;
                const error = pattern.length > 0 ? stackPatternError(pattern) : null;
                return (
                  <div key={index}>
                    <div className="flex items-center space-x-2">
                      <label htmlFor={patternId} className="sr-only">
                        {`Stack pattern ${index + 1}`}
                      </label>
                      <input
                        id={patternId}
                        type="text"
                        value={pattern}
                        onChange={(e) => setPattern(index, e.target.value)}
                        className={cn('flex-1', theme.forms.input)}
                        placeholder="prod-*"
                      />
                      {state.stackPatterns.length > 1 && (
                        <button
                          type="button"
                          onClick={() => removePattern(index)}
                          aria-label={`Remove pattern ${index + 1}`}
                          className={cn(
                            'inline-flex min-h-[44px] items-center text-sm leading-4',
                            theme.buttons.danger
                          )}
                        >
                          <TrashIcon className="h-4 w-4 mr-1" />
                          Remove
                        </button>
                      )}
                    </div>
                    {error && <p className={cn('mt-1 text-sm', theme.text.danger)}>{error}</p>}
                  </div>
                );
              })}
            </div>
            <button
              type="button"
              onClick={addPattern}
              className={cn(
                'mt-2 inline-flex min-h-[44px] items-center text-sm leading-4',
                theme.buttons.secondary
              )}
            >
              Add pattern
            </button>
            <p className={cn('mt-1 text-sm', theme.text.muted)}>
              Each pattern becomes its own scope. Use * for all stacks, or patterns like "prod-*".
            </p>
          </div>

          <fieldset className="mb-4">
            <legend className={cn(theme.forms.label, 'mb-2')}>Servers</legend>
            <div className="space-y-2">
              <label className="flex cursor-pointer items-center space-x-3">
                <input
                  type="radio"
                  name="api-key-template-servers"
                  checked={state.allServers}
                  onChange={() => patch({ allServers: true })}
                  className={theme.forms.checkbox}
                />
                <span className={cn('text-sm font-medium', theme.text.strong)}>All servers</span>
              </label>
              <label className="flex cursor-pointer items-center space-x-3">
                <input
                  type="radio"
                  name="api-key-template-servers"
                  checked={!state.allServers}
                  onChange={() => patch({ allServers: false })}
                  className={theme.forms.checkbox}
                />
                <span className={cn('text-sm font-medium', theme.text.strong)}>
                  Individual servers
                </span>
              </label>
            </div>
            {!state.allServers && (
              <div
                className={cn(
                  'mt-2 max-h-64 space-y-2 overflow-y-auto rounded-md p-3',
                  theme.surface.muted
                )}
              >
                {servers.map((server) => (
                  <label key={server.id} className="flex cursor-pointer items-center space-x-3">
                    <input
                      type="checkbox"
                      checked={state.serverIds.includes(server.id)}
                      onChange={(e) => toggleServer(server.id, e.target.checked)}
                      className={theme.forms.checkbox}
                    />
                    <span className={cn('text-sm', theme.text.strong)}>{server.name}</span>
                  </label>
                ))}
              </div>
            )}
          </fieldset>

          <div className="mb-4">
            <label className="flex cursor-pointer items-center space-x-3">
              <input
                type="checkbox"
                checked={state.fileEditing}
                onChange={(e) => patch({ fileEditing: e.target.checked })}
                className={theme.forms.checkbox}
              />
              <span className={cn('text-sm font-medium', theme.text.strong)}>
                Allow file editing
              </span>
            </label>
            <p className={cn('mt-1 text-xs', theme.text.muted)}>
              Adds files.write; without it the key can only read files.
            </p>
          </div>
        </>
      )}
    </>
  );
}
