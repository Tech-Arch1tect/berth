export interface Server {
  ID: number;
  name: string;
  host: string;
  port: number;
  use_https: boolean;
  is_active: boolean;
  created_at?: string;
  updated_at?: string;
}
