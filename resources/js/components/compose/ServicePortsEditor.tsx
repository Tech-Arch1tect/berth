import React, { useMemo, useState } from 'react';
import { ComposeService } from '../../types/stack';
import { ArrowLeftIcon, CheckIcon, ExclamationTriangleIcon } from '@heroicons/react/24/outline';
import { cn } from '../../utils/cn';
import { theme } from '../../theme';
import { getServicePortBaseline } from '../../utils/portUtils';

interface ServicePortsEditorProps {
  service: ComposeService;
  pendingPorts?: string[];
  onApply: (serviceName: string, ports: string[]) => void;
  onCancel: () => void;
}

const parsePorts = (value: string) =>
  value
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

const hasWhitespace = (value: string) => /\s/.test(value);

export const ServicePortsEditor: React.FC<ServicePortsEditorProps> = ({
  service,
  pendingPorts,
  onApply,
  onCancel,
}) => {
  const { basePorts, portSource } = useMemo(() => {
    if (pendingPorts) {
      const { source } = getServicePortBaseline(service);
      return { basePorts: pendingPorts, portSource: source };
    }
    const { ports, source } = getServicePortBaseline(service);
    return { basePorts: ports, portSource: source };
  }, [pendingPorts, service]);

  const basePortsKey = basePorts.join('\n');
  const [portText, setPortText] = useState<string>(basePortsKey);
  const [error, setError] = useState<string | null>(null);
  const [prevBasePortsKey, setPrevBasePortsKey] = useState(basePortsKey);

  if (basePortsKey !== prevBasePortsKey) {
    setPrevBasePortsKey(basePortsKey);
    setPortText(basePortsKey);
    setError(null);
  }

  const handlePortTextChange = (event: React.ChangeEvent<HTMLTextAreaElement>) => {
    setPortText(event.target.value);
    setError(null);
  };

  const handleApply = () => {
    const ports = parsePorts(portText);

    for (const entry of ports) {
      if (hasWhitespace(entry)) {
        setError(
          `Port mapping "${entry}" contains whitespace. Use compose syntax like 8080:80 or 80/tcp.`
        );
        return;
      }
    }

    onApply(service.name, ports);
    onCancel();
  };

  return (
    <div className="p-8">
      <div className="max-w-3xl mx-auto">
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
          <h3 className={cn('text-2xl font-bold mb-2', theme.text.strong)}>Edit Ports</h3>
          <p className={theme.text.muted}>
            Service: <span className="font-semibold">{service.name}</span>
          </p>
        </div>

        {portSource === 'runtime' && (
          <div className={cn(theme.intent.warning.surface, 'rounded-lg p-4 mb-6')}>
            <div className="flex">
              <div className="flex-shrink-0">
                <ExclamationTriangleIcon className={cn('h-5 w-5', theme.intent.warning.icon)} />
              </div>
              <div className="ml-3">
                <h3 className={cn('text-sm font-medium', theme.intent.warning.textStrong)}>
                  Editing Runtime-Derived Ports
                </h3>
                <div className={cn('mt-2 text-sm', theme.intent.warning.textMuted)}>
                  <p>
                    These ports are derived from the running container because the compose file
                    doesn't define any ports. Saving will add them to the compose file.
                  </p>
                  <p className="mt-2">
                    <strong>Note:</strong> Host IP bindings (e.g., 127.0.0.1:8080:80) cannot be
                    preserved from runtime data and will be lost.
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        <div className="mb-6">
          <label
            className={cn('block text-sm font-medium mb-2', theme.forms.label)}
            htmlFor="port-mappings"
          >
            Port mappings
          </label>
          <textarea
            id="port-mappings"
            value={portText}
            onChange={handlePortTextChange}
            rows={8}
            placeholder="One mapping per line, e.g. 8080:80 or 127.0.0.1:5432:5432"
            className={cn(
              'w-full px-4 py-3 rounded-lg font-mono transition-shadow',
              theme.forms.input
            )}
          />
          <p className={cn('mt-2 text-sm', theme.text.muted)}>
            Compose accepts mappings like <code className={theme.surface.code}>host:container</code>
            , <code className={theme.surface.code}>container</code>, or{' '}
            <code className={theme.surface.code}>host:container/proto</code>. Avoid spaces. Leaving
            this empty removes the ports section for the service.
          </p>
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
