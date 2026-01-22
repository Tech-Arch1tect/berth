import { useState, useCallback, useEffect } from 'react';
import { ServerWithAgentStack } from '../types/agent-update';
import { AgentUpdateService } from '../services/agentUpdateService';

interface UseAgentDiscoveryOptions {
  csrfToken?: string;
  autoDiscover?: boolean;
}

interface UseAgentDiscoveryReturn {
  servers: ServerWithAgentStack[];
  loading: boolean;
  error: string | null;
  discover: () => Promise<void>;
  agentServers: ServerWithAgentStack[];
}

export function useAgentDiscovery({
  csrfToken,
  autoDiscover = true,
}: UseAgentDiscoveryOptions = {}): UseAgentDiscoveryReturn {
  const [servers, setServers] = useState<ServerWithAgentStack[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const discover = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const serversList = await AgentUpdateService.getServers(csrfToken);
      const serversWithAgent: ServerWithAgentStack[] = [];

      for (const server of serversList) {
        if (!server.is_active) {
          serversWithAgent.push({
            serverId: server.id,
            serverName: server.name,
            serverHost: server.host,
            hasAgentStack: false,
          });
          continue;
        }

        try {
          const stacks = await AgentUpdateService.getServerStacks(server.id);
          const agentStack = stacks.find((s) => s.name === 'berth-agent');

          let currentImages: ServerWithAgentStack['currentImages'];

          if (agentStack) {
            try {
              const details = await AgentUpdateService.getStackDetails(server.id, 'berth-agent');
              const services = details.services || [];
              const images: Record<string, string> = {};
              for (const svc of services) {
                if (svc.name && svc.image) {
                  images[svc.name] = svc.image;
                }
              }
              if (Object.keys(images).length > 0) {
                currentImages = images as ServerWithAgentStack['currentImages'];
              }
            } catch {
              console.log('Failed to get details, continuing without images');
            }
          }

          serversWithAgent.push({
            serverId: server.id,
            serverName: server.name,
            serverHost: server.host,
            hasAgentStack: !!agentStack,
            currentImages,
          });
        } catch {
          serversWithAgent.push({
            serverId: server.id,
            serverName: server.name,
            serverHost: server.host,
            hasAgentStack: false,
          });
        }
      }

      setServers(serversWithAgent);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to discover servers');
    } finally {
      setLoading(false);
    }
  }, [csrfToken]);

  useEffect(() => {
    if (autoDiscover) {
      discover();
    }
  }, [autoDiscover, discover]);

  const agentServers = servers.filter((s) => s.hasAgentStack);

  return {
    servers,
    loading,
    error,
    discover,
    agentServers,
  };
}
