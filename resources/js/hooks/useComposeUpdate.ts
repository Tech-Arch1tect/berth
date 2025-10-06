import { useMutation, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import { usePage } from '@inertiajs/react';
import { ComposeChanges } from '../components/compose';

interface UseComposeUpdateParams {
  serverid: number;
  stackname: string;
}

export const useComposeUpdate = ({ serverid, stackname }: UseComposeUpdateParams) => {
  const queryClient = useQueryClient();
  const { props } = usePage();
  const csrfToken = props.csrfToken as string | undefined;

  return useMutation({
    mutationFn: async (changes: ComposeChanges) => {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'X-Requested-With': 'XMLHttpRequest',
      };
      if (csrfToken) {
        headers['X-CSRF-Token'] = csrfToken;
      }

      const response = await axios.patch(
        `/api/servers/${serverid}/stacks/${stackname}/compose`,
        { changes },
        { headers }
      );
      return response.data;
    },
    onSuccess: () => {
      // Invalidate and refetch stack details to show updated configuration
      queryClient.invalidateQueries({
        queryKey: ['stackDetails', serverid, stackname],
      });
      queryClient.invalidateQueries({
        queryKey: ['stackEnvironment', serverid, stackname],
      });
    },
  });
};
