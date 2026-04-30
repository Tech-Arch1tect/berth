import { useState, useCallback, useMemo } from 'react';

export interface PaginationState {
  currentPage: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
}

export interface UsePaginationReturn {
  current: PaginationState;
  setPage: (page: number) => void;
  setPageSize: (size: number) => void;
  setTotalItems: (total: number) => void;
  nextPage: () => void;
  previousPage: () => void;
  canGoNext: boolean;
  canGoPrevious: boolean;
}

export function usePagination(initialPageSize: number = 20): UsePaginationReturn {
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(initialPageSize);
  const [totalItems, setTotalItems] = useState(0);

  const totalPages = useMemo(() => Math.ceil(totalItems / pageSize) || 1, [totalItems, pageSize]);

  const canGoNext = useMemo(() => currentPage < totalPages, [currentPage, totalPages]);

  const canGoPrevious = useMemo(() => currentPage > 1, [currentPage]);

  const setPage = useCallback((page: number) => {
    setCurrentPage(page);
  }, []);

  const nextPage = useCallback(() => {
    setCurrentPage((prev) => Math.min(prev + 1, totalPages));
  }, [totalPages]);

  const previousPage = useCallback(() => {
    setCurrentPage((prev) => Math.max(prev - 1, 1));
  }, []);

  const handleSetPageSize = useCallback((size: number) => {
    setPageSize(size);
    setCurrentPage(1);
  }, []);

  const handleSetTotalItems = useCallback((total: number) => {
    setTotalItems(total);
  }, []);

  const current = useMemo(
    () => ({
      currentPage,
      pageSize,
      totalItems,
      totalPages,
    }),
    [currentPage, pageSize, totalItems, totalPages]
  );

  return useMemo(
    () => ({
      current,
      setPage,
      setPageSize: handleSetPageSize,
      setTotalItems: handleSetTotalItems,
      nextPage,
      previousPage,
      canGoNext,
      canGoPrevious,
    }),
    [
      current,
      setPage,
      handleSetPageSize,
      handleSetTotalItems,
      nextPage,
      previousPage,
      canGoNext,
      canGoPrevious,
    ]
  );
}
