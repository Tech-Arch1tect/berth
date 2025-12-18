import { useState, useCallback } from 'react';
import { useStackDetails } from './useStackDetails';
import { useStackNetworks } from './useStackNetworks';
import { useStackVolumes } from './useStackVolumes';
import { useStackEnvironmentVariables } from './useStackEnvironmentVariables';
import { useStackStats } from './useStackStats';
import { useStackWebSocket } from './useStackWebSocket';
import { useOperations } from './useOperations';
import { useStackPermissions } from './useStackPermissions';
import { useComposeUpdate } from './useComposeUpdate';
import { showToast } from '../utils/toast';
import { OperationRequest } from '../types/operations';
import { ComposeChanges } from '../components/compose';
import {
  generateStackDocumentation,
  downloadMarkdown,
  copyToClipboard,
} from '../utils/generateStackDocumentation';

export type StackTab =
  | 'services'
  | 'networks'
  | 'volumes'
  | 'environment'
  | 'images'
  | 'stats'
  | 'logs'
  | 'files';

export interface UseStackDetailsPageOptions {
  serverid: number;
  stackname: string;
}

export function useStackDetailsPage({ serverid, stackname }: UseStackDetailsPageOptions) {
  const [activeTab, setActiveTab] = useState<StackTab>('services');
  const [advancedOperationsOpen, setAdvancedOperationsOpen] = useState(false);
  const [quickOperationState, setQuickOperationState] = useState<{
    isRunning: boolean;
    operation?: string;
  }>({ isRunning: false });
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [expandedServices, setExpandedServices] = useState<Set<string>>(new Set());
  const [showComposeEditor, setShowComposeEditor] = useState(false);

  const stackDetailsQuery = useStackDetails({ serverid, stackname });
  const networksQuery = useStackNetworks({ serverid, stackname });
  const volumesQuery = useStackVolumes({ serverid, stackname });
  const environmentVariablesQuery = useStackEnvironmentVariables({ serverid, stackname });
  const stackStatsQuery = useStackStats(serverid, stackname, activeTab === 'stats');
  const { connectionStatus } = useStackWebSocket({ serverid, stackname, enabled: true });
  const stackPermissionsQuery = useStackPermissions({ serverid, stackname });

  const [prevPermissions, setPrevPermissions] = useState(stackPermissionsQuery.data);

  const operations = useOperations({
    serverid: String(serverid),
    stackname,
    onOperationComplete: (success, _exitCode, summary) => {
      setQuickOperationState({ isRunning: false });

      if (success) {
        showToast.operation.completed(summary || 'Operation completed successfully');
      } else {
        showToast.error('Operation failed');
      }

      showToast.info('Refreshing stack data...');
      setIsRefreshing(true);
      stackDetailsQuery.refetch();
      networksQuery.refetch();
      volumesQuery.refetch();
      environmentVariablesQuery.refetch();
      stackStatsQuery.refetch();
    },
    onError: (error) => {
      setQuickOperationState({ isRunning: false });
      showToast.error(error || 'Operation failed to start');
    },
  });

  const composeUpdateMutation = useComposeUpdate({ serverid, stackname });

  if (stackPermissionsQuery.data !== prevPermissions) {
    setPrevPermissions(stackPermissionsQuery.data);
    if (stackPermissionsQuery.data) {
      const tabPermissionMap: Record<string, string | null> = {
        services: null,
        networks: null,
        volumes: null,
        environment: null,
        images: null,
        stats: null,
        logs: 'logs.read',
        files: 'files.read',
      };

      const currentTabPermission = tabPermissionMap[activeTab];
      if (
        currentTabPermission &&
        !stackPermissionsQuery.data.permissions.includes(currentTabPermission)
      ) {
        setActiveTab('services');
      }
    }
  }

  const allFetchesComplete =
    isRefreshing &&
    !stackDetailsQuery.isFetching &&
    !networksQuery.isFetching &&
    !volumesQuery.isFetching &&
    !environmentVariablesQuery.isFetching &&
    !stackStatsQuery.isFetching;

  const [prevAllFetchesComplete, setPrevAllFetchesComplete] = useState(false);

  if (allFetchesComplete !== prevAllFetchesComplete) {
    setPrevAllFetchesComplete(allFetchesComplete);
    if (allFetchesComplete) {
      const hasErrors =
        stackDetailsQuery.error ||
        networksQuery.error ||
        volumesQuery.error ||
        environmentVariablesQuery.error ||
        stackStatsQuery.error;

      if (hasErrors) {
        showToast.error('Some data failed to refresh');
      } else {
        showToast.success('Stack data refreshed successfully');
      }

      setIsRefreshing(false);
    }
  }

  const handleQuickOperation = useCallback(
    async (operation: OperationRequest) => {
      try {
        const isStackOperation = operation.services.length === 0;
        const operationKey = isStackOperation
          ? `stack:${operation.command}`
          : `${operation.command}:${operation.services[0]}`;

        setQuickOperationState({ isRunning: true, operation: operationKey });

        const targetName = isStackOperation ? `stack ${stackname}` : operation.services[0];
        const action = operation.command.charAt(0).toUpperCase() + operation.command.slice(1);
        showToast.operation.starting(`${action}ing ${targetName}...`);

        await operations.startOperation(operation);
      } catch (error) {
        console.error('Failed to start quick operation:', error);
        setQuickOperationState({ isRunning: false });
        showToast.error('Failed to start operation');
      }
    },
    [operations, stackname]
  );

  const handleRefreshAll = useCallback(() => {
    showToast.info('Refreshing stack data...');
    setIsRefreshing(true);
    stackDetailsQuery.refetch();
    networksQuery.refetch();
    volumesQuery.refetch();
    environmentVariablesQuery.refetch();
    stackStatsQuery.refetch();
  }, [stackDetailsQuery, networksQuery, volumesQuery, environmentVariablesQuery, stackStatsQuery]);

  const handleExpandAll = useCallback(() => {
    if (stackDetailsQuery.data?.services) {
      setExpandedServices(new Set(stackDetailsQuery.data.services.map((service) => service.name)));
    }
  }, [stackDetailsQuery.data]);

  const handleCollapseAll = useCallback(() => {
    setExpandedServices(new Set());
  }, []);

  const toggleServiceExpanded = useCallback((serviceName: string) => {
    setExpandedServices((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(serviceName)) {
        newSet.delete(serviceName);
      } else {
        newSet.add(serviceName);
      }
      return newSet;
    });
  }, []);

  const handleCopyDocumentation = useCallback(async () => {
    if (!stackDetailsQuery.data) return;

    try {
      const documentation = generateStackDocumentation(stackDetailsQuery.data);
      await copyToClipboard(documentation);
      showToast.success('Documentation copied to clipboard');
    } catch (error) {
      console.error('Failed to copy documentation:', error);
      showToast.error('Failed to copy documentation');
    }
  }, [stackDetailsQuery.data]);

  const handleDownloadDocumentation = useCallback(() => {
    if (!stackDetailsQuery.data) return;

    try {
      const documentation = generateStackDocumentation(stackDetailsQuery.data);
      downloadMarkdown(documentation, `${stackDetailsQuery.data.name}-documentation.md`);
      showToast.success('Documentation downloaded successfully');
    } catch (error) {
      console.error('Failed to download documentation:', error);
      showToast.error('Failed to download documentation');
    }
  }, [stackDetailsQuery.data]);

  const handleComposeUpdate = useCallback(
    async (changes: ComposeChanges) => {
      await composeUpdateMutation.mutateAsync(changes);
    },
    [composeUpdateMutation]
  );

  return {
    activeTab,
    setActiveTab,
    advancedOperationsOpen,
    setAdvancedOperationsOpen,
    quickOperationState,
    isRefreshing,
    expandedServices,
    showComposeEditor,
    setShowComposeEditor,

    stackDetails: stackDetailsQuery.data,
    networks: networksQuery.data,
    volumes: volumesQuery.data,
    environmentVariables: environmentVariablesQuery.data,
    stackStats: stackStatsQuery.data,
    stackPermissions: stackPermissionsQuery.data,
    connectionStatus,

    loading: stackDetailsQuery.isLoading,
    networksLoading: networksQuery.isLoading,
    volumesLoading: volumesQuery.isLoading,
    environmentLoading: environmentVariablesQuery.isLoading,
    statsLoading: stackStatsQuery.isLoading,
    permissionsLoading: stackPermissionsQuery.isLoading,

    isFetching:
      stackDetailsQuery.isFetching ||
      networksQuery.isFetching ||
      volumesQuery.isFetching ||
      environmentVariablesQuery.isFetching ||
      stackStatsQuery.isFetching,

    error: stackDetailsQuery.error,
    networksError: networksQuery.error,
    volumesError: volumesQuery.error,
    environmentError: environmentVariablesQuery.error,
    statsError: stackStatsQuery.error,

    handleQuickOperation,
    handleRefreshAll,
    handleExpandAll,
    handleCollapseAll,
    toggleServiceExpanded,
    handleCopyDocumentation,
    handleDownloadDocumentation,
    handleComposeUpdate,
    refetch: stackDetailsQuery.refetch,
  };
}
