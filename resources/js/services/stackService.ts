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
  getApiV1ServersServeridStacksStacknameCompose,
  patchApiV1ServersServeridStacksStacknameCompose,
} from '../api/generated/stacks/stacks';
import type {
  Stack,
  Network,
  Volume,
  StackEnvironmentResponseServices,
  ContainerImageDetails,
  StackPermissionsResponse,
  RawComposeConfig,
  UpdateComposeRequest,
  UpdateComposeResponse,
} from '../api/generated/models';

export class StackService {
  static async getServerStacks(serverid: number): Promise<Stack[]> {
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

  static async getStackNetworks(serverid: number, stackname: string): Promise<Network[]> {
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

  static async getStackVolumes(serverid: number, stackname: string): Promise<Volume[]> {
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
  ): Promise<StackEnvironmentResponseServices> {
    try {
      const params = unmask ? { unmask: 'true' } : undefined;
      const response = await getApiV1ServersServeridStacksStacknameEnvironment(
        serverid,
        stackname,
        params
      );
      return response.data?.services || {};
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
  ): Promise<StackPermissionsResponse> {
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
  ): Promise<ContainerImageDetails[]> {
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

  static async getComposeConfig(serverid: number, stackname: string): Promise<RawComposeConfig> {
    try {
      const response = await getApiV1ServersServeridStacksStacknameCompose(serverid, stackname);
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
    request: UpdateComposeRequest
  ): Promise<UpdateComposeResponse> {
    try {
      const response = await patchApiV1ServersServeridStacksStacknameCompose(
        serverid,
        stackname,
        request
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

  static async createStack(serverid: number, name: string): Promise<Stack> {
    try {
      const response = await postApiV1ServersServeridStacks(serverid, { name });
      if (!response.data.stack) {
        throw new Error('Failed to create stack: no stack data returned');
      }
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
