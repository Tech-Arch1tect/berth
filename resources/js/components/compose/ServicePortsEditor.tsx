import React, { useEffect, useMemo, useState } from 'react';
import { ComposeService } from '../../types/stack';
import { ArrowLeftIcon, CheckIcon } from '@heroicons/react/24/outline';

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
          className="flex items-center gap-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors mb-6"
        >
          <ArrowLeftIcon className="h-5 w-5" />
          Back
        </button>

        <div className="mb-8">
          <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">Edit Ports</h3>
          <p className="text-gray-600 dark:text-gray-400">
            Service: <span className="font-semibold">{service.name}</span>
          </p>
        </div>

        <div className="mb-6">
          <label
            className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
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
            className="w-full px-4 py-3 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white font-mono focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-shadow"
          />
          <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
            Compose accepts mappings like <code>host:container</code>, <code>container</code>, or{' '}
            <code>host:container/proto</code>. Avoid spaces. Leaving this empty removes the ports
            section for the service.
          </p>
          {error && <p className="mt-3 text-sm text-red-600 dark:text-red-400">{error}</p>}
        </div>

        <div className="flex items-center justify-end gap-3">
          <button
            onClick={onCancel}
            className="px-6 py-2.5 text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleApply}
            className="inline-flex items-center gap-2 px-6 py-2.5 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-lg hover:from-indigo-700 hover:to-purple-700 transition-all shadow-md hover:shadow-lg"
          >
            <CheckIcon className="h-5 w-5" />
            Apply Changes
          </button>
        </div>
      </div>
    </div>
  );
};
