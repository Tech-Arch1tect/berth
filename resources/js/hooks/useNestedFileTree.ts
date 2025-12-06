import { useState, useCallback, useMemo } from 'react';
import { useQueries } from '@tanstack/react-query';
import axios from 'axios';
import { FileEntry, DirectoryListing } from '../types/files';
import { fileQueryKeys } from './useFileQueries';

interface UseNestedFileTreeOptions {
  serverid: number;
  stackname: string;
  onFileSelect: (entry: FileEntry) => void;
  enabled?: boolean;
}

interface UseNestedFileTreeReturn {
  rootEntries: FileEntry[];
  rootPath: string;
  rootLoading: boolean;
  rootError: Error | null;
  expandedPaths: Set<string>;
  selectedEntry: FileEntry | null;
  toggleDirectory: (entry: FileEntry) => void;
  selectEntry: (entry: FileEntry) => void;
  isExpanded: (path: string) => boolean;
  isLoading: (path: string) => boolean;
  isSelected: (path: string) => boolean;
  getChildren: (path: string) => FileEntry[];
  refetchAll: () => void;
}

export function useNestedFileTree({
  serverid,
  stackname,
  onFileSelect,
  enabled = true,
}: UseNestedFileTreeOptions): UseNestedFileTreeReturn {
  const [expandedPaths, setExpandedPaths] = useState<Set<string>>(new Set());
  const [selectedEntry, setSelectedEntry] = useState<FileEntry | null>(null);

  const baseUrl = `/api/servers/${serverid}/stacks/${stackname}/files`;

  const expandedPathsArray = useMemo(() => Array.from(expandedPaths), [expandedPaths]);

  const allPaths = useMemo(() => ['', ...expandedPathsArray], [expandedPathsArray]);

  const queries = useQueries({
    queries: allPaths.map((path) => ({
      queryKey: fileQueryKeys.directory(serverid, stackname, path),
      queryFn: async (): Promise<DirectoryListing> => {
        const params = path ? { path } : {};
        const response = await axios.get<DirectoryListing>(baseUrl, { params });
        return response.data;
      },
      enabled,
      staleTime: 0,
      gcTime: 5 * 60 * 1000,
      refetchOnWindowFocus: true,
      refetchOnMount: true,
      retry: 1,
    })),
  });

  const rootQuery = queries[0];
  const childQueries = queries.slice(1);

  const childrenMap = useMemo(() => {
    const map = new Map<string, FileEntry[]>();
    expandedPathsArray.forEach((path, index) => {
      const query = childQueries[index];
      if (query?.data?.entries) {
        map.set(path, query.data.entries);
      }
    });
    return map;
  }, [expandedPathsArray, childQueries]);

  const loadingPaths = useMemo(() => {
    const set = new Set<string>();
    expandedPathsArray.forEach((path, index) => {
      const query = childQueries[index];
      if (query?.isLoading || query?.isFetching) {
        set.add(path);
      }
    });
    return set;
  }, [expandedPathsArray, childQueries]);

  const toggleDirectory = useCallback((entry: FileEntry) => {
    if (!entry.is_directory) return;

    setExpandedPaths((prev) => {
      const next = new Set(prev);
      if (next.has(entry.path)) {
        next.delete(entry.path);
      } else {
        next.add(entry.path);
      }
      return next;
    });
  }, []);

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

  const refetchAll = useCallback(() => {
    queries.forEach((query) => query.refetch());
  }, [queries]);

  return {
    rootEntries: rootQuery?.data?.entries || [],
    rootPath: rootQuery?.data?.path || '',
    rootLoading: rootQuery?.isLoading || false,
    rootError: rootQuery?.error || null,
    expandedPaths,
    selectedEntry,
    toggleDirectory,
    selectEntry,
    isExpanded,
    isLoading,
    isSelected,
    getChildren,
    refetchAll,
  };
}
