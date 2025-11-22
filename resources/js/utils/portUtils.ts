import { ComposeService } from '../types/stack';

type PortEntry = {
  public?: number;
  private: number;
  type?: string;
};

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

export const getServicePortBaseline = (
  service: ComposeService
): { ports: string[]; source: 'compose' | 'runtime' | 'none' } => {
  const composePorts =
    service.ports?.map((entry) => entry.trim()).filter((entry) => entry.length > 0) ?? [];

  if (composePorts.length > 0) {
    return { ports: composePorts, source: 'compose' };
  }

  const runtimePorts = derivePortsFromService(service);
  if (runtimePorts.length > 0) {
    return { ports: runtimePorts, source: 'runtime' };
  }

  return { ports: [], source: 'none' };
};
