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
