import { useState, useCallback, useMemo, useRef } from 'react';
import type { LogFilterOptions } from '../types/logs';
import type { GetApiV1ServersServeridStacksStacknameLogs200LogsItem } from '../api/generated/models';
import {
  getApiV1ServersServeridStacksStacknameLogs,
  getApiV1ServersServeridStacksStacknameContainersContainerNameLogs,
} from '../api/generated/logs/logs';

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
  logs: GetApiV1ServersServeridStacksStacknameLogs200LogsItem[];
  loading: boolean;
  error: string | null;
  fetchLogs: (fetchOptions: FetchLogsOptions) => Promise<void>;
  filteredLogs: GetApiV1ServersServeridStacksStacknameLogs200LogsItem[];
  searchTerm: string;
  setSearchTerm: (term: string) => void;
  levelFilter: string;
  setLevelFilter: (level: string) => void;
  resetLogs: () => void;
}

export const useLogs = ({ serverid, stackname, containerName }: UseLogsOptions): UseLogsReturn => {
  const [logs, setLogs] = useState<GetApiV1ServersServeridStacksStacknameLogs200LogsItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [levelFilter, setLevelFilter] = useState('all');
  const lastFetchTimeRef = useRef<string | null>(null);

  const fetchLogs = useCallback(
    async ({ options, silent = false, incremental = false }: FetchLogsOptions) => {
      if (!silent) {
        setLoading(true);
      }
      setError(null);

      try {
        const params: { tail?: number; since?: string; timestamps?: boolean } = {};

        if (options.tail) params.tail = options.tail;

        if (incremental && lastFetchTimeRef.current) {
          params.since = lastFetchTimeRef.current;
        } else if (options.since) {
          params.since = options.since;
        }

        if (options.timestamps !== undefined) params.timestamps = options.timestamps;

        const response = containerName
          ? await getApiV1ServersServeridStacksStacknameContainersContainerNameLogs(
              serverid,
              stackname,
              containerName,
              params
            )
          : await getApiV1ServersServeridStacksStacknameLogs(serverid, stackname, params);

        const newLogs = response.data.logs || [];

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
    [serverid, stackname, containerName]
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
