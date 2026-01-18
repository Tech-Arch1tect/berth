import axios from 'axios';
import {
  Stack,
  Network,
  Volume,
  StackEnvironmentResponse,
  ContainerImageDetails,
} from '../types/stack';
import { RawComposeConfig, UpdateComposeRequest, UpdateComposeResponse } from '../types/compose';

export interface StackPermissions {
  permissions: string[];
}

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
    unmask: boolean = false,
    csrfToken?: string
  ): Promise<StackEnvironmentResponse> {
    try {
      const headers: Record<string, string> = {};
      if (csrfToken) {
        headers['X-CSRF-Token'] = csrfToken;
      }

      const params = unmask ? { unmask: 'true' } : {};
      const response = await api.get(`/api/servers/${serverid}/stacks/${stackname}/environment`, {
        headers,
        params,
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

  static async getStackPermissions(
    serverid: number,
    stackname: string,
    csrfToken?: string
  ): Promise<StackPermissions> {
    try {
      const headers: Record<string, string> = {};
      if (csrfToken) {
        headers['X-CSRF-Token'] = csrfToken;
      }

      const response = await api.get(`/api/servers/${serverid}/stacks/${stackname}/permissions`, {
        headers,
      });
      return response.data;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        if (error.response?.status === 403) {
          throw new Error('You do not have permission to access this stack');
        }
        if (error.response?.status === 404) {
          throw new Error('Stack not found');
        }
        throw new Error(error.response?.data?.error || 'Failed to fetch permissions');
      }
      throw new Error('Network error occurred');
    }
  }

  static async getStackImages(
    serverid: number,
    stackname: string,
    csrfToken?: string
  ): Promise<ContainerImageDetails[]> {
    try {
      const headers: Record<string, string> = {};
      if (csrfToken) {
        headers['X-CSRF-Token'] = csrfToken;
      }

      const response = await api.get(`/api/servers/${serverid}/stacks/${stackname}/images`, {
        headers,
      });
      return response.data || [];
    } catch (error) {
      if (axios.isAxiosError(error)) {
        if (error.response?.status === 403) {
          throw new Error('You do not have permission to access this server');
        }
        if (error.response?.status === 404) {
          throw new Error('Stack or images not found');
        }
        throw new Error(error.response?.data?.error || 'Failed to fetch image details');
      }
      throw new Error('Network error occurred');
    }
  }

  static async getComposeConfig(
    serverid: number,
    stackname: string,
    csrfToken?: string
  ): Promise<RawComposeConfig> {
    try {
      const headers: Record<string, string> = {};
      if (csrfToken) {
        headers['X-CSRF-Token'] = csrfToken;
      }

      const response = await api.get(`/api/v1/servers/${serverid}/stacks/${stackname}/compose`, {
        headers,
      });
      return response.data;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        if (error.response?.status === 403) {
          throw new Error('You do not have permission to access this stack');
        }
        if (error.response?.status === 404) {
          throw new Error('Stack not found');
        }
        throw new Error(error.response?.data?.error || 'Failed to fetch compose configuration');
      }
      throw new Error('Network error occurred');
    }
  }

  static async updateCompose(
    serverid: number,
    stackname: string,
    request: UpdateComposeRequest,
    csrfToken?: string
  ): Promise<UpdateComposeResponse> {
    try {
      const headers: Record<string, string> = {};
      if (csrfToken) {
        headers['X-CSRF-Token'] = csrfToken;
      }

      const response = await api.patch<UpdateComposeResponse>(
        `/api/v1/servers/${serverid}/stacks/${stackname}/compose`,
        request,
        { headers }
      );
      return response.data;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        if (error.response?.status === 403) {
          throw new Error('You do not have permission to modify this stack');
        }
        if (error.response?.status === 404) {
          throw new Error('Stack not found');
        }
        throw new Error(error.response?.data?.error || 'Failed to update compose configuration');
      }
      throw new Error('Network error occurred');
    }
  }

  static async createStack(serverid: number, name: string, csrfToken?: string): Promise<Stack> {
    try {
      const headers: Record<string, string> = {};
      if (csrfToken) {
        headers['X-CSRF-Token'] = csrfToken;
      }

      const response = await api.post(`/api/v1/servers/${serverid}/stacks`, { name }, { headers });
      return response.data.stack;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        if (error.response?.status === 403) {
          throw new Error('You do not have permission to create stacks on this server');
        }
        if (error.response?.status === 409) {
          throw new Error('A stack with this name already exists');
        }
        throw new Error(error.response?.data?.error || 'Failed to create stack');
      }
      throw new Error('Network error occurred');
    }
  }

  static async canCreateStack(serverid: number, csrfToken?: string): Promise<boolean> {
    try {
      const headers: Record<string, string> = {};
      if (csrfToken) {
        headers['X-CSRF-Token'] = csrfToken;
      }

      const response = await api.get(`/api/v1/servers/${serverid}/stacks/can-create`, { headers });
      return response.data.canCreate ?? false;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        if (error.response?.status === 403) {
          return false;
        }
        throw new Error(error.response?.data?.error || 'Failed to check permissions');
      }
      throw new Error('Network error occurred');
    }
  }
}
