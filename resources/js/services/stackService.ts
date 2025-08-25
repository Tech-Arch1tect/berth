import axios from 'axios';
import { Stack } from '../types/stack';

const api = axios.create({
  headers: {
    'Content-Type': 'application/json',
    'X-Requested-With': 'XMLHttpRequest',
  },
});

export class StackService {
  static async getServerStacks(serverId: number, csrfToken?: string): Promise<Stack[]> {
    try {
      const headers: Record<string, string> = {};
      if (csrfToken) {
        headers['X-CSRF-Token'] = csrfToken;
      }

      const response = await api.get(`/api/servers/${serverId}/stacks`, { headers });
      const stacks: Stack[] = response.data.stacks || [];

      return stacks.sort((a, b) => a.name.localeCompare(b.name));
    } catch (error) {
      if (axios.isAxiosError(error)) {
        if (error.response?.status === 403) {
          throw new Error('You do not have permission to access this server');
        }
        if (error.response?.status === 404) {
          throw new Error('Server not found');
        }
        throw new Error(error.response?.data?.error || 'Failed to fetch stacks');
      }
      throw new Error('Network error occurred');
    }
  }
}
