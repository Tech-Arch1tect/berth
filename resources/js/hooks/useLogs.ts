import { useState, useCallback, useMemo, useRef } from 'react';
import { LogEntry, LogsResponse, LogFilterOptions } from '../types/logs';

interface UseLogsOptions {
  serverid: number;
  stackname: string;
  serviceName?: string;
  containerName?: string;
}

interface UseLogsReturn {
  logs: LogEntry[];
  loading: boolean;
  error: string | null;
  fetchLogs: (options: Partial<LogFilterOptions>, silent?: boolean) => Promise<void>;
  filteredLogs: LogEntry[];
  searchTerm: string;
  setSearchTerm: (term: string) => void;
  levelFilter: string;
  setLevelFilter: (level: string) => void;
  resetLogs: () => void;
}

export const useLogs = ({
  serverid,
  stackname,
  serviceName,
  containerName,
}: UseLogsOptions): UseLogsReturn => {
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
    if (serviceName) {
      return `/api/servers/${serverid}/stacks/${encodeURIComponent(stackname)}/services/${encodeURIComponent(serviceName)}/logs`;
    }
    return `/api/servers/${serverid}/stacks/${encodeURIComponent(stackname)}/logs`;
  }, [serverid, stackname, serviceName, containerName]);

  const fetchLogs = useCallback(
    async (options: Partial<LogFilterOptions>, silent = false) => {
      if (!silent) {
        setLoading(true);
      }
      setError(null);

      try {
        const params = new URLSearchParams();

        if (options.tail) params.set('tail', options.tail.toString());
        if (options.since) params.set('since', options.since);
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
          if (silent && prevLogs.length > 0 && lastFetchTimeRef.current) {
            const lastTimestamp = lastFetchTimeRef.current;
            const uniqueNewLogs = newLogs.filter((log) => {
              try {
                const logTime = new Date(log.timestamp).getTime();
                const lastTime = new Date(lastTimestamp).getTime();
                return logTime > lastTime;
              } catch {
                return true;
              }
            });

            if (uniqueNewLogs.length > 0) {
              const combinedLogs = [...prevLogs, ...uniqueNewLogs];

              return combinedLogs.slice(-2000);
            }

            return prevLogs;
          } else {
            return newLogs;
          }
        });

        if (newLogs.length > 0) {
          const mostRecentLog = newLogs[newLogs.length - 1];
          lastFetchTimeRef.current = mostRecentLog.timestamp;
        } else if (!silent) {
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
