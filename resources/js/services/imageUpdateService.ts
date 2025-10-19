import axios from 'axios';
import {
  AvailableUpdatesResponse,
  ServerUpdatesResponse,
  ImageUpdate,
} from '../types/image-update';

const api = axios.create({
  headers: {
    'Content-Type': 'application/json',
    'X-Requested-With': 'XMLHttpRequest',
  },
});

export class ImageUpdateService {
  static async getAvailableUpdates(csrfToken?: string): Promise<ImageUpdate[]> {
    try {
      const headers: Record<string, string> = {};
      if (csrfToken) {
        headers['X-CSRF-Token'] = csrfToken;
      }

      const response = await api.get<AvailableUpdatesResponse>('/api/image-updates', { headers });
      return response.data.updates || [];
    } catch (error) {
      if (axios.isAxiosError(error)) {
        if (error.response?.status === 403) {
          throw new Error('You do not have permission to view image updates');
        }
        if (error.response?.status === 404) {
          throw new Error('Image updates not found');
        }
        throw new Error(error.response?.data?.error || 'Failed to fetch image updates');
      }
      throw new Error('Network error occurred');
    }
  }

  static async getServerUpdates(serverid: number, csrfToken?: string): Promise<ImageUpdate[]> {
    try {
      const headers: Record<string, string> = {};
      if (csrfToken) {
        headers['X-CSRF-Token'] = csrfToken;
      }

      const response = await api.get<ServerUpdatesResponse>(
        `/api/servers/${serverid}/image-updates`,
        { headers }
      );
      return response.data.updates || [];
    } catch (error) {
      if (axios.isAxiosError(error)) {
        if (error.response?.status === 403) {
          throw new Error('You do not have permission to view updates for this server');
        }
        if (error.response?.status === 404) {
          throw new Error('Server not found or no updates available');
        }
        throw new Error(error.response?.data?.error || 'Failed to fetch server updates');
      }
      throw new Error('Network error occurred');
    }
  }
}
