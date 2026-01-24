import { useState, useCallback, useMemo } from 'react';
import { useQueries } from '@tanstack/react-query';
import type {
  GetApiV1ServersServeridStacksStacknameFiles200,
  GetApiV1ServersServeridStacksStacknameFiles200EntriesItem,
} from '../api/generated/models';
import { getApiV1ServersServeridStacksStacknameFiles } from '../api/generated/files/files';
import { fileQueryKeys } from './useFileQueries';

interface UseNestedFileTreeOptions {
  serverid: number;
  stackname: string;
  onFileSelect: (entry: GetApiV1ServersServeridStacksStacknameFiles200EntriesItem) => void;
  enabled?: boolean;
}

interface UseNestedFileTreeReturn {
  rootEntries: GetApiV1ServersServeridStacksStacknameFiles200EntriesItem[];
  rootPath: string;
  rootLoading: boolean;
  rootError: Error | null;
  expandedPaths: Set<string>;
  selectedEntry: GetApiV1ServersServeridStacksStacknameFiles200EntriesItem | null;
  toggleDirectory: (entry: GetApiV1ServersServeridStacksStacknameFiles200EntriesItem) => void;
  selectEntry: (entry: GetApiV1ServersServeridStacksStacknameFiles200EntriesItem) => void;
  isExpanded: (path: string) => boolean;
  isLoading: (path: string) => boolean;
  isSelected: (path: string) => boolean;
  getChildren: (path: string) => GetApiV1ServersServeridStacksStacknameFiles200EntriesItem[];
  refetchAll: () => void;
}

export function useNestedFileTree({
  serverid,
  stackname,
  onFileSelect,
  enabled = true,
}: UseNestedFileTreeOptions): UseNestedFileTreeReturn {
  const [expandedPaths, setExpandedPaths] = useState<Set<string>>(new Set());
  const [selectedEntry, setSelectedEntry] =
    useState<GetApiV1ServersServeridStacksStacknameFiles200EntriesItem | null>(null);

  const expandedPathsArray = useMemo(() => Array.from(expandedPaths), [expandedPaths]);

  const allPaths = useMemo(() => ['', ...expandedPathsArray], [expandedPathsArray]);

  const queries = useQueries({
    queries: allPaths.map((path) => ({
      queryKey: fileQueryKeys.directory(serverid, stackname, path),
      queryFn: async (): Promise<GetApiV1ServersServeridStacksStacknameFiles200> => {
        const response = await getApiV1ServersServeridStacksStacknameFiles(
          serverid,
          stackname,
          path ? { path } : undefined
        );
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
    const map = new Map<string, GetApiV1ServersServeridStacksStacknameFiles200EntriesItem[]>();
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

  const toggleDirectory = useCallback(
    (entry: GetApiV1ServersServeridStacksStacknameFiles200EntriesItem) => {
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
    },
    []
  );

  const selectEntry = useCallback(
    (entry: GetApiV1ServersServeridStacksStacknameFiles200EntriesItem) => {
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
