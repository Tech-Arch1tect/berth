import { useQuery } from '@tanstack/react-query';
import { usePage } from '@inertiajs/react';
import { ImageUpdateService } from '../services/imageUpdateService';
import { ImageUpdate } from '../types/image-update';

interface UseAvailableUpdatesOptions {
  enabled?: boolean;
}

export function useAvailableUpdates({ enabled = true }: UseAvailableUpdatesOptions = {}) {
  const { props } = usePage();
  const csrfToken = props.csrfToken as string | undefined;

  return useQuery<ImageUpdate[], Error>({
    queryKey: ['image-updates', 'all'],
    queryFn: () => ImageUpdateService.getAvailableUpdates(csrfToken),
    enabled,
    staleTime: 5 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
    refetchOnWindowFocus: false,
    retry: 1,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
  });
}

interface UseServerImageUpdatesOptions {
  serverid: number;
  enabled?: boolean;
}

export function useServerImageUpdates({ serverid, enabled = true }: UseServerImageUpdatesOptions) {
  const { props } = usePage();
  const csrfToken = props.csrfToken as string | undefined;

  return useQuery<ImageUpdate[], Error>({
    queryKey: ['image-updates', 'server', serverid],
    queryFn: () => ImageUpdateService.getServerUpdates(serverid, csrfToken),
    enabled: enabled && !!serverid,
    staleTime: 5 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
    refetchOnWindowFocus: false,
    retry: 1,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
  });
}
