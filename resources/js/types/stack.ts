export interface Stack {
  name: string;
  path: string;
  compose_file: string;
  server_id: number;
  server_name: string;
  is_healthy: boolean;
  total_containers: number;
  running_containers: number;
}

export interface ServerStacksResponse {
  server_id: number;
  server_name: string;
  stacks: Stack[];
  error?: string;
}

export interface StackDetails {
  name: string;
  path: string;
  compose_file: string;
  services: ComposeService[];
  server_id: number;
  server_name: string;
}

export interface ComposeService {
  name: string;
  image?: string;
  containers: Container[];
  depends_on?: string[];
  profiles?: string[];
  deploy?: DeployConfig;
  networks?: Record<string, ServiceNetwork>;
  environment?: Record<string, string>;
  labels?: Record<string, string>;
  command?: string[];
  entrypoint?: string[];
  working_dir?: string;
  user?: string;
  restart?: string;
  scale?: number;
}

export interface DeployConfig {
  replicas?: number;
  placement?: PlacementConfig;
  resources?: DeployResources;
  restart_policy?: RestartPolicy;
}

export interface PlacementConfig {
  constraints?: string[];
  preferences?: string[];
}

export interface DeployResources {
  limits?: ResourceLimits;
  reservations?: ResourceLimits;
}

export interface ServiceNetwork {
  aliases?: string[];
  ipv4_address?: string;
  ipv6_address?: string;
  priority?: number;
}

export interface Container {
  name: string;
  image: string;
  state: string;
  ports?: Port[];
  created?: string;
  started?: string;
  finished?: string;
  exit_code?: number;
  restart_policy?: RestartPolicy;
  resource_limits?: ResourceLimits;
  health?: HealthStatus;
  command?: string[];
  working_dir?: string;
  user?: string;
  labels?: Record<string, string>;
  networks?: ContainerNetwork[];
  mounts?: ContainerMount[];
}

export interface ContainerNetwork {
  name: string;
  network_id?: string;
  ip_address?: string;
  gateway?: string;
  mac_address?: string;
  aliases?: string[];
}

export interface ContainerMount {
  type: string;
  source: string;
  destination: string;
  driver?: string;
  mode?: string;
  rw: boolean;
  propagation?: string;
}

export interface RestartPolicy {
  name: string;
  maximum_retry_count?: number;
}

export interface ResourceLimits {
  cpu_shares?: number;
  memory?: number;
  memory_swap?: number;
  cpu_quota?: number;
  cpu_period?: number;
}

export interface HealthStatus {
  status: string;
  failing_streak?: number;
  log?: HealthLog[];
}

export interface HealthLog {
  start: string;
  end?: string;
  exit_code: number;
  output: string;
}

export interface Port {
  private: number;
  public?: number;
  type: string;
}

export interface NetworkIPAMConfig {
  subnet?: string;
  gateway?: string;
}

export interface NetworkIPAM {
  driver?: string;
  config?: NetworkIPAMConfig[];
}

export interface NetworkEndpoint {
  name: string;
  endpoint_id?: string;
  mac_address?: string;
  ipv4_address?: string;
  ipv6_address?: string;
}

export interface Network {
  name: string;
  driver?: string;
  external?: boolean;
  labels?: Record<string, string>;
  options?: Record<string, string>;
  ipam?: NetworkIPAM;
  containers?: Record<string, NetworkEndpoint>;
  exists: boolean;
  created?: string;
}

export interface StackNetworksResponse {
  networks: Network[];
}

export interface VolumeMount {
  type: string;
  source: string;
  target: string;
  read_only?: boolean;
  bind_options?: Record<string, string>;
  tmpfs_options?: Record<string, string>;
}

export interface VolumeUsage {
  container_name: string;
  service_name: string;
  mounts: VolumeMount[];
}

export interface Volume {
  name: string;
  driver?: string;
  external?: boolean;
  labels?: Record<string, string>;
  driver_opts?: Record<string, string>;
  exists: boolean;
  created?: string;
  mountpoint?: string;
  scope?: string;
  used_by?: VolumeUsage[];
}

export interface StackVolumesResponse {
  volumes: Volume[];
}

export interface EnvironmentVariable {
  key: string;
  value: string;
  is_sensitive: boolean;
  source: 'compose' | 'runtime';
  is_from_container: boolean;
}

export interface ServiceEnvironment {
  service_name?: string;
  variables: EnvironmentVariable[];
}

export interface StackEnvironmentResponse {
  [serviceName: string]: ServiceEnvironment[];
}

export interface ContainerImageDetails {
  container_name: string;
  image_id: string;
  image_name: string;
  image_info: ImageInspectInfo;
  image_history: ImageHistoryLayer[];
}

export interface ImageInspectInfo {
  architecture: string;
  os: string;
  size: number;
  virtual_size: number;
  author: string;
  created: string;
  docker_version: string;
  parent?: string;
  repo_tags?: string[];
  repo_digests?: string[];
  config: ImageConfig;
  rootfs: RootFS;
}

export interface ImageConfig {
  user?: string;
  env?: string[];
  cmd?: string[];
  entrypoint?: string[];
  working_dir?: string;
  exposed_ports?: Record<string, any>;
  labels?: Record<string, string>;
}

export interface RootFS {
  type: string;
  layers?: string[];
}

export interface ImageHistoryLayer {
  id: string;
  created: number;
  created_by: string;
  size: number;
  comment?: string;
  tags?: string[];
}
