import { useState, useCallback } from 'react';
import { FileEntry, DirectoryListing } from '../types/files';

interface UseNestedFileTreeOptions {
  onFileSelect: (entry: FileEntry) => void;
  listDirectory: (path?: string) => Promise<DirectoryListing>;
}

interface TreeNode {
  entry: FileEntry;
  children: TreeNode[] | null;
  isLoading: boolean;
}

interface UseNestedFileTreeReturn {
  rootEntries: FileEntry[];
  childrenMap: Map<string, FileEntry[]>;
  loadingPaths: Set<string>;
  expandedPaths: Set<string>;
  selectedEntry: FileEntry | null;
  loadRootDirectory: (path?: string) => Promise<void>;
  toggleDirectory: (entry: FileEntry) => Promise<void>;
  selectEntry: (entry: FileEntry) => void;
  isExpanded: (path: string) => boolean;
  isLoading: (path: string) => boolean;
  isSelected: (path: string) => boolean;
  getChildren: (path: string) => FileEntry[];
  rootPath: string;
  rootLoading: boolean;
}

export function useNestedFileTree({
  onFileSelect,
  listDirectory,
}: UseNestedFileTreeOptions): UseNestedFileTreeReturn {
  const [rootEntries, setRootEntries] = useState<FileEntry[]>([]);
  const [rootPath, setRootPath] = useState<string>('');
  const [rootLoading, setRootLoading] = useState(false);
  const [childrenMap, setChildrenMap] = useState<Map<string, FileEntry[]>>(new Map());
  const [loadingPaths, setLoadingPaths] = useState<Set<string>>(new Set());
  const [expandedPaths, setExpandedPaths] = useState<Set<string>>(new Set());
  const [selectedEntry, setSelectedEntry] = useState<FileEntry | null>(null);

  const loadRootDirectory = useCallback(
    async (path?: string) => {
      setRootLoading(true);
      try {
        const result = await listDirectory(path);
        setRootEntries(result.entries || []);
        setRootPath(result.path || '');
        setChildrenMap(new Map());
        setExpandedPaths(new Set());
      } finally {
        setRootLoading(false);
      }
    },
    [listDirectory]
  );

  const loadChildren = useCallback(
    async (path: string) => {
      if (childrenMap.has(path)) return;

      setLoadingPaths((prev) => new Set(prev).add(path));
      try {
        const result = await listDirectory(path);
        setChildrenMap((prev) => {
          const next = new Map(prev);
          next.set(path, result.entries || []);
          return next;
        });
      } finally {
        setLoadingPaths((prev) => {
          const next = new Set(prev);
          next.delete(path);
          return next;
        });
      }
    },
    [listDirectory, childrenMap]
  );

  const toggleDirectory = useCallback(
    async (entry: FileEntry) => {
      if (!entry.is_directory) return;

      const isCurrentlyExpanded = expandedPaths.has(entry.path);

      if (isCurrentlyExpanded) {
        setExpandedPaths((prev) => {
          const next = new Set(prev);
          next.delete(entry.path);
          return next;
        });
      } else {
        setExpandedPaths((prev) => new Set(prev).add(entry.path));
        if (!childrenMap.has(entry.path)) {
          await loadChildren(entry.path);
        }
      }
    },
    [expandedPaths, childrenMap, loadChildren]
  );

  const selectEntry = useCallback(
    (entry: FileEntry) => {
      setSelectedEntry(entry);

      if (entry.is_directory) {
        toggleDirectory(entry);
      } else {
        onFileSelect(entry);
      }
    },
    [toggleDirectory, onFileSelect]
  );

  const isExpanded = useCallback((path: string) => expandedPaths.has(path), [expandedPaths]);

  const isLoading = useCallback((path: string) => loadingPaths.has(path), [loadingPaths]);

  const isSelected = useCallback((path: string) => selectedEntry?.path === path, [selectedEntry]);

  const getChildren = useCallback((path: string) => childrenMap.get(path) || [], [childrenMap]);

  return {
    rootEntries,
    childrenMap,
    loadingPaths,
    expandedPaths,
    selectedEntry,
    loadRootDirectory,
    toggleDirectory,
    selectEntry,
    isExpanded,
    isLoading,
    isSelected,
    getChildren,
    rootPath,
    rootLoading,
  };
}
