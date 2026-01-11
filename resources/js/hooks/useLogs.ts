import { useState, useCallback, useMemo, useRef } from 'react';
import { LogEntry, LogsResponse, LogFilterOptions } from '../types/logs';

interface UseLogsOptions {
  serverid: number;
  stackname: string;
  containerName?: string;
}

interface FetchLogsOptions {
  options: Partial<LogFilterOptions>;
  silent?: boolean;
  incremental?: boolean;
}

interface UseLogsReturn {
  logs: LogEntry[];
  loading: boolean;
  error: string | null;
  fetchLogs: (fetchOptions: FetchLogsOptions) => Promise<void>;
  filteredLogs: LogEntry[];
  searchTerm: string;
  setSearchTerm: (term: string) => void;
  levelFilter: string;
  setLevelFilter: (level: string) => void;
  resetLogs: () => void;
}

export const useLogs = ({ serverid, stackname, containerName }: UseLogsOptions): UseLogsReturn => {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [levelFilter, setLevelFilter] = useState('all');
  const lastFetchTimeRef = useRef<string | null>(null);

  const buildEndpoint = useCallback(() => {
    if (containerName) {
      return `/api/servers/${serverid}/stacks/${encodeURIComponent(stackname)}/containers/${encodeURIComponent(containerName)}/logs`;
    }
    return `/api/servers/${serverid}/stacks/${encodeURIComponent(stackname)}/logs`;
  }, [serverid, stackname, containerName]);

  const fetchLogs = useCallback(
    async ({ options, silent = false, incremental = false }: FetchLogsOptions) => {
      if (!silent) {
        setLoading(true);
      }
      setError(null);

      try {
        const params = new URLSearchParams();

        if (options.tail) params.set('tail', options.tail.toString());

        if (incremental && lastFetchTimeRef.current) {
          params.set('since', lastFetchTimeRef.current);
        } else if (options.since) {
          params.set('since', options.since);
        }

        if (options.timestamps !== undefined)
          params.set('timestamps', options.timestamps.toString());

        const endpoint = buildEndpoint();
        const queryString = params.toString();
        const url = queryString ? `${endpoint}?${queryString}` : endpoint;

        const response = await fetch(url, {
          method: 'GET',
          headers: {
            Accept: 'application/json',
            'Content-Type': 'application/json',
          },
          credentials: 'include',
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(errorData.error || `HTTP ${response.status}: ${response.statusText}`);
        }

        const data: LogsResponse = await response.json();
        const newLogs = data.logs || [];

        setLogs((prevLogs) => {
          if (incremental && prevLogs.length > 0) {
            if (newLogs.length > 0) {
              const combinedLogs = [...prevLogs, ...newLogs];
              return combinedLogs.slice(-2000);
            }
            return prevLogs;
          } else {
            return newLogs;
          }
        });

        if (newLogs.length > 0) {
          const mostRecentLog = newLogs[newLogs.length - 1];
          const lastTime = new Date(mostRecentLog.timestamp);
          if (!isNaN(lastTime.getTime())) {
            lastTime.setMilliseconds(lastTime.getMilliseconds() + 1);
            lastFetchTimeRef.current = lastTime.toISOString();
          } else {
            lastFetchTimeRef.current = new Date().toISOString();
          }
        } else if (!incremental) {
          lastFetchTimeRef.current = new Date().toISOString();
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to fetch logs');
        if (!silent) {
          setLogs([]);
        }
      } finally {
        if (!silent) {
          setLoading(false);
        }
      }
    },
    [buildEndpoint]
  );

  const filteredLogs = useMemo(() => {
    return logs.filter((log) => {
      // Search filter
      if (searchTerm && !log.message.toLowerCase().includes(searchTerm.toLowerCase())) {
        return false;
      }

      // Level filter
      if (levelFilter !== 'all' && log.level !== levelFilter) {
        return false;
      }

      return true;
    });
  }, [logs, searchTerm, levelFilter]);

  const resetLogs = useCallback(() => {
    setLogs([]);
    lastFetchTimeRef.current = null;
  }, []);

  return {
    logs,
    loading,
    error,
    fetchLogs,
    filteredLogs,
    searchTerm,
    setSearchTerm,
    levelFilter,
    setLevelFilter,
    resetLogs,
  };
};
