export interface CreateArchiveRequest {
  format: ArchiveFormat;
  output_path: string;
  include_paths?: string[];
  exclude_patterns?: string[];
  compression?: string;
}

export interface ExtractArchiveRequest {
  archive_path: string;
  destination_path?: string;
  overwrite?: boolean;
  create_dirs?: boolean;
}

export type ArchiveFormat = 'zip' | 'tar' | 'tar.gz';

export type FileOperation =
  | 'create'
  | 'edit'
  | 'delete'
  | 'rename'
  | 'copy'
  | 'chmod'
  | 'chown'
  | 'mkdir'
  | 'upload'
  | 'create_archive'
  | 'extract_archive';

export interface OpenTab {
  id: string;
  path: string;
  name: string;
  content: string;
  encoding: string;
  size: number;
  isDirty: boolean;
  originalContent: string;
}
