import type {
  ComposePort,
  ComposeVolumeMount,
  ComposeDependsOn,
  ComposeBuild,
  ComposeHealthcheck,
  ComposeDeploy,
  ComposeServiceConfig,
  ComposeConfig,
  ComposeNetworkConfig,
  ComposeVolumeConfig,
  ComposeSecretConfig,
  ComposeConfigConfig,
} from '../types/compose';

function splitByColonRespectingVars(str: string): string[] {
  const parts: string[] = [];
  let current = '';
  let braceDepth = 0;

  for (let i = 0; i < str.length; i++) {
    const char = str[i];

    if (char === '$' && str[i + 1] === '{') {
      braceDepth++;
      current += char;
    } else if (char === '}' && braceDepth > 0) {
      braceDepth--;
      current += char;
    } else if (char === ':' && braceDepth === 0) {
      parts.push(current);
      current = '';
    } else {
      current += char;
    }
  }

  if (current) {
    parts.push(current);
  }

  return parts;
}

export function normalisePort(port: unknown): ComposePort {
  if (typeof port === 'object' && port !== null) {
    const p = port as Record<string, unknown>;
    return {
      mode: String(p.mode || ''),
      protocol: String(p.protocol || 'tcp'),
      published: String(p.published ?? ''),
      target: String(p.target ?? ''),
      host_ip: p.host_ip ? String(p.host_ip) : undefined,
    };
  }

  if (typeof port === 'string') {
    const portStr = port.trim();

    let protocol = 'tcp';
    let mainPart = portStr;
    const protocolMatch = portStr.match(/^(.+)\/(tcp|udp)$/);
    if (protocolMatch) {
      mainPart = protocolMatch[1];
      protocol = protocolMatch[2];
    }

    const parts = splitByColonRespectingVars(mainPart);

    if (parts.length === 2) {
      return {
        mode: '',
        protocol,
        published: parts[0],
        target: parts[1],
        rawValue: portStr,
      };
    } else if (parts.length === 3) {
      return {
        mode: '',
        protocol,
        published: parts[1],
        target: parts[2],
        host_ip: parts[0],
        rawValue: portStr,
      };
    } else if (parts.length === 1) {
      return {
        mode: '',
        protocol,
        published: '',
        target: parts[0],
        rawValue: portStr,
      };
    }

    return {
      mode: '',
      protocol: 'tcp',
      published: '',
      target: '',
      rawValue: portStr,
    };
  }

  if (typeof port === 'number') {
    return {
      mode: '',
      protocol: 'tcp',
      published: '',
      target: String(port),
    };
  }

  console.warn('Unknown port format:', port);
  return {
    mode: '',
    protocol: 'tcp',
    published: '',
    target: '',
  };
}

export function normalisePorts(ports: unknown): ComposePort[] {
  if (!ports) return [];
  if (!Array.isArray(ports)) return [];
  return ports.map(normalisePort);
}

export function normaliseVolume(volume: unknown): ComposeVolumeMount {
  if (typeof volume === 'object' && volume !== null) {
    const v = volume as Record<string, unknown>;
    return {
      type: String(v.type || 'bind'),
      source: String(v.source || ''),
      target: String(v.target || ''),
      read_only: Boolean(v.read_only),
      bind: v.bind as Record<string, unknown> | undefined,
      volume: v.volume as Record<string, unknown> | undefined,
      tmpfs: v.tmpfs as Record<string, unknown> | undefined,
    };
  }

  if (typeof volume === 'string') {
    const volumeStr = volume.trim();
    const parts = splitByColonRespectingVars(volumeStr);

    if (parts.length >= 2) {
      const source = parts[0];
      const target = parts[1];
      const options = parts.slice(2).join(':');

      const isBindMount =
        source.startsWith('/') ||
        source.startsWith('.') ||
        source.startsWith('~') ||
        source.includes('${');
      const type = isBindMount ? 'bind' : 'volume';

      const readOnly = options.includes('ro');

      return {
        type,
        source,
        target,
        read_only: readOnly,
        rawValue: volumeStr,
      };
    }

    return {
      type: 'bind',
      source: volumeStr,
      target: '',
      read_only: false,
      rawValue: volumeStr,
    };
  }

  console.warn('Unknown volume format:', volume);
  return {
    type: 'bind',
    source: '',
    target: '',
    read_only: false,
  };
}

export function normaliseVolumes(volumes: unknown): ComposeVolumeMount[] {
  if (!volumes) return [];
  if (!Array.isArray(volumes)) return [];
  return volumes.map(normaliseVolume);
}

export function normaliseEnvironment(env: unknown): Record<string, string> {
  if (!env) return {};

  if (typeof env === 'object' && !Array.isArray(env)) {
    const result: Record<string, string> = {};
    for (const [key, value] of Object.entries(env as Record<string, unknown>)) {
      result[key] = value !== null && value !== undefined ? String(value) : '';
    }
    return result;
  }

  if (Array.isArray(env)) {
    const result: Record<string, string> = {};
    for (const entry of env) {
      if (typeof entry === 'string') {
        const eqIndex = entry.indexOf('=');
        if (eqIndex > 0) {
          const key = entry.substring(0, eqIndex);
          const value = entry.substring(eqIndex + 1);
          result[key] = value;
        } else {
          result[entry] = '';
        }
      }
    }
    return result;
  }

  return {};
}

export function normaliseDependsOn(deps: unknown): Record<string, ComposeDependsOn> {
  if (!deps) return {};

  if (Array.isArray(deps)) {
    const result: Record<string, ComposeDependsOn> = {};
    for (const dep of deps) {
      if (typeof dep === 'string') {
        result[dep] = { condition: 'service_started' };
      }
    }
    return result;
  }

  if (typeof deps === 'object') {
    const result: Record<string, ComposeDependsOn> = {};
    for (const [name, config] of Object.entries(deps as Record<string, unknown>)) {
      if (typeof config === 'object' && config !== null) {
        const c = config as Record<string, unknown>;
        result[name] = {
          condition: String(c.condition || 'service_started'),
          required: c.required !== undefined ? Boolean(c.required) : undefined,
          restart: c.restart !== undefined ? Boolean(c.restart) : undefined,
        };
      } else {
        result[name] = { condition: 'service_started' };
      }
    }
    return result;
  }

  return {};
}

export function normaliseLabels(labels: unknown): Record<string, string> {
  return normaliseEnvironment(labels);
}

export function normaliseCommand(command: unknown): string[] | null {
  if (command === null || command === undefined) return null;

  if (Array.isArray(command)) {
    return command.map((c) => String(c));
  }

  if (typeof command === 'string') {
    return [command];
  }

  return null;
}

export function normaliseEnvFile(envFile: unknown): string[] {
  if (!envFile) return [];

  if (typeof envFile === 'string') {
    return [envFile];
  }

  if (Array.isArray(envFile)) {
    return envFile.map((f) => String(f));
  }

  return [];
}

export function isRawPortString(port: unknown): port is string {
  return typeof port === 'string';
}

export function isRawVolumeString(volume: unknown): volume is string {
  return typeof volume === 'string';
}

export function isEnvironmentArray(env: unknown): env is string[] {
  return Array.isArray(env) && (env.length === 0 || typeof env[0] === 'string');
}

export function hasEnvVars(value: string | undefined): boolean {
  return value?.includes('${') ?? false;
}

export function isDependsOnArray(deps: unknown): deps is string[] {
  return Array.isArray(deps) && (deps.length === 0 || typeof deps[0] === 'string');
}

export function normaliseServiceConfig(service: unknown): ComposeServiceConfig {
  if (!service || typeof service !== 'object') {
    return {};
  }

  const s = service as Record<string, unknown>;

  return {
    image: s.image ? String(s.image) : undefined,
    build: s.build as ComposeBuild | undefined,
    command: normaliseCommand(s.command),
    entrypoint: normaliseCommand(s.entrypoint),
    ports: normalisePorts(s.ports),
    volumes: normaliseVolumes(s.volumes),
    environment: normaliseEnvironment(s.environment),
    env_file: normaliseEnvFile(s.env_file),
    depends_on: normaliseDependsOn(s.depends_on),
    healthcheck: s.healthcheck as ComposeHealthcheck | undefined,
    deploy: s.deploy as ComposeDeploy | undefined,
    networks: s.networks as
      | Record<string, { aliases?: string[]; ipv4_address?: string } | null>
      | undefined,
    labels: normaliseLabels(s.labels),
    restart: s.restart ? String(s.restart) : undefined,
    working_dir: s.working_dir ? String(s.working_dir) : undefined,
    user: s.user ? String(s.user) : undefined,
    privileged: s.privileged ? Boolean(s.privileged) : undefined,
    cap_add: Array.isArray(s.cap_add) ? s.cap_add.map(String) : undefined,
    cap_drop: Array.isArray(s.cap_drop) ? s.cap_drop.map(String) : undefined,
    devices: Array.isArray(s.devices) ? s.devices.map(String) : undefined,
    dns: Array.isArray(s.dns) ? s.dns.map(String) : undefined,
    extra_hosts: Array.isArray(s.extra_hosts) ? s.extra_hosts.map(String) : undefined,
    logging: s.logging as { driver?: string; options?: Record<string, string> } | undefined,
  };
}

export function normaliseComposeConfig(config: unknown): ComposeConfig {
  if (!config || typeof config !== 'object') {
    return {
      compose_file: '',
      services: {},
    };
  }

  const c = config as Record<string, unknown>;

  const normalisedServices: Record<string, ComposeServiceConfig> = {};
  if (c.services && typeof c.services === 'object') {
    for (const [name, service] of Object.entries(c.services as Record<string, unknown>)) {
      normalisedServices[name] = normaliseServiceConfig(service);
    }
  }

  return {
    compose_file: c.compose_file ? String(c.compose_file) : '',
    services: normalisedServices,
    networks: c.networks as Record<string, ComposeNetworkConfig> | undefined,
    volumes: c.volumes as Record<string, ComposeVolumeConfig> | undefined,
    secrets: c.secrets as Record<string, ComposeSecretConfig> | undefined,
    configs: c.configs as Record<string, ComposeConfigConfig> | undefined,
  };
}
