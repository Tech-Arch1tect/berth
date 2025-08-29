import axios from 'axios';
import { Stack, Network, Volume, StackEnvironmentResponse } from '../types/stack';

const api = axios.create({
  headers: {
    'Content-Type': 'application/json',
    'X-Requested-With': 'XMLHttpRequest',
  },
});

export class StackService {
  static async getServerStacks(serverid: number, csrfToken?: string): Promise<Stack[]> {
    try {
      const headers: Record<string, string> = {};
      if (csrfToken) {
        headers['X-CSRF-Token'] = csrfToken;
      }

      const response = await api.get(`/api/servers/${serverid}/stacks`, { headers });
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

  static async getStackNetworks(
    serverid: number,
    stackname: string,
    csrfToken?: string
  ): Promise<Network[]> {
    try {
      const headers: Record<string, string> = {};
      if (csrfToken) {
        headers['X-CSRF-Token'] = csrfToken;
      }

      const response = await api.get(`/api/servers/${serverid}/stacks/${stackname}/networks`, {
        headers,
      });
      return response.data || [];
    } catch (error) {
      if (axios.isAxiosError(error)) {
        if (error.response?.status === 403) {
          throw new Error('You do not have permission to access this server');
        }
        if (error.response?.status === 404) {
          throw new Error('Stack or networks not found');
        }
        throw new Error(error.response?.data?.error || 'Failed to fetch networks');
      }
      throw new Error('Network error occurred');
    }
  }

  static async getStackVolumes(
    serverid: number,
    stackname: string,
    csrfToken?: string
  ): Promise<Volume[]> {
    try {
      const headers: Record<string, string> = {};
      if (csrfToken) {
        headers['X-CSRF-Token'] = csrfToken;
      }

      const response = await api.get(`/api/servers/${serverid}/stacks/${stackname}/volumes`, {
        headers,
      });
      return response.data || [];
    } catch (error) {
      if (axios.isAxiosError(error)) {
        if (error.response?.status === 403) {
          throw new Error('You do not have permission to access this server');
        }
        if (error.response?.status === 404) {
          throw new Error('Stack or volumes not found');
        }
        throw new Error(error.response?.data?.error || 'Failed to fetch volumes');
      }
      throw new Error('Network error occurred');
    }
  }

  static async getStackEnvironmentVariables(
    serverid: number,
    stackname: string,
    csrfToken?: string
  ): Promise<StackEnvironmentResponse> {
    try {
      const headers: Record<string, string> = {};
      if (csrfToken) {
        headers['X-CSRF-Token'] = csrfToken;
      }

      const response = await api.get(`/api/servers/${serverid}/stacks/${stackname}/environment`, {
        headers,
      });
      return response.data || {};
    } catch (error) {
      if (axios.isAxiosError(error)) {
        if (error.response?.status === 403) {
          throw new Error('You do not have permission to access this server');
        }
        if (error.response?.status === 404) {
          throw new Error('Stack or environment variables not found');
        }
        throw new Error(error.response?.data?.error || 'Failed to fetch environment variables');
      }
      throw new Error('Network error occurred');
    }
  }
}
