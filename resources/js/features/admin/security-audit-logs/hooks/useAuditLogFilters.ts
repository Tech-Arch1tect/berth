import { useState, useCallback } from 'react';

export interface AuditLogFilters {
  searchTerm: string;
  selectedCategory: string;
  selectedSeverity: string;
  selectedSuccess: string;
  startDate: string;
  endDate: string;
}

export interface UseAuditLogFiltersReturn {
  values: AuditLogFilters;
  updateFilter: <K extends keyof AuditLogFilters>(key: K, value: AuditLogFilters[K]) => void;
  resetFilters: () => void;
}

const initialFilters: AuditLogFilters = {
  searchTerm: '',
  selectedCategory: 'all',
  selectedSeverity: 'all',
  selectedSuccess: 'all',
  startDate: '',
  endDate: '',
};

export function useAuditLogFilters(): UseAuditLogFiltersReturn {
  const [values, setValues] = useState<AuditLogFilters>(initialFilters);

  const updateFilter = useCallback(
    <K extends keyof AuditLogFilters>(key: K, value: AuditLogFilters[K]) => {
      setValues((prev) => ({
        ...prev,
        [key]: value,
      }));
    },
    []
  );

  const resetFilters = useCallback(() => {
    setValues(initialFilters);
  }, []);

  return {
    values,
    updateFilter,
    resetFilters,
  };
}
