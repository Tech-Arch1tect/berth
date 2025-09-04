export interface FileEntry {
  name: string;
  path: string;
  size: number;
  is_directory: boolean;
  mod_time: string;
  mode: string;
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
}

export interface CreateDirectoryRequest {
  path: string;
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

export type FileOperation =
  | 'create'
  | 'edit'
  | 'delete'
  | 'rename'
  | 'copy'
  | 'chmod'
  | 'mkdir'
  | 'upload';
