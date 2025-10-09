import React, { useState, useEffect } from 'react';
import { Head, Link } from '@inertiajs/react';
import Layout from '../../components/Layout';
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
import NetworkList from '../../components/stack/NetworkList';
import VolumeList from '../../components/stack/VolumeList';
import EnvironmentVariableList from '../../components/stack/EnvironmentVariableList';
import StackStats from '../../components/stack/StackStats';
import LogViewer from '../../components/logs/LogViewer';
import { GlobalOperationsTracker } from '../../components/operations/GlobalOperationsTracker';
import { CompactServiceCard } from '../../components/stack/CompactServiceCard';
import { StackQuickActions } from '../../components/stack/StackQuickActions';
import { FileManager } from '../../components/files/FileManager';
import { OperationRequest } from '../../types/operations';
import { EmptyState } from '../../components/common/EmptyState';
import { LoadingSpinner } from '../../components/common/LoadingSpinner';
import { showToast } from '../../utils/toast';
import {
  generateStackDocumentation,
  downloadMarkdown,
} from '../../utils/generateStackDocumentation';
import { StackImagesTab } from '../../components/stack-images';
import { ComposeEditor, ComposeChanges } from '../../components/compose';
import { useComposeUpdate } from '../../hooks/useComposeUpdate';
import {
  HomeIcon,
  ChevronRightIcon,
  ChevronDownIcon,
  ChevronUpIcon,
  ServerIcon,
  CpuChipIcon,
  CircleStackIcon,
  GlobeAltIcon,
  FolderIcon,
  Cog6ToothIcon,
  DocumentTextIcon,
  ArrowPathIcon,
  ExclamationTriangleIcon,
  PhotoIcon,
  PencilSquareIcon,
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

  return (
    <Layout>
      <Head title={title} />

      {/* Breadcrumb Navigation */}
      <div className="mb-6">
        <nav className={cn('flex items-center space-x-2 text-sm', theme.text.muted)}>
          <Link
            href="/"
            className={cn(
              'flex items-center space-x-1 transition-colors',
              theme.text.muted,
              'hover:text-blue-600 dark:hover:text-blue-400'
            )}
          >
            <HomeIcon className="w-4 h-4" />
            <span>Dashboard</span>
          </Link>
          <ChevronRightIcon className={cn('w-4 h-4', theme.text.subtle)} />
          <Link
            href={`/servers/${serverid}/stacks`}
            className={cn('transition-colors', 'hover:text-blue-600 dark:hover:text-blue-400')}
          >
            {server.name} Stacks
          </Link>
          <ChevronRightIcon className={cn('w-4 h-4', theme.text.subtle)} />
          <span className={cn('font-medium', theme.text.strong)}>{stackname}</span>
        </nav>
      </div>

      {/* Header Section */}
      <div className="mb-8">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
          <div className="flex items-center space-x-4">
            <div
              className={cn(
                'w-16 h-16 rounded-2xl flex items-center justify-center',
                theme.brand.stack
              )}
            >
              <CircleStackIcon className="w-8 h-8 text-white" />
            </div>
            <div>
              <div className="flex items-center space-x-3">
                <h1 className={cn('text-3xl font-bold', theme.brand.titleGradient)}>{stackname}</h1>
                {/* Connection Status */}
                <div
                  className={cn(
                    'flex items-center space-x-2 px-3 py-1 rounded-full text-xs font-medium',
                    connectionStatus === 'connected' && theme.badges.tag.success,
                    connectionStatus === 'connecting' && theme.badges.tag.warning,
                    connectionStatus === 'disconnected' && theme.badges.tag.danger
                  )}
                >
                  <div
                    className={cn(
                      theme.badges.statusDot.base,
                      connectionStatus === 'connected' && theme.badges.statusDot.online,
                      connectionStatus === 'connecting' && 'bg-yellow-500',
                      connectionStatus === 'disconnected' && 'bg-red-500',
                      (connectionStatus === 'connected' || connectionStatus === 'connecting') &&
                        theme.badges.statusDot.pulse
                    )}
                  />
                  <span>
                    {connectionStatus === 'connected'
                      ? 'Live'
                      : connectionStatus === 'connecting'
                        ? 'Connecting'
                        : 'Offline'}
                  </span>
                </div>
              </div>
              <div className="flex items-center space-x-4 mt-2">
                <div className={cn('flex items-center space-x-2 text-sm', theme.text.muted)}>
                  <ServerIcon className="w-4 h-4" />
                  <span>{server.name}</span>
                </div>
                {stackDetails && (
                  <>
                    <div className={cn('w-1 h-1 rounded-full', theme.badges.dot.neutral)} />
                    <div className={cn('text-sm', theme.text.muted)}>
                      {stackDetails.services?.length || 0} services
                    </div>
                    <div className={cn('w-1 h-1 rounded-full', theme.badges.dot.neutral)} />
                    <div className={cn('text-sm', theme.text.muted)}>
                      {stackDetails.services?.reduce(
                        (total, service) => total + (service.containers?.length || 0),
                        0
                      ) || 0}{' '}
                      containers
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center space-x-3">
            {/* Stack Quick Actions */}
            {stackDetails &&
              stackDetails.services &&
              stackPermissions?.permissions?.includes('stacks.manage') && (
                <div className={cn(theme.cards.translucent, 'rounded-xl px-3 py-2')}>
                  <StackQuickActions
                    services={stackDetails.services}
                    onQuickOperation={handleQuickOperation}
                    disabled={quickOperationState.isRunning}
                    isOperationRunning={quickOperationState.isRunning}
                    runningOperation={quickOperationState.operation}
                  />
                </div>
              )}

            {/* Documentation Button */}
            {stackDetails && (
              <button
                onClick={handleGenerateDocumentation}
                className={cn(
                  'flex items-center space-x-2 px-3 py-2 rounded-xl transition-colors duration-200',
                  theme.intent.info.surface,
                  theme.intent.info.textStrong,
                  theme.intent.info.border,
                  'border hover:opacity-90'
                )}
                title="Generate stack documentation"
              >
                <DocumentTextIcon className="w-5 h-5" />
                <span className="text-sm font-medium">Documentation</span>
              </button>
            )}

            {/* Refresh Button */}
            <button
              onClick={() => {
                showToast.info('Refreshing stack data...');
                setIsRefreshing(true);
                refetch();
                refetchNetworks();
                refetchVolumes();
                refetchEnvironment();
                refetchStats();
              }}
              disabled={
                isFetching ||
                networksFetching ||
                volumesFetching ||
                environmentFetching ||
                statsFetching
              }
              className={cn(theme.buttons.secondary)}
            >
              <ArrowPathIcon
                className={cn(
                  'w-4 h-4 mr-2',
                  (isFetching ||
                    networksFetching ||
                    volumesFetching ||
                    environmentFetching ||
                    statsFetching) &&
                    'animate-spin'
                )}
              />
              Refresh All
            </button>

            {/* Operations Button */}
            {stackPermissions?.permissions?.includes('stacks.manage') && (
              <button
                onClick={() => setAdvancedOperationsOpen(true)}
                className={cn(theme.buttons.primary, 'shadow-lg hover:shadow-xl')}
              >
                <Cog6ToothIcon className="w-4 h-4 mr-2" />
                Advanced Operations
              </button>
            )}
          </div>
        </div>
      </div>

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
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <div className={cn(theme.cards.translucent, theme.cards.padded, 'rounded-2xl')}>
              <div className="flex items-center justify-between">
                <div>
                  <p className={cn('text-sm font-medium', theme.text.muted)}>Services</p>
                  <p className={cn('text-2xl font-bold mt-1', theme.text.strong)}>
                    {stackDetails.services?.length || 0}
                  </p>
                </div>
                <div
                  className={cn(
                    'p-3 rounded-xl border',
                    theme.intent.info.surface,
                    theme.intent.info.textStrong,
                    theme.intent.info.border
                  )}
                >
                  <CircleStackIcon className="w-6 h-6" />
                </div>
              </div>
            </div>

            <div className={cn(theme.cards.translucent, theme.cards.padded, 'rounded-2xl')}>
              <div className="flex items-center justify-between">
                <div>
                  <p className={cn('text-sm font-medium', theme.text.muted)}>Containers</p>
                  <p className={cn('text-2xl font-bold mt-1', theme.text.strong)}>
                    {stackDetails.services?.reduce(
                      (total, service) => total + (service.containers?.length || 0),
                      0
                    ) || 0}
                  </p>
                </div>
                <div
                  className={cn(
                    'p-3 rounded-xl border',
                    theme.intent.success.surface,
                    theme.intent.success.textStrong,
                    theme.intent.success.border
                  )}
                >
                  <ServerIcon className="w-6 h-6" />
                </div>
              </div>
            </div>

            <div className={cn(theme.cards.translucent, theme.cards.padded, 'rounded-2xl')}>
              <div className="flex items-center justify-between">
                <div>
                  <p className={cn('text-sm font-medium', theme.text.muted)}>Networks</p>
                  <p className={cn('text-2xl font-bold mt-1', theme.text.strong)}>
                    {networks?.length || 0}
                  </p>
                </div>
                <div className="p-3 rounded-xl bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-200/20 dark:border-purple-800/20">
                  <GlobeAltIcon className="w-6 h-6" />
                </div>
              </div>
            </div>

            <div className={cn(theme.cards.translucent, theme.cards.padded, 'rounded-2xl')}>
              <div className="flex items-center justify-between">
                <div>
                  <p className={cn('text-sm font-medium', theme.text.muted)}>Volumes</p>
                  <p className={cn('text-2xl font-bold mt-1', theme.text.strong)}>
                    {volumes?.length || 0}
                  </p>
                </div>
                <div
                  className={cn(
                    'p-3 rounded-xl border',
                    theme.intent.success.surface,
                    theme.intent.success.textStrong,
                    theme.intent.success.border
                  )}
                >
                  <FolderIcon className="w-6 h-6" />
                </div>
              </div>
            </div>
          </div>

          {/* Stack Info Card */}
          <div className={cn(theme.containers.cardSoft, 'rounded-2xl overflow-hidden')}>
            <div className={cn(theme.containers.sectionHeader, 'px-6 py-4')}>
              <div className="flex items-center space-x-3">
                <div
                  className={cn(
                    'w-10 h-10 rounded-xl flex items-center justify-center',
                    theme.brand.accent
                  )}
                >
                  <DocumentTextIcon className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h2 className={cn('text-lg font-semibold', theme.text.strong)}>
                    Stack Information
                  </h2>
                  <p className={cn('text-sm', theme.text.muted)}>Configuration and metadata</p>
                </div>
              </div>
            </div>
            <div className="p-6">
              <dl className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                <div className="flex flex-col space-y-1">
                  <dt className={cn('text-sm font-medium', theme.text.muted)}>Compose File</dt>
                  <dd
                    className={cn(
                      'text-sm font-mono px-3 py-2 rounded-lg',
                      theme.surface.code,
                      theme.text.strong
                    )}
                  >
                    {stackDetails.compose_file}
                  </dd>
                </div>
                <div className="flex flex-col space-y-1">
                  <dt className={cn('text-sm font-medium', theme.text.muted)}>Stack Path</dt>
                  <dd
                    className={cn(
                      'text-sm font-mono px-3 py-2 rounded-lg',
                      theme.surface.code,
                      theme.text.strong
                    )}
                  >
                    {stackDetails.path}
                  </dd>
                </div>
              </dl>
            </div>
          </div>

          {/* Modern Tab Navigation */}
          <div className={cn(theme.containers.cardSoft, 'rounded-2xl overflow-hidden')}>
            <div className={theme.cards.sectionDivider}>
              <nav className="flex space-x-1 p-2">
                {[
                  { id: 'services', name: 'Services', icon: CircleStackIcon, permission: null },
                  { id: 'networks', name: 'Networks', icon: GlobeAltIcon, permission: null },
                  { id: 'volumes', name: 'Volumes', icon: FolderIcon, permission: null },
                  { id: 'environment', name: 'Environment', icon: Cog6ToothIcon, permission: null },
                  { id: 'images', name: 'Images', icon: PhotoIcon, permission: null },
                  { id: 'stats', name: 'Stats', icon: CpuChipIcon, permission: null },
                  { id: 'logs', name: 'Logs', icon: DocumentTextIcon, permission: 'logs.read' },
                  { id: 'files', name: 'Files', icon: FolderIcon, permission: 'files.read' },
                ]
                  .filter(
                    (tab) =>
                      !tab.permission || stackPermissions?.permissions?.includes(tab.permission)
                  )
                  .map((tab) => {
                    const Icon = tab.icon;
                    return (
                      <button
                        key={tab.id}
                        onClick={() =>
                          setActiveTab(
                            tab.id as
                              | 'services'
                              | 'networks'
                              | 'volumes'
                              | 'environment'
                              | 'images'
                              | 'stats'
                              | 'logs'
                              | 'files'
                          )
                        }
                        className={cn(
                          'flex items-center space-x-2 px-4 py-2 rounded-xl text-sm font-medium transition-all duration-200',
                          activeTab === tab.id
                            ? 'bg-gradient-to-r from-blue-500/10 to-purple-500/10 text-blue-600 dark:text-blue-400 shadow-sm border border-blue-200/20 dark:border-blue-800/20'
                            : cn(
                                theme.text.muted,
                                'hover:bg-slate-100/50 dark:hover:bg-slate-800/50 hover:text-slate-900 dark:hover:text-white'
                              )
                        )}
                      >
                        <Icon className="w-4 h-4" />
                        <span>{tab.name}</span>
                        {activeTab === tab.id && (
                          <div
                            className={cn(
                              theme.badges.statusDot.base,
                              theme.badges.statusDot.online
                            )}
                          />
                        )}
                      </button>
                    );
                  })}
              </nav>
            </div>

            {/* Tab Content */}
            <div className="p-6">
              {activeTab === 'services' && (
                <>
                  {stackDetails.services && stackDetails.services.length > 0 ? (
                    <div className="space-y-4">
                      {/* Expand All / Collapse All Controls */}
                      <div
                        className={cn(
                          'flex items-center justify-between pb-4',
                          theme.cards.sectionDivider
                        )}
                      >
                        <div className="flex items-center space-x-2">
                          <h3 className={cn('text-lg font-semibold', theme.text.strong)}>
                            Services ({stackDetails.services.length})
                          </h3>
                        </div>
                        <div className="flex items-center space-x-2">
                          {stackPermissions?.permissions?.includes('stacks.manage') && (
                            <button
                              onClick={() => setShowComposeEditor(true)}
                              className={cn(
                                'inline-flex items-center px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors',
                                'bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-900/20 dark:hover:bg-indigo-900/30',
                                'text-indigo-700 dark:text-indigo-300 border-indigo-200/50 dark:border-indigo-700/50'
                              )}
                              title="Edit compose configuration"
                            >
                              <PencilSquareIcon className="w-3 h-3 mr-1" />
                              Edit Compose
                            </button>
                          )}
                          <button
                            onClick={handleExpandAll}
                            className={cn(theme.buttons.subtle, theme.buttons.sm)}
                          >
                            <ChevronDownIcon className="w-3 h-3 mr-1" />
                            Expand All
                          </button>
                          <button
                            onClick={handleCollapseAll}
                            className={cn(theme.buttons.subtle, theme.buttons.sm)}
                          >
                            <ChevronUpIcon className="w-3 h-3 mr-1" />
                            Collapse All
                          </button>
                        </div>
                      </div>

                      {stackDetails.services.map((service) => (
                        <CompactServiceCard
                          key={service.name}
                          service={service}
                          onQuickOperation={handleQuickOperation}
                          serverid={serverid}
                          stackname={stackname}
                          isOperationRunning={quickOperationState.isRunning}
                          runningOperation={quickOperationState.operation}
                          isExpanded={expandedServices.has(service.name)}
                          onToggleExpand={() => toggleServiceExpanded(service.name)}
                        />
                      ))}
                    </div>
                  ) : (
                    <EmptyState
                      icon={CircleStackIcon}
                      title="No services found"
                      description="This stack doesn't have any services defined yet."
                      variant="info"
                      size="md"
                    />
                  )}
                </>
              )}

              {activeTab === 'networks' && (
                <NetworkList
                  networks={networks || []}
                  isLoading={networksLoading}
                  error={networksError}
                />
              )}

              {activeTab === 'volumes' && (
                <VolumeList
                  volumes={volumes || []}
                  isLoading={volumesLoading}
                  error={volumesError}
                />
              )}

              {activeTab === 'environment' && (
                <EnvironmentVariableList
                  environmentData={environmentVariables || {}}
                  isLoading={environmentLoading}
                  error={environmentError}
                />
              )}

              {activeTab === 'images' && (
                <StackImagesTab serverid={serverid} stackname={stackname} />
              )}

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
            </div>
          </div>
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
