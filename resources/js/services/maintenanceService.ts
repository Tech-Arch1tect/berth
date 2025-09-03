import axios from 'axios';

const api = axios.create({
  headers: {
    'Content-Type': 'application/json',
    'X-Requested-With': 'XMLHttpRequest',
  },
});

interface MaintenancePermissions {
  maintenance: {
    read: boolean;
    write: boolean;
  };
}

export class MaintenanceService {
  static async getPermissions(
    serverid: number,
    csrfToken?: string
  ): Promise<MaintenancePermissions> {
    try {
      const headers: Record<string, string> = {};
      if (csrfToken) {
        headers['X-CSRF-Token'] = csrfToken;
      }

      const response = await api.get(`/api/servers/${serverid}/maintenance/permissions`, {
        headers,
      });
      return response.data;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        if (error.response?.status === 403) {
          throw new Error('You do not have permission to access this server');
        }
        if (error.response?.status === 404) {
          throw new Error('Server not found');
        }
        throw new Error(error.response?.data?.error || 'Failed to fetch permissions');
      }
      throw new Error('Network error occurred');
    }
  }
}
