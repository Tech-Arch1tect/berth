import axios from 'axios';
import {
  getApiV1ServersServeridStacks,
  getApiV1ServersServeridStacksStacknameNetworks,
  getApiV1ServersServeridStacksStacknameVolumes,
  getApiV1ServersServeridStacksStacknameEnvironment,
  getApiV1ServersServeridStacksStacknamePermissions,
  getApiV1ServersServeridStacksStacknameImages,
  getApiV1ServersServeridStacksCanCreate,
  postApiV1ServersServeridStacks,
} from '../api/generated/stacks/stacks';
import type {
  GetApiV1ServersServeridStacks200StacksItem,
  GetApiV1ServersServeridStacksStacknameNetworks200NetworksItem,
  GetApiV1ServersServeridStacksStacknameVolumes200VolumesItem,
  GetApiV1ServersServeridStacksStacknameEnvironment200,
  GetApiV1ServersServeridStacksStacknameImages200ImagesItem,
  GetApiV1ServersServeridStacksStacknamePermissions200,
} from '../api/generated/models';
import { RawComposeConfig, UpdateComposeRequest, UpdateComposeResponse } from '../types/compose';

const api = axios.create({
  headers: {
    'Content-Type': 'application/json',
    'X-Requested-With': 'XMLHttpRequest',
  },
});

export class StackService {
  static async getServerStacks(
    serverid: number
  ): Promise<GetApiV1ServersServeridStacks200StacksItem[]> {
    try {
      const response = await getApiV1ServersServeridStacks(serverid);
      const stacks = response.data.stacks || [];
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
    stackname: string
  ): Promise<GetApiV1ServersServeridStacksStacknameNetworks200NetworksItem[]> {
    try {
      const response = await getApiV1ServersServeridStacksStacknameNetworks(serverid, stackname);
      return response.data.networks || [];
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
    stackname: string
  ): Promise<GetApiV1ServersServeridStacksStacknameVolumes200VolumesItem[]> {
    try {
      const response = await getApiV1ServersServeridStacksStacknameVolumes(serverid, stackname);
      return response.data.volumes || [];
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
    unmask: boolean = false
  ): Promise<GetApiV1ServersServeridStacksStacknameEnvironment200> {
    try {
      const params = unmask ? { unmask: 'true' } : undefined;
      const response = await getApiV1ServersServeridStacksStacknameEnvironment(
        serverid,
        stackname,
        params
      );
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
    stackname: string
  ): Promise<GetApiV1ServersServeridStacksStacknamePermissions200> {
    try {
      const response = await getApiV1ServersServeridStacksStacknamePermissions(serverid, stackname);
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
    stackname: string
  ): Promise<GetApiV1ServersServeridStacksStacknameImages200ImagesItem[]> {
    try {
      const response = await getApiV1ServersServeridStacksStacknameImages(serverid, stackname);
      return response.data.images || [];
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

  static async createStack(
    serverid: number,
    name: string
  ): Promise<GetApiV1ServersServeridStacks200StacksItem> {
    try {
      const response = await postApiV1ServersServeridStacks(serverid, { name });
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

  static async canCreateStack(serverid: number): Promise<boolean> {
    try {
      const response = await getApiV1ServersServeridStacksCanCreate(serverid);
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
