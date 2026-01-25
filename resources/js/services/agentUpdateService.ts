import axios from 'axios';
import {
  getApiV1ServersServeridStacks,
  getApiV1ServersServeridStacksStackname,
} from '../api/generated/stacks/stacks';
import { getApiV1AdminServers, postApiV1AdminServersIdTest } from '../api/generated/admin/admin';
import type { Stack, StackDetails, ServerResponse } from '../api/generated/models';

const api = axios.create({
  headers: {
    'Content-Type': 'application/json',
    'X-Requested-With': 'XMLHttpRequest',
  },
});

export class AgentUpdateService {
  static async getServers(): Promise<ServerResponse[]> {
    const response = await getApiV1AdminServers();

    return (response as { data?: { servers?: ServerResponse[] } }).data?.servers || [];
  }

  static async getServerStacks(serverId: number): Promise<Stack[]> {
    const response = await getApiV1ServersServeridStacks(serverId);
    return response.data.stacks || [];
  }

  static async getStackDetails(serverId: number, stackName: string): Promise<StackDetails> {
    const response = await getApiV1ServersServeridStacksStackname(serverId, stackName);
    return response.data;
  }

  static async updateComposeImages(
    serverId: number,
    stackName: string,
    serviceChanges: Record<string, { image: string }>,
    csrfToken?: string
  ): Promise<void> {
    const headers: Record<string, string> = {};
    if (csrfToken) {
      headers['X-CSRF-Token'] = csrfToken;
    }

    await api.patch(
      `/api/v1/servers/${serverId}/stacks/${stackName}/compose`,
      { changes: { service_changes: serviceChanges } },
      { headers }
    );
  }

  static async testServerConnection(serverId: number): Promise<boolean> {
    const response = await postApiV1AdminServersIdTest(serverId);
    return (response as { success?: boolean }).success === true;
  }
}
