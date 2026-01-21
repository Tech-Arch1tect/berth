export interface Server {
  id: number;
  name: string;
  description: string;
  host: string;
  port: number;
  skip_ssl_verification: boolean;
  is_active: boolean;
  created_at?: string;
  updated_at?: string;
}
