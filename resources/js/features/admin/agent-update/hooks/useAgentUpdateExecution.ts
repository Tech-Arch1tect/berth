import { useState, useCallback, useRef, useMemo } from 'react';
import { ServerWithAgentStack, UpdateStatus, AgentUpdateProgress } from '../types';
import { AgentUpdateService } from '../services/agentUpdateService';
import { streamOperation } from '../../../operations/api/operationStream';
import { postApiV1ServersServeridStacksStacknameOperations } from '../../../../api/generated/operations/operations';
import type { OperationRequest } from '../../../../api/generated/models';

export const TIMEOUTS = {
  WEBSOCKET_OPERATION: 300_000,
  AFTER_COMPOSE_UPDATE: 5_000,
  BETWEEN_PULLS: 5_000,
  AFTER_ALL_PULLS: 10_000,
  AFTER_MAIN_AGENT_RESTART: 20_000,
  BETWEEN_SERVICE_RESTARTS: 10_000,
} as const;

export const AGENT_SERVICES = [
  { name: 'berth-agent', image: 'techarchitect/berth-agent' },
  { name: 'berth-updater', image: 'techarchitect/berth-agent' },
  { name: 'berth-socket-proxy', image: 'techarchitect/berth-agent' },
  { name: 'berth-grype-scanner', image: 'techarchitect/berth-agent-grype' },
];

interface UpdateConfig {
  changeTag: boolean;
  pullImages: boolean;
  newTag: string;
}

interface UseAgentUpdateExecutionReturn {
  isUpdating: boolean;
  progress: AgentUpdateProgress[];
  currentServerIndex: number;
  startUpdate: (servers: ServerWithAgentStack[], config: UpdateConfig) => Promise<void>;
  cancelUpdate: () => void;
  resetProgress: () => void;
  successCount: number;
  failedCount: number;
  skippedCount: number;
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export function useAgentUpdateExecution(): UseAgentUpdateExecutionReturn {
  const [isUpdating, setIsUpdating] = useState(false);
  const [progress, setProgress] = useState<AgentUpdateProgress[]>([]);
  const [currentServerIndex, setCurrentServerIndex] = useState(-1);
  const cancelledRef = useRef(false);

  const executeOperation = useCallback(
    async (
      serverId: number,
      stackName: string,
      request: Pick<OperationRequest, 'command'> & Partial<OperationRequest>
    ): Promise<boolean> => {
      let operationId: string | undefined;
      try {
        const response = await postApiV1ServersServeridStacksStacknameOperations(
          serverId,
          stackName,
          {
            command: request.command,
            options: request.options ?? [],
            services: request.services ?? [],
          }
        );
        operationId = response.data?.operationId;
      } catch (error) {
        console.error('Failed to start operation:', error);
        return false;
      }
      if (!operationId) {
        return false;
      }

      return new Promise((resolve) => {
        let settled = false;
        const settle = (success: boolean) => {
          if (settled) return;
          settled = true;
          clearTimeout(timeout);
          stream.close();
          resolve(success);
        };

        const timeout = setTimeout(() => settle(false), TIMEOUTS.WEBSOCKET_OPERATION);

        const stream = streamOperation(serverId, stackName, operationId, {
          onComplete: (success) => settle(success),
          onError: () => settle(false),
          onClose: () => settle(false),
        });
      });
    },
    []
  );

  const updateSingleServer = useCallback(
    async (server: ServerWithAgentStack, config: UpdateConfig): Promise<boolean> => {
      const { changeTag, pullImages, newTag } = config;

      const log = (msg: string) => {
        const time = new Date().toLocaleTimeString('en-GB', { hour12: false });
        console.log(`[${time}] [AgentUpdate] [${server.serverName}] ${msg}`);
      };

      const updateProgress = (status: UpdateStatus, message?: string) => {
        log(`Status: ${status}${message ? ` - ${message}` : ''}`);
        setProgress((prev) =>
          prev.map((p) => (p.serverId === server.serverId ? { ...p, status, message } : p))
        );
      };

      try {
        log(`Starting update (changeTag=${changeTag}, pullImages=${pullImages}, newTag=${newTag})`);

        if (changeTag && newTag) {
          updateProgress('updating_image', 'Updating compose file with new image tags...');

          const serviceChanges: Record<string, { image: string }> = {};
          for (const svc of AGENT_SERVICES) {
            const newImage = `${svc.image}:${newTag}`;
            serviceChanges[svc.name] = { image: newImage };
            log(`Setting ${svc.name} image to ${newImage}`);
          }

          await AgentUpdateService.updateComposeImages(
            server.serverId,
            'berth-agent',
            serviceChanges
          );
          log('Image tags updated successfully');

          log('Waiting after compose update...');
          await sleep(TIMEOUTS.AFTER_COMPOSE_UPDATE);
        }

        if (pullImages) {
          log('Starting image pulls...');
          for (let i = 0; i < AGENT_SERVICES.length; i++) {
            const svc = AGENT_SERVICES[i];
            updateProgress('pulling', `Pulling ${svc.name}... (${i + 1}/${AGENT_SERVICES.length})`);

            log(`Pulling ${svc.name}...`);
            const pullSuccess = await executeOperation(server.serverId, 'berth-agent', {
              command: 'pull',
              services: [svc.name],
            });

            if (!pullSuccess) {
              throw new Error(`Pull failed for ${svc.name}`);
            }
            log(`Pull completed for ${svc.name}`);

            if (i < AGENT_SERVICES.length - 1) {
              log('Waiting before next pull...');
              await sleep(TIMEOUTS.BETWEEN_PULLS);
            }
          }

          log('All pulls complete. Waiting before starting restarts...');
          updateProgress('pulling', 'All images pulled. Preparing to restart services...');
          await sleep(TIMEOUTS.AFTER_ALL_PULLS);
        }

        log('Starting service restarts...');
        for (let i = 0; i < AGENT_SERVICES.length; i++) {
          const svc = AGENT_SERVICES[i];
          const isMainAgent = svc.name === 'berth-agent';

          updateProgress(
            'restarting',
            `Restarting ${svc.name}... (${i + 1}/${AGENT_SERVICES.length})`
          );

          log(`Running 'up' for ${svc.name}...`);
          const upSuccess = await executeOperation(server.serverId, 'berth-agent', {
            command: 'up',
            services: [svc.name],
          });

          if (!upSuccess) {
            throw new Error(`Up failed for ${svc.name}`);
          }
          log(`'up' completed for ${svc.name}`);

          if (isMainAgent) {
            log('Main agent restarted. Waiting for sidecar handoff to complete...');
            updateProgress('health_check', 'Waiting for agent restart (sidecar handoff)...');
            await sleep(TIMEOUTS.AFTER_MAIN_AGENT_RESTART);
          } else if (i < AGENT_SERVICES.length - 1) {
            log('Waiting before next service restart...');
            await sleep(TIMEOUTS.BETWEEN_SERVICE_RESTARTS);
          }
        }

        log('Running health check...');
        updateProgress('health_check', 'Checking agent health...');
        const healthOk = await AgentUpdateService.testServerConnection(server.serverId);

        if (!healthOk) {
          throw new Error('Agent health check failed - agent may not have restarted properly');
        }

        log('Health check passed. Update complete!');
        updateProgress('success');
        return true;
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : 'Unknown error';
        log(`ERROR: ${errorMsg}`);
        updateProgress('failed', errorMsg);
        return false;
      }
    },
    [executeOperation]
  );

  const startUpdate = useCallback(
    async (servers: ServerWithAgentStack[], config: UpdateConfig) => {
      setProgress(
        servers.map((s) => ({
          serverId: s.serverId,
          serverName: s.serverName,
          status: 'pending' as UpdateStatus,
        }))
      );

      setIsUpdating(true);
      cancelledRef.current = false;

      for (let i = 0; i < servers.length; i++) {
        if (cancelledRef.current) {
          setProgress((prev) =>
            prev.map((p, idx) => (idx > i ? { ...p, status: 'skipped' as UpdateStatus } : p))
          );
          break;
        }

        setCurrentServerIndex(i);
        const success = await updateSingleServer(servers[i], config);

        if (!success) {
          setProgress((prev) =>
            prev.map((p, idx) => (idx > i ? { ...p, status: 'skipped' as UpdateStatus } : p))
          );
          break;
        }
      }

      setIsUpdating(false);
      setCurrentServerIndex(-1);
    },
    [updateSingleServer]
  );

  const cancelUpdate = useCallback(() => {
    cancelledRef.current = true;
  }, []);

  const resetProgress = useCallback(() => {
    setProgress([]);
    setCurrentServerIndex(-1);
  }, []);

  const successCount = useMemo(
    () => progress.filter((p) => p.status === 'success').length,
    [progress]
  );
  const failedCount = useMemo(
    () => progress.filter((p) => p.status === 'failed').length,
    [progress]
  );
  const skippedCount = useMemo(
    () => progress.filter((p) => p.status === 'skipped').length,
    [progress]
  );

  return {
    isUpdating,
    progress,
    currentServerIndex,
    startUpdate,
    cancelUpdate,
    resetProgress,
    successCount,
    failedCount,
    skippedCount,
  };
}
