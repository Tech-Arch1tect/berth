import React, { useEffect, useState } from 'react';
import { ComposeService } from '../../types/stack';
import {
  ArrowLeftIcon,
  CheckIcon,
  PlusIcon,
  TrashIcon,
  EyeIcon,
  EyeSlashIcon,
} from '@heroicons/react/24/outline';
import { cn } from '../../utils/cn';
import { theme } from '../../theme';
import { useStackEnvironmentVariables } from '../../hooks/useStackEnvironmentVariables';
import { LoadingSpinner } from '../common/LoadingSpinner';

interface ServiceEnvironmentEditorProps {
  service: ComposeService;
  serverId: number;
  stackName: string;
  pendingEnvironment?: Array<{ key: string; value: string; is_sensitive: boolean }>;
  onApply: (
    serviceName: string,
    environment: Array<{ key: string; value: string; is_sensitive: boolean }>
  ) => void;
  onCancel: () => void;
}

interface EnvironmentRow {
  id: string;
  key: string;
  value: string;
  is_sensitive: boolean;
  revealed: boolean;
}

const generateId = () => Math.random().toString(36).substring(2, 9);

export const ServiceEnvironmentEditor: React.FC<ServiceEnvironmentEditorProps> = ({
  service,
  serverId,
  stackName,
  pendingEnvironment,
  onApply,
  onCancel,
}) => {
  const [rows, setRows] = useState<EnvironmentRow[]>([]);
  const [error, setError] = useState<string | null>(null);

  const { data: composeEnvironment, isLoading } = useStackEnvironmentVariables({
    serverid: serverId,
    stackname: stackName,
    unmask: true,
    enabled: !pendingEnvironment,
  });

  useEffect(() => {
    let initialEnv: Array<{ key: string; value: string; is_sensitive: boolean }> = [];

    if (pendingEnvironment) {
      initialEnv = pendingEnvironment;
    } else if (composeEnvironment && composeEnvironment[service.name]) {
      initialEnv = composeEnvironment[service.name]
        .flatMap((env) => env.variables)
        .filter((variable) => variable.source === 'compose');
    }

    const initialRows: EnvironmentRow[] = initialEnv.map((env) => ({
      id: generateId(),
      key: env.key,
      value: env.value,
      is_sensitive: env.is_sensitive,
      revealed: false,
    }));

    if (initialRows.length === 0) {
      initialRows.push({
        id: generateId(),
        key: '',
        value: '',
        is_sensitive: false,
        revealed: false,
      });
    }

    setRows(initialRows);
    setError(null);
  }, [pendingEnvironment, composeEnvironment, service.name]);

  const handleKeyChange = (id: string, newKey: string) => {
    setRows((prev) => prev.map((row) => (row.id === id ? { ...row, key: newKey } : row)));
    setError(null);
  };

  const handleValueChange = (id: string, newValue: string) => {
    setRows((prev) => prev.map((row) => (row.id === id ? { ...row, value: newValue } : row)));
    setError(null);
  };

  const handleToggleReveal = (id: string) => {
    setRows((prev) =>
      prev.map((row) => (row.id === id ? { ...row, revealed: !row.revealed } : row))
    );
  };

  const handleAddRow = () => {
    setRows((prev) => [
      ...prev,
      {
        id: generateId(),
        key: '',
        value: '',
        is_sensitive: false,
        revealed: false,
      },
    ]);
  };

  const handleRemoveRow = (id: string) => {
    setRows((prev) => {
      const filtered = prev.filter((row) => row.id !== id);
      return filtered.length === 0
        ? [
            {
              id: generateId(),
              key: '',
              value: '',
              is_sensitive: false,
              revealed: false,
            },
          ]
        : filtered;
    });
  };

  const handleApply = () => {
    const nonEmptyRows = rows.filter((row) => row.key.trim() !== '');

    const keys = nonEmptyRows.map((row) => row.key.trim());
    const duplicateKeys = keys.filter((key, index) => keys.indexOf(key) !== index);
    if (duplicateKeys.length > 0) {
      setError(`Duplicate environment variable key: ${duplicateKeys[0]}`);
      return;
    }

    for (const row of nonEmptyRows) {
      if (/[\s\t\n\r=]/.test(row.key)) {
        setError(
          `Environment variable key "${row.key}" contains invalid characters (space, tab, newline, or equals)`
        );
        return;
      }
    }

    const environment = nonEmptyRows.map((row) => ({
      key: row.key.trim(),
      value: row.value,
      is_sensitive: row.is_sensitive,
    }));

    onApply(service.name, environment);
    onCancel();
  };

  if (isLoading) {
    return (
      <div className="p-8">
        <div className="max-w-4xl mx-auto">
          <button
            onClick={onCancel}
            className={cn(
              'flex items-center gap-2 transition-colors mb-6',
              theme.text.muted,
              'hover:' + theme.text.strong
            )}
          >
            <ArrowLeftIcon className="h-5 w-5" />
            Back
          </button>
          <div className="flex items-center justify-center py-12">
            <LoadingSpinner size="lg" text="Loading environment variables..." />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-8">
      <div className="max-w-4xl mx-auto">
        <button
          onClick={onCancel}
          className={cn(
            'flex items-center gap-2 transition-colors mb-6',
            theme.text.muted,
            'hover:' + theme.text.strong
          )}
        >
          <ArrowLeftIcon className="h-5 w-5" />
          Back
        </button>

        <div className="mb-8">
          <h3 className={cn('text-2xl font-bold mb-2', theme.text.strong)}>
            Edit Environment Variables
          </h3>
          <p className={theme.text.muted}>
            Service: <span className="font-semibold">{service.name}</span>
          </p>
        </div>

        <div className="mb-6">
          <div className="space-y-3">
            {rows.map((row, index) => (
              <div key={row.id} className={cn(theme.surface.soft, 'rounded-lg p-4')}>
                <div className="flex gap-3">
                  <div className="flex-1">
                    <label
                      className={cn('block text-xs font-medium mb-1.5', theme.forms.label)}
                      htmlFor={`key-${row.id}`}
                    >
                      Key
                    </label>
                    <input
                      id={`key-${row.id}`}
                      type="text"
                      value={row.key}
                      onChange={(e) => handleKeyChange(row.id, e.target.value)}
                      placeholder="VARIABLE_NAME"
                      className={cn(
                        'w-full px-3 py-2 rounded-lg font-mono text-sm transition-shadow',
                        theme.forms.input
                      )}
                    />
                  </div>

                  <div className="flex-1">
                    <label
                      className={cn('block text-xs font-medium mb-1.5', theme.forms.label)}
                      htmlFor={`value-${row.id}`}
                    >
                      Value
                      {row.is_sensitive && (
                        <span
                          className={cn('ml-2', theme.badges.tag.base, theme.badges.tag.warning)}
                        >
                          Sensitive
                        </span>
                      )}
                    </label>
                    <div className="flex gap-2">
                      <input
                        id={`value-${row.id}`}
                        type={row.is_sensitive && !row.revealed ? 'password' : 'text'}
                        value={row.value}
                        onChange={(e) => handleValueChange(row.id, e.target.value)}
                        placeholder="value"
                        className={cn(
                          'flex-1 px-3 py-2 rounded-lg font-mono text-sm transition-shadow',
                          theme.forms.input
                        )}
                      />
                      {row.is_sensitive && (
                        <button
                          type="button"
                          onClick={() => handleToggleReveal(row.id)}
                          className={cn(
                            'px-3 py-2 rounded-lg transition-colors',
                            theme.buttons.secondary
                          )}
                          title={row.revealed ? 'Hide value' : 'Reveal value'}
                        >
                          {row.revealed ? (
                            <EyeSlashIcon className="h-4 w-4" />
                          ) : (
                            <EyeIcon className="h-4 w-4" />
                          )}
                        </button>
                      )}
                    </div>
                  </div>

                  <div className="flex items-end">
                    <button
                      onClick={() => handleRemoveRow(row.id)}
                      className={cn(
                        'p-2.5 rounded-lg transition-colors',
                        theme.text.muted,
                        'hover:' + theme.text.danger,
                        'hover:bg-red-500/10'
                      )}
                      title="Remove variable"
                    >
                      <TrashIcon className="h-5 w-5" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <button
            onClick={handleAddRow}
            className={cn(
              'mt-4 flex items-center gap-2 px-4 py-2 rounded-lg transition-colors',
              theme.buttons.secondary
            )}
          >
            <PlusIcon className="h-5 w-5" />
            Add Variable
          </button>

          <div className={cn('mt-4 text-sm', theme.text.muted)}>
            <p>
              Environment variables are defined as KEY=VALUE pairs. Keys are automatically detected
              as sensitive if they contain keywords like PASSWORD, SECRET, TOKEN, etc.
            </p>
            <p className="mt-2">
              Leave all keys empty to remove the environment section from the service.
            </p>
          </div>

          {error && <p className={cn('mt-3 text-sm', theme.text.danger)}>{error}</p>}
        </div>

        <div className="flex items-center justify-end gap-3">
          <button onClick={onCancel} className={theme.buttons.secondary}>
            Cancel
          </button>
          <button
            onClick={handleApply}
            className={cn('inline-flex items-center gap-2 px-6 py-2.5', theme.brand.composeButton)}
          >
            <CheckIcon className="h-5 w-5" />
            Apply Changes
          </button>
        </div>
      </div>
    </div>
  );
};
