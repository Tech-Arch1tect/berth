import { useQuery } from '@tanstack/react-query';
import { StackService } from '../services/stackService';
import { Volume } from '../types/stack';

interface UseStackVolumesOptions {
  serverid: number;
  stackname: string;
  enabled?: boolean;
}

export const useStackVolumes = ({
  serverid,
  stackname,
  enabled = true,
}: UseStackVolumesOptions) => {
  return useQuery<Volume[], Error>({
    queryKey: ['stackVolumes', serverid, stackname],
    queryFn: () => StackService.getStackVolumes(serverid, stackname),
    enabled: enabled && !!serverid && !!stackname,
    staleTime: 30000,
    gcTime: 300000,
  });
};
