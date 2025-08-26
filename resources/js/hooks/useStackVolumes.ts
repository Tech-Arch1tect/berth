import { useQuery } from '@tanstack/react-query';
import { StackService } from '../services/stackService';
import { Volume } from '../types/stack';

interface UseStackVolumesOptions {
  serverId: number;
  stackName: string;
  enabled?: boolean;
}

export const useStackVolumes = ({
  serverId,
  stackName,
  enabled = true,
}: UseStackVolumesOptions) => {
  return useQuery<Volume[], Error>({
    queryKey: ['stackVolumes', serverId, stackName],
    queryFn: () => StackService.getStackVolumes(serverId, stackName),
    enabled: enabled && !!serverId && !!stackName,
    staleTime: 30000,
    gcTime: 300000,
  });
};
