import React, { useState, useEffect } from 'react';
import { Head } from '@inertiajs/react';
import Layout from '../../components/layout/Layout';
import { cn } from '../../utils/cn';
import { theme } from '../../theme';
import { Server } from '../../types/server';
import { useStackDetails } from '../../hooks/useStackDetails';
import { useStackWebSocket } from '../../hooks/useStackWebSocket';
import { useStackNetworks } from '../../hooks/useStackNetworks';
import { useStackVolumes } from '../../hooks/useStackVolumes';
import { useStackEnvironmentVariables } from '../../hooks/useStackEnvironmentVariables';
import { useStackStats } from '../../hooks/useStackStats';
import { useOperations } from '../../hooks/useOperations';
import { useStackPermissions } from '../../hooks/useStackPermissions';
import NetworkList from '../../components/stacks/resources/NetworkList';
import VolumeList from '../../components/stacks/resources/VolumeList';
import EnvironmentVariableList from '../../components/stacks/resources/EnvironmentVariableList';
import StackStats from '../../components/stacks/StackStats';
import LogViewer from '../../components/logs/LogViewer';
import { GlobalOperationsTracker } from '../../components/operations/GlobalOperationsTracker';
import { FileManager } from '../../components/files/FileManager';
import { OperationRequest } from '../../types/operations';
import { EmptyState } from '../../components/common/EmptyState';
import { LoadingSpinner } from '../../components/common/LoadingSpinner';
import { Breadcrumb } from '../../components/common/Breadcrumb';
import { Tabs } from '../../components/common/Tabs';
import { showToast } from '../../utils/toast';
import {
  generateStackDocumentation,
  downloadMarkdown,
} from '../../utils/generateStackDocumentation';
import { StackImagesTab } from '../../components/stacks/images';
import { ComposeEditor, ComposeChanges } from '../../components/compose';
import { useComposeUpdate } from '../../hooks/useComposeUpdate';
import { StackHeader } from '../../components/stacks/details/StackHeader';
import { StackQuickStats } from '../../components/stacks/details/StackQuickStats';
import { StackInfoCard } from '../../components/stacks/details/StackInfoCard';
import { StackServicesTab } from '../../components/stacks/details/StackServicesTab';
import {
  CircleStackIcon,
  CpuChipIcon,
  GlobeAltIcon,
  FolderIcon,
  Cog6ToothIcon,
  DocumentTextIcon,
  ExclamationTriangleIcon,
  PhotoIcon,
} from '@heroicons/react/24/outline';

interface StackDetailsProps {
  title: string;
  server: Server;
  serverid: number;
  stackname: string;
  permissions: string[];
}

const StackDetails: React.FC<StackDetailsProps> = ({
  title,
  server,
  serverid,
  stackname,
  permissions = [],
}) => {
  const [activeTab, setActiveTab] = useState<
    'services' | 'networks' | 'volumes' | 'environment' | 'images' | 'stats' | 'logs' | 'files'
  >('services');
  const [advancedOperationsOpen, setAdvancedOperationsOpen] = useState(false);
  const [quickOperationState, setQuickOperationState] = useState<{
    isRunning: boolean;
    operation?: string;
  }>({ isRunning: false });
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [expandedServices, setExpandedServices] = useState<Set<string>>(new Set());
  const [showComposeEditor, setShowComposeEditor] = useState(false);

  const {
    data: stackDetails,
    isLoading: loading,
    error,
    isFetching,
    refetch,
  } = useStackDetails({ serverid, stackname });

  const {
    data: networks,
    isLoading: networksLoading,
    error: networksError,
    isFetching: networksFetching,
    refetch: refetchNetworks,
  } = useStackNetworks({ serverid, stackname });

  const {
    data: volumes,
    isLoading: volumesLoading,
    error: volumesError,
    isFetching: volumesFetching,
    refetch: refetchVolumes,
  } = useStackVolumes({ serverid, stackname });

  const {
    data: environmentVariables,
    isLoading: environmentLoading,
    error: environmentError,
    isFetching: environmentFetching,
    refetch: refetchEnvironment,
  } = useStackEnvironmentVariables({ serverid, stackname });

  const {
    data: stackStats,
    isLoading: statsLoading,
    error: statsError,
    isFetching: statsFetching,
    refetch: refetchStats,
  } = useStackStats(serverid, stackname, activeTab === 'stats');

  const { connectionStatus } = useStackWebSocket({
    serverid,
    stackname,
    enabled: true,
  });

  const {
    startOperation,
    operationStatus,
    error: operationError,
  } = useOperations({
    serverid: String(serverid),
    stackname,
    onOperationComplete: (success, _exitCode) => {
      setQuickOperationState({ isRunning: false });

      if (success) {
        showToast.operation.completed('Operation completed successfully');
      } else {
        showToast.error('Operation failed');
      }

      showToast.info('Refreshing stack data...');
      setIsRefreshing(true);
      refetch();
      refetchNetworks();
      refetchVolumes();
      refetchEnvironment();
      refetchStats();
    },
    onError: (error) => {
      console.error('Quick operation error:', error);
      setQuickOperationState({ isRunning: false });
      showToast.error('Operation failed to start');
    },
  });

  const { data: stackPermissions, isLoading: permissionsLoading } = useStackPermissions({
    serverid,
    stackname,
  });

  const composeUpdateMutation = useComposeUpdate({ serverid, stackname });

  useEffect(() => {
    if (stackPermissions) {
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
      if (currentTabPermission && !stackPermissions.permissions.includes(currentTabPermission)) {
        setActiveTab('services');
      }
    }
  }, [stackPermissions, activeTab]);

  useEffect(() => {
    if (
      isRefreshing &&
      !isFetching &&
      !networksFetching &&
      !volumesFetching &&
      !environmentFetching &&
      !statsFetching
    ) {
      const hasErrors = error || networksError || volumesError || environmentError || statsError;

      if (hasErrors) {
        showToast.error('Some data failed to refresh');
      } else {
        showToast.success('Stack data refreshed successfully');
      }

      setIsRefreshing(false);
    }
  }, [
    isRefreshing,
    isFetching,
    networksFetching,
    volumesFetching,
    environmentFetching,
    statsFetching,
    error,
    networksError,
    volumesError,
    environmentError,
    statsError,
  ]);

  const handleQuickOperation = async (operation: OperationRequest) => {
    try {
      const isStackOperation = operation.services.length === 0;
      const operationKey = isStackOperation
        ? `stack:${operation.command}`
        : `${operation.command}:${operation.services[0]}`;

      setQuickOperationState({ isRunning: true, operation: operationKey });

      const targetName = isStackOperation ? `stack ${stackname}` : operation.services[0];
      const action = operation.command.charAt(0).toUpperCase() + operation.command.slice(1);
      showToast.operation.starting(`${action}ing ${targetName}...`);

      await startOperation(operation);
    } catch (error) {
      console.error('Failed to start quick operation:', error);
      setQuickOperationState({ isRunning: false });
      showToast.error('Failed to start operation');
    }
  };

  const handleExpandAll = () => {
    if (stackDetails?.services) {
      setExpandedServices(new Set(stackDetails.services.map((service) => service.name)));
    }
  };

  const handleCollapseAll = () => {
    setExpandedServices(new Set());
  };

  const toggleServiceExpanded = (serviceName: string) => {
    setExpandedServices((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(serviceName)) {
        newSet.delete(serviceName);
      } else {
        newSet.add(serviceName);
      }
      return newSet;
    });
  };

  const handleGenerateDocumentation = () => {
    if (!stackDetails) return;

    try {
      const documentation = generateStackDocumentation(stackDetails);
      downloadMarkdown(documentation, `${stackDetails.name}-documentation.md`);
      showToast.success('Documentation downloaded successfully');
    } catch (error) {
      console.error('Failed to generate documentation:', error);
      showToast.error('Failed to generate documentation');
    }
  };

  const handleComposeUpdate = async (changes: ComposeChanges) => {
    await composeUpdateMutation.mutateAsync(changes);
  };

  const handleRefresh = () => {
    showToast.info('Refreshing stack data...');
    setIsRefreshing(true);
    refetch();
    refetchNetworks();
    refetchVolumes();
    refetchEnvironment();
    refetchStats();
  };

  const canManageStack = stackPermissions?.permissions?.includes('stacks.manage') ?? false;

  return (
    <Layout>
      <Head title={title} />

      {/* Breadcrumb Navigation */}
      <Breadcrumb
        items={[
          {
            label: `${server.name} Stacks`,
            href: `/servers/${serverid}/stacks`,
          },
          {
            label: stackname,
          },
        ]}
      />

      {/* Header Section */}
      {stackDetails && (
        <div className="mb-8">
          <StackHeader
            stackname={stackname}
            server={server}
            connectionStatus={connectionStatus}
            services={stackDetails.services}
            serviceCount={stackDetails.services?.length || 0}
            containerCount={
              stackDetails.services?.reduce(
                (total, service) => total + (service.containers?.length || 0),
                0
              ) || 0
            }
            canManageStack={canManageStack}
            onQuickOperation={handleQuickOperation}
            quickOperationState={quickOperationState}
            onGenerateDocumentation={handleGenerateDocumentation}
            onRefresh={handleRefresh}
            isRefreshing={
              isFetching ||
              networksFetching ||
              volumesFetching ||
              environmentFetching ||
              statsFetching
            }
            onOpenAdvancedOperations={() => setAdvancedOperationsOpen(true)}
          />
        </div>
      )}

      {/* Main Content */}
      {loading ? (
        <LoadingSpinner size="lg" text="Loading stack details..." />
      ) : error ? (
        <EmptyState
          icon={ExclamationTriangleIcon}
          title="Error loading stack details"
          description={error?.message || 'Unable to connect to the Docker stack.'}
          variant="error"
          size="lg"
          action={{
            label: 'Try Again',
            onClick: () => refetch(),
          }}
        />
      ) : stackDetails ? (
        <div className="space-y-8">
          {/* Quick Stats Grid */}
          <StackQuickStats
            serviceCount={stackDetails.services?.length || 0}
            containerCount={
              stackDetails.services?.reduce(
                (total, service) => total + (service.containers?.length || 0),
                0
              ) || 0
            }
            networkCount={networks?.length || 0}
            volumeCount={volumes?.length || 0}
          />

          {/* Stack Info Card */}
          <StackInfoCard composeFile={stackDetails.compose_file} stackPath={stackDetails.path} />

          {/* Modern Tab Navigation */}
          <Tabs
            tabs={[
              { id: 'services', label: 'Services', icon: CircleStackIcon },
              { id: 'networks', label: 'Networks', icon: GlobeAltIcon },
              { id: 'volumes', label: 'Volumes', icon: FolderIcon },
              { id: 'environment', label: 'Environment', icon: Cog6ToothIcon },
              { id: 'images', label: 'Images', icon: PhotoIcon },
              { id: 'stats', label: 'Stats', icon: CpuChipIcon },
              {
                id: 'logs',
                label: 'Logs',
                icon: DocumentTextIcon,
                hidden: !stackPermissions?.permissions?.includes('logs.read'),
              },
              {
                id: 'files',
                label: 'Files',
                icon: FolderIcon,
                hidden: !stackPermissions?.permissions?.includes('files.read'),
              },
            ]}
            activeTab={activeTab}
            onTabChange={(tabId) => setActiveTab(tabId as typeof activeTab)}
            className="rounded-2xl"
          >
            {activeTab === 'services' && (
              <StackServicesTab
                services={stackDetails.services || []}
                serverid={serverid}
                stackname={stackname}
                onQuickOperation={handleQuickOperation}
                quickOperationState={quickOperationState}
                expandedServices={expandedServices}
                onToggleExpand={toggleServiceExpanded}
                onExpandAll={handleExpandAll}
                onCollapseAll={handleCollapseAll}
                canManageStack={canManageStack}
                onEditCompose={() => setShowComposeEditor(true)}
              />
            )}

            {activeTab === 'networks' && (
              <NetworkList
                networks={networks || []}
                isLoading={networksLoading}
                error={networksError}
              />
            )}

            {activeTab === 'volumes' && (
              <VolumeList volumes={volumes || []} isLoading={volumesLoading} error={volumesError} />
            )}

            {activeTab === 'environment' && (
              <EnvironmentVariableList
                environmentData={environmentVariables || {}}
                isLoading={environmentLoading}
                error={environmentError}
              />
            )}

            {activeTab === 'images' && <StackImagesTab serverid={serverid} stackname={stackname} />}

            {activeTab === 'stats' && (
              <StackStats
                containers={stackStats?.containers || []}
                isLoading={statsLoading}
                error={statsError}
              />
            )}

            {activeTab === 'logs' && stackPermissions?.permissions?.includes('logs.read') && (
              <LogViewer
                serverid={serverid}
                stackname={stackname}
                containers={
                  stackStats?.containers?.map((container) => ({
                    name: container.name,
                    service_name: container.service_name,
                  })) || []
                }
              />
            )}

            {activeTab === 'files' && stackPermissions?.permissions?.includes('files.read') && (
              <FileManager
                serverid={serverid}
                stackname={stackname}
                canRead={stackPermissions.permissions.includes('files.read')}
                canWrite={stackPermissions.permissions.includes('files.write')}
              />
            )}
          </Tabs>
        </div>
      ) : (
        <EmptyState
          icon={ExclamationTriangleIcon}
          title="No stack details available"
          description="Unable to load information for this stack."
          variant="warning"
          size="lg"
        />
      )}

      {/* Advanced Operations Modal */}
      {advancedOperationsOpen && (
        <GlobalOperationsTracker
          advancedMode={{
            serverid: String(serverid),
            stackname,
            services:
              stackDetails?.services?.map((service) => ({
                name: service.name,
                service_name: service.name,
              })) || [],
            onClose: () => setAdvancedOperationsOpen(false),
          }}
        />
      )}

      {/* Compose Editor Modal */}
      {showComposeEditor && stackDetails && stackDetails.services && (
        <ComposeEditor
          services={stackDetails.services}
          serverid={serverid}
          stackname={stackname}
          onUpdate={handleComposeUpdate}
          onClose={() => setShowComposeEditor(false)}
        />
      )}
    </Layout>
  );
};

export default StackDetails;
