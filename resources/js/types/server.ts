export interface Server {
  id: number;
  name: string;
  description: string;
  host: string;
  port: number;
  use_https: boolean;
  is_active: boolean;
  created_at?: string;
  updated_at?: string;
}
