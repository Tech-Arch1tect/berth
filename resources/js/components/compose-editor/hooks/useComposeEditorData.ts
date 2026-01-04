import { useEffect } from 'react';
import { useComposeConfig } from '../../../hooks/useComposeConfig';
import { useComposeEditor } from '../ComposeEditorProvider';

interface UseComposeEditorDataOptions {
  serverId: number;
  stackName: string;
  enabled?: boolean;
}

export const useComposeEditorData = ({
  serverId,
  stackName,
  enabled = true,
}: UseComposeEditorDataOptions) => {
  const { setComposeData, setLoading, setError } = useComposeEditor();
  const query = useComposeConfig({ serverId, stackName, enabled });

  useEffect(() => {
    setLoading(query.isLoading);
  }, [query.isLoading, setLoading]);

  useEffect(() => {
    if (query.error) {
      setError(query.error.message);
    }
  }, [query.error, setError]);

  useEffect(() => {
    if (query.data) {
      setComposeData(query.data);
    }
  }, [query.data, setComposeData]);

  return {
    refetch: query.refetch,
    isRefetching: query.isRefetching,
  };
};
