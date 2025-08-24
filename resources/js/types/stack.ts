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
