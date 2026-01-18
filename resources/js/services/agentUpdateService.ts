import axios from 'axios';

interface Server {
  id: number;
  name: string;
  host: string;
  port: number;
  is_active: boolean;
}

interface Stack {
  name: string;
  services?: { name: string; image: string }[];
}

interface StackDetails {
  stack?: { services?: { name: string; image: string }[] };
  services?: { name: string; image: string }[];
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

  static async getServerStacks(serverId: number, csrfToken?: string): Promise<Stack[]> {
    const headers: Record<string, string> = {};
    if (csrfToken) {
      headers['X-CSRF-Token'] = csrfToken;
    }

    const response = await api.get(`/api/v1/servers/${serverId}/stacks`, { headers });
    return response.data.stacks || [];
  }

  static async getStackDetails(
    serverId: number,
    stackName: string,
    csrfToken?: string
  ): Promise<StackDetails> {
    const headers: Record<string, string> = {};
    if (csrfToken) {
      headers['X-CSRF-Token'] = csrfToken;
    }

    const response = await api.get(`/api/v1/servers/${serverId}/stacks/${stackName}`, { headers });
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
