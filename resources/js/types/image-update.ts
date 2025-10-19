export interface ImageUpdate {
  id: number;
  server_id: number;
  stack_name: string;
  container_name: string;
  current_image_name: string;
  current_repo_digest: string;
  latest_repo_digest: string;
  update_available: boolean;
  last_checked_at: string | null;
  check_error: string | null;
  created_at: string;
  updated_at: string;
}

export interface AvailableUpdatesResponse {
  updates: ImageUpdate[];
}

export interface ServerUpdatesResponse {
  updates: ImageUpdate[];
}
