import {
  getApiV1ServersServeridStacks,
  getApiV1ServersServeridStacksStackname,
  patchApiV1ServersServeridStacksStacknameCompose,
} from '../api/generated/stacks/stacks';
import { getApiV1AdminServers, postApiV1AdminServersIdTest } from '../api/generated/admin/admin';
import type { Stack, StackDetails, ServerResponse } from '../api/generated/models';

export class AgentUpdateService {
  static async getServers(): Promise<ServerResponse[]> {
    const response = await getApiV1AdminServers();

    return response.data.data.servers || [];
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
    serviceChanges: Record<string, { image: string }>
  ): Promise<void> {
    await patchApiV1ServersServeridStacksStacknameCompose(serverId, stackName, {
      changes: { service_changes: serviceChanges },
    });
  }

  static async testServerConnection(serverId: number): Promise<boolean> {
    const response = await postApiV1AdminServersIdTest(serverId);
    return response.data.success === true;
  }
}
