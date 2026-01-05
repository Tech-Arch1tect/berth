export interface ComposePort {
  mode: string;
  protocol: string;
  published: string;
  target: number;
}

export interface ComposeVolumeMount {
  type: string;
  source: string;
  target: string;
  read_only?: boolean;
  bind?: Record<string, unknown>;
  volume?: Record<string, unknown>;
  tmpfs?: Record<string, unknown>;
}

export interface ComposeHealthcheck {
  test?: string[];
  interval?: string;
  timeout?: string;
  retries?: number;
  start_period?: string;
  start_interval?: string;
  disable?: boolean;
}

export interface ComposeDependsOn {
  condition: string;
  required?: boolean;
  restart?: boolean;
}

export interface ComposeDeploy {
  mode?: string;
  replicas?: number;
  resources?: {
    limits?: { cpus?: string; memory?: string };
    reservations?: { cpus?: string; memory?: string };
  };
  restart_policy?: {
    condition?: string;
    delay?: string;
    max_attempts?: number;
    window?: string;
  };
  placement?: {
    constraints?: string[];
    preferences?: Array<{ spread: string }>;
  };
}

export interface ComposeBuild {
  context?: string;
  dockerfile?: string;
  args?: Record<string, string>;
  target?: string;
  cache_from?: string[];
  labels?: Record<string, string>;
}

export interface ComposeServiceConfig {
  image?: string;
  build?: ComposeBuild;
  command?: string[] | null;
  entrypoint?: string[] | null;
  ports?: ComposePort[];
  volumes?: ComposeVolumeMount[];
  environment?: Record<string, string>;
  env_file?: string[];
  depends_on?: Record<string, ComposeDependsOn>;
  healthcheck?: ComposeHealthcheck;
  deploy?: ComposeDeploy;
  networks?: Record<string, { aliases?: string[]; ipv4_address?: string } | null>;
  labels?: Record<string, string>;
  restart?: string;
  working_dir?: string;
  user?: string;
  privileged?: boolean;
  cap_add?: string[];
  cap_drop?: string[];
  devices?: string[];
  dns?: string[];
  extra_hosts?: string[];
  logging?: { driver?: string; options?: Record<string, string> };
}

export interface ComposeNetworkConfig {
  name?: string;
  driver?: string;
  driver_opts?: Record<string, string>;
  external?: boolean;
  ipam?: {
    driver?: string;
    config?: Array<{ subnet?: string; gateway?: string; ip_range?: string }>;
  };
  labels?: Record<string, string>;
}

export interface ComposeVolumeConfig {
  name?: string;
  driver?: string;
  driver_opts?: Record<string, string>;
  external?: boolean;
  labels?: Record<string, string>;
}

export interface ComposeSecretConfig {
  file?: string;
  environment?: string;
  external?: boolean;
  name?: string;
}

export interface ComposeConfigConfig {
  file?: string;
  environment?: string;
  external?: boolean;
  name?: string;
}

export interface ComposeConfig {
  compose_file: string;
  services: Record<string, ComposeServiceConfig>;
  networks?: Record<string, ComposeNetworkConfig>;
  volumes?: Record<string, ComposeVolumeConfig>;
  secrets?: Record<string, ComposeSecretConfig>;
  configs?: Record<string, ComposeConfigConfig>;
}

export interface PortMappingChange {
  target: number;
  published?: string;
  host_ip?: string;
  protocol?: string;
}

export interface VolumeMountChange {
  type: string;
  source: string;
  target: string;
  read_only?: boolean;
}

export interface HealthcheckChange {
  test?: string[];
  interval?: string;
  timeout?: string;
  retries?: number;
  start_period?: string;
  start_interval?: string;
  disable?: boolean;
}

export interface DependsOnChange {
  condition?: string;
  restart?: boolean;
  required?: boolean;
}

export interface UpdateRollbackConfig {
  parallelism?: number;
  delay?: string;
  failure_action?: string;
  monitor?: string;
  max_failure_ratio?: number;
  order?: string;
}

export interface DeployChange {
  mode?: string;
  replicas?: number;
  resources?: {
    limits?: { cpus?: string; memory?: string };
    reservations?: { cpus?: string; memory?: string };
  };
  restart_policy?: {
    condition?: string;
    delay?: string;
    max_attempts?: number;
    window?: string;
  };
  placement?: {
    constraints?: string[];
    preferences?: { spread: string }[];
  };
  update_config?: UpdateRollbackConfig;
  rollback_config?: UpdateRollbackConfig;
}

export interface BuildChange {
  context?: string;
  dockerfile?: string;
  args?: Record<string, string>;
  target?: string;
  cache_from?: string[];
  cache_to?: string[];
  platforms?: string[];
}

export interface ServiceChanges {
  image?: string;
  ports?: PortMappingChange[];
  environment?: Record<string, string | null>;
  volumes?: VolumeMountChange[];
  command?: { values: string[] };
  entrypoint?: { values: string[] };
  depends_on?: Record<string, DependsOnChange>;
  healthcheck?: HealthcheckChange;
  restart?: string;
  labels?: Record<string, string | null>;
  deploy?: DeployChange;
  build?: BuildChange;
}

export interface NewServiceConfig {
  image: string;
  ports?: PortMappingChange[];
  environment?: Record<string, string>;
  volumes?: VolumeMountChange[];
  restart?: string;
}

export interface ComposeChanges {
  service_changes?: Record<string, ServiceChanges>;
  network_changes?: Record<string, ComposeNetworkConfig | null>;
  volume_changes?: Record<string, ComposeVolumeConfig | null>;
  secret_changes?: Record<string, ComposeSecretConfig | null>;
  config_changes?: Record<string, ComposeConfigConfig | null>;
  add_services?: Record<string, NewServiceConfig>;
  delete_services?: string[];
  rename_services?: Record<string, string>;
}

export interface UpdateComposeRequest {
  changes: ComposeChanges;
}
