export interface Stack {
  name: string;
  path: string;
  compose_file: string;
  server_id: number;
  server_name: string;
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
}

export interface Container {
  name: string;
  image: string;
  state: string;
  ports?: Port[];
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
