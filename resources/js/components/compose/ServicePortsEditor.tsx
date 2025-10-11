import React, { useEffect, useMemo, useState } from 'react';
import { ComposeService } from '../../types/stack';
import { ArrowLeftIcon, CheckIcon } from '@heroicons/react/24/outline';
import { cn } from '../../utils/cn';
import { theme } from '../../theme';

type PortEntry = {
  public?: number;
  private: number;
  type?: string;
};

interface ServicePortsEditorProps {
  service: ComposeService;
  pendingPorts?: string[];
  onApply: (serviceName: string, ports: string[]) => void;
  onCancel: () => void;
}

export const derivePortsFromService = (service: ComposeService): string[] => {
  const firstContainer = service.containers?.[0];
  if (!firstContainer || !firstContainer.ports) {
    return [];
  }

  const seen = new Set<string>();
  const mappings: string[] = [];

  firstContainer.ports.forEach((port: PortEntry) => {
    if (!port || typeof port.private !== 'number') {
      return;
    }

    const protocol =
      port.type && port.type.toLowerCase() !== 'tcp' ? `/${port.type.toLowerCase()}` : '';
    const hasPublishedPort = typeof port.public === 'number' && port.public > 0;
    const base = hasPublishedPort ? `${port.public}:${port.private}` : `${port.private}`;
    const mapping = `${base}${protocol}`;

    if (!seen.has(mapping)) {
      seen.add(mapping);
      mappings.push(mapping);
    }
  });

  return mappings;
};

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
  const basePorts = useMemo(() => {
    if (pendingPorts) {
      return pendingPorts;
    }
    if (service.ports && service.ports.length > 0) {
      return service.ports;
    }
    return derivePortsFromService(service);
  }, [pendingPorts, service]);
  const [portText, setPortText] = useState<string>(basePorts.join('\n'));
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setPortText(basePorts.join('\n'));
    setError(null);
  }, [basePorts]);

  useEffect(() => {
    setError(null);
  }, [portText]);

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
            onChange={(event) => setPortText(event.target.value)}
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
