import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useLogs } from './useLogs';

interface UseLogViewerStateOptions {
  serverid: number;
  stackname: string;
  containerName?: string;
}

export function useLogViewerState({
  serverid,
  stackname,
  containerName,
}: UseLogViewerStateOptions) {
  const [selectedContainer, setSelectedContainer] = useState<string>('');
  const [tail, setTail] = useState(100);
  const [since, setSince] = useState('');
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [showTimestamps, setShowTimestamps] = useState(true);
  const [isFilterPanelOpen, setIsFilterPanelOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [followMode, setFollowMode] = useState(true);
  const [silentLoading, setSilentLoading] = useState(false);

  const logContainerRef = useRef<HTMLDivElement>(null);
  const intervalRef = useRef<number | undefined>(undefined);

  const {
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
  } = useLogs({
    serverid,
    stackname,
    containerName: selectedContainer || containerName,
  });

  useEffect(() => {
    resetLogs();
    fetchLogs({ options: { tail, since, timestamps: showTimestamps } });
  }, [tail, since, showTimestamps, selectedContainer, resetLogs, fetchLogs]);

  useEffect(() => {
    if (autoRefresh) {
      intervalRef.current = window.setInterval(async () => {
        setSilentLoading(true);
        try {
          await fetchLogs({
            options: { tail, since, timestamps: showTimestamps },
            silent: true,
            incremental: true,
          });
        } finally {
          setSilentLoading(false);
        }
      }, 5000);
    } else if (intervalRef.current) {
      window.clearInterval(intervalRef.current);
    }

    return () => {
      if (intervalRef.current) {
        window.clearInterval(intervalRef.current);
      }
    };
  }, [autoRefresh, tail, since, showTimestamps, fetchLogs]);

  useEffect(() => {
    if (followMode && logContainerRef.current) {
      const element = logContainerRef.current;
      element.scrollTop = element.scrollHeight;
    }
  }, [filteredLogs, followMode]);

  const handleRefresh = useCallback(() => {
    fetchLogs({ options: { tail, since, timestamps: showTimestamps } });
  }, [fetchLogs, tail, since, showTimestamps]);

  const scrollToBottom = useCallback(() => {
    if (logContainerRef.current) {
      logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight;
    }
  }, []);

  const handleScroll = useCallback(() => {
    if (!logContainerRef.current) return;
    const element = logContainerRef.current;
    const isAtBottom = element.scrollHeight - element.scrollTop <= element.clientHeight + 10;
    setFollowMode(isAtBottom);
  }, []);

  const copyAllLogs = useCallback(async () => {
    try {
      const formatTimestamp = (timestamp: string) => {
        try {
          const date = new Date(timestamp);
          return date.toLocaleString('en-GB');
        } catch {
          return timestamp;
        }
      };

      const logText = filteredLogs
        .map(
          (log) =>
            `${formatTimestamp(log.timestamp)} [${log.level?.toUpperCase() || 'LOG'}] ${log.source ? `[${log.source}] ` : ''}${log.message}`
        )
        .join('\n');
      await navigator.clipboard.writeText(logText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy logs:', err);
    }
  }, [filteredLogs]);

  const logStats = useMemo(() => {
    const stats = { total: logs.length, error: 0, warn: 0, info: 0, debug: 0 };
    logs.forEach((log) => {
      if (log.level) {
        stats[log.level as keyof typeof stats] = (stats[log.level as keyof typeof stats] || 0) + 1;
      } else {
        stats.debug++;
      }
    });
    return stats;
  }, [logs]);

  const title = containerName || stackname;
  const subtitle = containerName ? 'Container Logs' : 'Stack Logs';

  return {
    selectedContainer,
    setSelectedContainer,
    tail,
    setTail,
    since,
    setSince,
    autoRefresh,
    setAutoRefresh,
    showTimestamps,
    setShowTimestamps,
    isFilterPanelOpen,
    setIsFilterPanelOpen,
    copied,
    followMode,
    setFollowMode,
    silentLoading,

    logContainerRef,

    logs,
    filteredLogs,
    loading,
    error,
    searchTerm,
    setSearchTerm,
    levelFilter,
    setLevelFilter,
    logStats,

    title,
    subtitle,

    handleRefresh,
    scrollToBottom,
    handleScroll,
    copyAllLogs,
  };
}
