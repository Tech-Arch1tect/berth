import { useState, useEffect, useCallback } from 'react';
import type { AuditLogFilters } from './useAuditLogFilters';
import type { PaginationState } from './usePagination';

export interface SecurityAuditLog {
  id: number;
  event_type: string;
  event_category: string;
  severity: string;
  actor_user_id: number | null;
  actor_username: string;
  actor_ip: string;
  actor_user_agent: string;
  target_user_id: number | null;
  target_type: string;
  target_id: number | null;
  target_name: string;
  success: boolean;
  failure_reason: string;
  metadata: string;
  server_id: number | null;
  stack_name: string;
  session_id: string;
  created_at: string;
}

export interface SecurityAuditStats {
  total_events: number;
  events_by_category: Record<string, number>;
  events_by_severity: Record<string, number>;
  failed_events: number;
  recent_event_types: Array<{ event_type: string; count: number }>;
  events_last_24_hours: number;
  events_last_7_days: number;
}

interface UseSecurityAuditLogsParams {
  filters: AuditLogFilters;
  pagination: PaginationState;
}

interface PaginationMetadata {
  total: number;
  totalPages: number;
  currentPage: number;
}

interface UseSecurityAuditLogsReturn {
  logs: SecurityAuditLog[];
  stats: SecurityAuditStats | null;
  selectedLog: SecurityAuditLog | null;
  loading: boolean;
  paginationMetadata: PaginationMetadata | null;
  fetchLogDetails: (id: number) => Promise<void>;
  clearSelectedLog: () => void;
}

export function useSecurityAuditLogs({
  filters,
  pagination,
}: UseSecurityAuditLogsParams): UseSecurityAuditLogsReturn {
  const [logs, setLogs] = useState<SecurityAuditLog[]>([]);
  const [stats, setStats] = useState<SecurityAuditStats | null>(null);
  const [selectedLog, setSelectedLog] = useState<SecurityAuditLog | null>(null);
  const [loading, setLoading] = useState(true);
  const [paginationMetadata, setPaginationMetadata] = useState<PaginationMetadata | null>(null);

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: pagination.currentPage.toString(),
        per_page: pagination.pageSize.toString(),
      });

      if (filters.searchTerm) params.append('search', filters.searchTerm);
      if (filters.selectedCategory && filters.selectedCategory !== 'all') {
        params.append('event_category', filters.selectedCategory);
      }
      if (filters.selectedSeverity && filters.selectedSeverity !== 'all') {
        params.append('severity', filters.selectedSeverity);
      }
      if (filters.selectedSuccess && filters.selectedSuccess !== 'all') {
        params.append('success', filters.selectedSuccess);
      }
      if (filters.startDate) {
        params.append('start_date', new Date(filters.startDate).toISOString());
      }
      if (filters.endDate) {
        params.append('end_date', new Date(filters.endDate).toISOString());
      }

      const response = await fetch(`/admin/api/security-audit-logs?${params}`);
      const data = await response.json();

      setLogs(data.logs || []);
      setPaginationMetadata({
        total: data.total || 0,
        totalPages: data.total_pages || 1,
        currentPage: data.page || 1,
      });
    } catch (error) {
      console.error('Failed to fetch security logs:', error);
    } finally {
      setLoading(false);
    }
  }, [
    filters.searchTerm,
    filters.selectedCategory,
    filters.selectedSeverity,
    filters.selectedSuccess,
    filters.startDate,
    filters.endDate,
    pagination.currentPage,
    pagination.pageSize,
  ]);

  const fetchStats = useCallback(async () => {
    try {
      const response = await fetch('/admin/api/security-audit-logs/stats');
      const data = await response.json();
      setStats(data);
    } catch (error) {
      console.error('Failed to fetch stats:', error);
    }
  }, []);

  const fetchLogDetails = useCallback(async (id: number) => {
    try {
      const response = await fetch(`/admin/api/security-audit-logs/${id}`);
      const data = await response.json();
      setSelectedLog(data);
    } catch (error) {
      console.error('Failed to fetch log details:', error);
    }
  }, []);

  const clearSelectedLog = useCallback(() => {
    setSelectedLog(null);
  }, []);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  return {
    logs,
    stats,
    selectedLog,
    loading,
    paginationMetadata,
    fetchLogDetails,
    clearSelectedLog,
  };
}
