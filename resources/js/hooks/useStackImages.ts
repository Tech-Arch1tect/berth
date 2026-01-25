import { useQuery } from '@tanstack/react-query';
import { StackService } from '../services/stackService';
import type { ContainerImageDetails } from '../api/generated/models';

interface UseStackImagesOptions {
  serverid: number;
  stackname: string;
  enabled?: boolean;
}

export const useStackImages = ({ serverid, stackname, enabled = true }: UseStackImagesOptions) => {
  return useQuery<ContainerImageDetails[], Error>({
    queryKey: ['stackImages', serverid, stackname],
    queryFn: () => StackService.getStackImages(serverid, stackname),
    enabled: enabled && !!serverid && !!stackname,
    staleTime: 30000,
    gcTime: 300000,
  });
};
