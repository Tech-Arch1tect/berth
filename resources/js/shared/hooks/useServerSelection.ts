import { useState, useCallback, useMemo } from 'react';

interface UseServerSelectionOptions {
  initialIds?: number[];
}

interface UseServerSelectionReturn {
  selectedIds: Set<number>;
  toggle: (id: number) => void;
  selectAll: (ids: number[]) => void;
  deselectAll: () => void;
  selectedCount: number;
  isSelected: (id: number) => boolean;
  setSelected: (ids: number[]) => void;
}

export function useServerSelection({
  initialIds = [],
}: UseServerSelectionOptions = {}): UseServerSelectionReturn {
  const [selectedIds, setSelectedIds] = useState<Set<number>>(() => new Set(initialIds));

  const toggle = useCallback((id: number) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  const selectAll = useCallback((ids: number[]) => {
    setSelectedIds(new Set(ids));
  }, []);

  const deselectAll = useCallback(() => {
    setSelectedIds(new Set());
  }, []);

  const setSelected = useCallback((ids: number[]) => {
    setSelectedIds(new Set(ids));
  }, []);

  const selectedCount = useMemo(() => selectedIds.size, [selectedIds]);

  const isSelected = useCallback((id: number) => selectedIds.has(id), [selectedIds]);

  return {
    selectedIds,
    toggle,
    selectAll,
    deselectAll,
    selectedCount,
    isSelected,
    setSelected,
  };
}
