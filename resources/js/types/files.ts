export interface FileEntry {
  name: string;
  path: string;
  size: number;
  is_directory: boolean;
  mod_time: string;
  mode: string;
  owner?: string;
  group?: string;
  owner_id?: number;
  group_id?: number;
  extension?: string;
}

export interface DirectoryListing {
  path: string;
  entries: FileEntry[];
}

export interface FileContent {
  path: string;
  content: string;
  size: number;
  encoding: string;
}

export interface WriteFileRequest {
  path: string;
  content: string;
  encoding?: string;
  mode?: string;
  owner_id?: number;
  group_id?: number;
}

export interface CreateDirectoryRequest {
  path: string;
  mode?: string;
  owner_id?: number;
  group_id?: number;
}

export interface DeleteRequest {
  path: string;
}

export interface RenameRequest {
  old_path: string;
  new_path: string;
}

export interface CopyRequest {
  source_path: string;
  target_path: string;
}

export interface ChmodRequest {
  path: string;
  mode: string;
  recursive?: boolean;
}

export interface ChownRequest {
  path: string;
  owner_id?: number;
  group_id?: number;
  recursive?: boolean;
}

export interface DirectoryStatsRequest {
  path: string;
}

export interface DirectoryStats {
  path: string;
  most_common_owner: number;
  most_common_group: number;
  most_common_mode: string;
  owner_name?: string;
  group_name?: string;
}

export type FileOperation =
  | 'create'
  | 'edit'
  | 'delete'
  | 'rename'
  | 'copy'
  | 'chmod'
  | 'chown'
  | 'mkdir'
  | 'upload';
