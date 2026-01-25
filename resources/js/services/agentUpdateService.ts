import axios from 'axios';
import {
  getApiV1ServersServeridStacks,
  getApiV1ServersServeridStacksStackname,
} from '../api/generated/stacks/stacks';
import type { Stack, StackDetails } from '../api/generated/models';

interface Server {
  id: number;
  name: string;
  host: string;
  port: number;
  is_active: boolean;
}

const api = axios.create({
  headers: {
    'Content-Type': 'application/json',
    'X-Requested-With': 'XMLHttpRequest',
  },
});

export class AgentUpdateService {
  static async getServers(csrfToken?: string): Promise<Server[]> {
    const headers: Record<string, string> = {};
    if (csrfToken) {
      headers['X-CSRF-Token'] = csrfToken;
    }

    const response = await api.get('/api/v1/admin/servers', { headers });
    return response.data.servers || [];
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

  static async testServerConnection(serverId: number, csrfToken?: string): Promise<boolean> {
    const headers: Record<string, string> = {};
    if (csrfToken) {
      headers['X-CSRF-Token'] = csrfToken;
    }

    const response = await api.post(`/api/v1/admin/servers/${serverId}/test`, {}, { headers });
    return response.status === 200;
  }
}
