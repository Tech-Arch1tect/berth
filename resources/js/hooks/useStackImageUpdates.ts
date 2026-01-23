import { useMemo } from 'react';
import { useServerImageUpdates } from './useImageUpdates';
import type { GetApiV1ServersServeridImageUpdates200UpdatesItem } from '../api/generated/models';

interface UseStackImageUpdatesOptions {
  serverid: number;
  stackname: string;
  enabled?: boolean;
}

interface UseStackImageUpdatesResult {
  updates: GetApiV1ServersServeridImageUpdates200UpdatesItem[];
  updateCount: number;
  hasUpdates: boolean;
  isLoading: boolean;
  error: unknown;
  lastChecked: string | null;
  refetch: () => void;
}

export function useStackImageUpdates({
  serverid,
  stackname,
  enabled = true,
}: UseStackImageUpdatesOptions): UseStackImageUpdatesResult {
  const {
    data: serverUpdates = [],
    isLoading,
    error,
    refetch,
  } = useServerImageUpdates({
    serverid,
    enabled: enabled && !!serverid && !!stackname,
  });

  const stackUpdates = useMemo(() => {
    return serverUpdates.filter((update) => update.stack_name === stackname);
  }, [serverUpdates, stackname]);

  const successfulUpdates = useMemo(() => {
    return stackUpdates.filter((update) => !update.check_error && update.update_available);
  }, [stackUpdates]);

  const lastChecked = useMemo(() => {
    if (stackUpdates.length === 0) return null;

    const timestamps = stackUpdates
      .map((u) => u.last_checked_at)
      .filter((t): t is string => t !== null);
    if (timestamps.length === 0) return null;
    return timestamps.sort().reverse()[0];
  }, [stackUpdates]);

  return {
    updates: stackUpdates,
    updateCount: successfulUpdates.length,
    hasUpdates: stackUpdates.length > 0,
    isLoading,
    error,
    lastChecked,
    refetch,
  };
}
