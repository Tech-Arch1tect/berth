import React, { useState, useEffect } from 'react';
import { Head, Link } from '@inertiajs/react';
import Layout from '../../components/Layout';
import { Server } from '../../types/server';
import { useStackDetails } from '../../hooks/useStackDetails';
import { useStackWebSocket } from '../../hooks/useStackWebSocket';
import { useStackNetworks } from '../../hooks/useStackNetworks';
import { useStackVolumes } from '../../hooks/useStackVolumes';
import { useStackEnvironmentVariables } from '../../hooks/useStackEnvironmentVariables';
import { useStackStats } from '../../hooks/useStackStats';
import { useOperations } from '../../hooks/useOperations';
import NetworkList from '../../components/stack/NetworkList';
import VolumeList from '../../components/stack/VolumeList';
import EnvironmentVariableList from '../../components/stack/EnvironmentVariableList';
import StackStats from '../../components/stack/StackStats';
import LogViewer from '../../components/logs/LogViewer';
import { OperationsModal } from '../../components/operations/OperationsModal';
import { ServiceQuickActions } from '../../components/stack/ServiceQuickActions';
import { FileManager } from '../../components/files/FileManager';
import { OperationRequest } from '../../types/operations';
import { showToast } from '../../utils/toast';
import {
  HomeIcon,
  ChevronRightIcon,
  ServerIcon,
  CpuChipIcon,
  CircleStackIcon,
  GlobeAltIcon,
  FolderIcon,
  Cog6ToothIcon,
  DocumentTextIcon,
  ArrowPathIcon,
  ExclamationTriangleIcon,
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
    'services' | 'networks' | 'volumes' | 'environment' | 'stats' | 'logs' | 'files'
  >('services');
  const [operationsModalOpen, setOperationsModalOpen] = useState(false);
  const [quickOperationState, setQuickOperationState] = useState<{
    isRunning: boolean;
    operation?: string;
  }>({ isRunning: false });
  const [isRefreshing, setIsRefreshing] = useState(false);

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
  } = useStackStats(serverid, stackname, activeTab === 'stats' || activeTab === 'logs');

  const { connectionStatus } = useStackWebSocket({
    serverid,
    stackname,
    enabled: true,
  });

  const { startOperation } = useOperations({
    serverid: String(serverid),
    stackname,
    onOperationComplete: (success, _exitCode) => {
      const currentOp = quickOperationState.operation;
      setQuickOperationState({ isRunning: false });

      if (currentOp) {
        const [commandOrStack, serviceName] = currentOp.split(':');
        const isStackOperation = commandOrStack === 'stack';
        const command = isStackOperation ? serviceName : commandOrStack;
        const targetName = isStackOperation ? `stack ${stackname}` : serviceName;
        const action = command.charAt(0).toUpperCase() + command.slice(1);

        if (success) {
          showToast.operation.completed(`${action} completed successfully for ${targetName}`);
        } else {
          showToast.error(`${action} failed for ${targetName}`);
        }
      } else {
        if (success) {
          showToast.operation.completed('Operation completed successfully');
        } else {
          showToast.error('Operation failed');
        }
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

  const getContainerStatusColor = (state: string) => {
    switch (state.toLowerCase()) {
      case 'running':
        return 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400';
      case 'stopped':
        return 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400';
      case 'paused':
        return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-400';
      case 'restarting':
        return 'bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-400';
      case 'not created':
        return 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-500';
      case 'exited':
        return 'bg-orange-100 text-orange-800 dark:bg-orange-900/20 dark:text-orange-400';
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-900/20 dark:text-gray-400';
    }
  };

  return (
    <Layout>
      <Head title={title} />

      {/* Breadcrumb Navigation */}
      <div className="mb-6">
        <nav className="flex items-center space-x-2 text-sm text-slate-600 dark:text-slate-400">
          <Link
            href="/"
            className="flex items-center space-x-1 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
          >
            <HomeIcon className="w-4 h-4" />
            <span>Dashboard</span>
          </Link>
          <ChevronRightIcon className="w-4 h-4 text-slate-400" />
          <Link
            href={`/servers/${serverid}/stacks`}
            className="hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
          >
            {server.name} Stacks
          </Link>
          <ChevronRightIcon className="w-4 h-4 text-slate-400" />
          <span className="text-slate-900 dark:text-white font-medium">{stackname}</span>
        </nav>
      </div>

      {/* Header Section */}
      <div className="mb-8">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
          <div className="flex items-center space-x-4">
            <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-purple-600 rounded-2xl flex items-center justify-center">
              <CircleStackIcon className="w-8 h-8 text-white" />
            </div>
            <div>
              <div className="flex items-center space-x-3">
                <h1 className="text-3xl font-bold bg-gradient-to-r from-slate-900 to-slate-600 dark:from-white dark:to-slate-300 bg-clip-text text-transparent">
                  {stackname}
                </h1>
                {/* Connection Status */}
                <div
                  className={`flex items-center space-x-2 px-3 py-1 rounded-full text-xs font-medium ${
                    connectionStatus === 'connected'
                      ? 'bg-emerald-100/70 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300'
                      : connectionStatus === 'connecting'
                        ? 'bg-yellow-100/70 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300'
                        : 'bg-red-100/70 text-red-700 dark:bg-red-900/30 dark:text-red-300'
                  }`}
                >
                  <div
                    className={`w-2 h-2 rounded-full ${
                      connectionStatus === 'connected'
                        ? 'bg-emerald-500 animate-pulse'
                        : connectionStatus === 'connecting'
                          ? 'bg-yellow-500 animate-pulse'
                          : 'bg-red-500'
                    }`}
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
                <div className="flex items-center space-x-2 text-sm text-slate-600 dark:text-slate-400">
                  <ServerIcon className="w-4 h-4" />
                  <span>{server.name}</span>
                </div>
                {stackDetails && (
                  <>
                    <div className="w-1 h-1 bg-slate-400 rounded-full" />
                    <div className="text-sm text-slate-600 dark:text-slate-400">
                      {stackDetails.services?.length || 0} services
                    </div>
                    <div className="w-1 h-1 bg-slate-400 rounded-full" />
                    <div className="text-sm text-slate-600 dark:text-slate-400">
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
              className="inline-flex items-center px-4 py-2 bg-white/70 dark:bg-slate-800/70 backdrop-blur-sm border border-slate-200/50 dark:border-slate-700/50 rounded-xl text-slate-700 dark:text-slate-300 hover:bg-white dark:hover:bg-slate-800 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <ArrowPathIcon
                className={`w-4 h-4 mr-2 ${isFetching || networksFetching || volumesFetching || environmentFetching || statsFetching ? 'animate-spin' : ''}`}
              />
              Refresh All
            </button>

            {/* Operations Button */}
            <button
              onClick={() => setOperationsModalOpen(true)}
              className="inline-flex items-center px-4 py-2 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white rounded-xl shadow-lg hover:shadow-xl transition-all duration-200"
            >
              <Cog6ToothIcon className="w-4 h-4 mr-2" />
              Operations
            </button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      {loading ? (
        <div className="text-center py-16">
          <div className="relative">
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="w-32 h-32 bg-gradient-to-r from-blue-100 to-purple-100 dark:from-blue-900/20 dark:to-purple-900/20 rounded-full opacity-50" />
            </div>
            <div className="relative">
              <div className="mx-auto w-16 h-16 bg-gradient-to-br from-slate-100 to-slate-200 dark:from-slate-800 dark:to-slate-700 rounded-2xl flex items-center justify-center mb-6 animate-spin">
                <ArrowPathIcon className="w-8 h-8 text-slate-400 dark:text-slate-500" />
              </div>
            </div>
          </div>
          <h3 className="text-xl font-semibold text-slate-900 dark:text-white mb-2">
            Loading stack details...
          </h3>
          <p className="text-slate-600 dark:text-slate-400">
            Please wait while we fetch your Docker stack information.
          </p>
        </div>
      ) : error ? (
        <div className="text-center py-16">
          <div className="relative">
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="w-32 h-32 bg-gradient-to-r from-red-100 to-orange-100 dark:from-red-900/20 dark:to-orange-900/20 rounded-full opacity-50" />
            </div>
            <div className="relative">
              <div className="mx-auto w-16 h-16 bg-gradient-to-br from-red-100 to-red-200 dark:from-red-800 dark:to-red-700 rounded-2xl flex items-center justify-center mb-6">
                <ExclamationTriangleIcon className="w-8 h-8 text-red-500" />
              </div>
            </div>
          </div>
          <h3 className="text-xl font-semibold text-slate-900 dark:text-white mb-2">
            Error loading stack details
          </h3>
          <p className="text-slate-600 dark:text-slate-400 mb-6">
            {error?.message || 'Unable to connect to the Docker stack.'}
          </p>
          <button
            onClick={() => refetch()}
            className="inline-flex items-center px-6 py-3 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white rounded-xl shadow-lg hover:shadow-xl transition-all duration-200"
          >
            <ArrowPathIcon className="w-4 h-4 mr-2" />
            Try Again
          </button>
        </div>
      ) : stackDetails ? (
        <div className="space-y-8">
          {/* Quick Stats Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <div className="bg-white/70 dark:bg-slate-800/70 backdrop-blur-sm rounded-2xl border border-slate-200/50 dark:border-slate-700/50 p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-slate-600 dark:text-slate-400">Services</p>
                  <p className="text-2xl font-bold text-slate-900 dark:text-white mt-1">
                    {stackDetails.services?.length || 0}
                  </p>
                </div>
                <div className="p-3 rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-200/20 dark:border-blue-800/20">
                  <CircleStackIcon className="w-6 h-6" />
                </div>
              </div>
            </div>

            <div className="bg-white/70 dark:bg-slate-800/70 backdrop-blur-sm rounded-2xl border border-slate-200/50 dark:border-slate-700/50 p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-slate-600 dark:text-slate-400">
                    Containers
                  </p>
                  <p className="text-2xl font-bold text-slate-900 dark:text-white mt-1">
                    {stackDetails.services?.reduce(
                      (total, service) => total + (service.containers?.length || 0),
                      0
                    ) || 0}
                  </p>
                </div>
                <div className="p-3 rounded-xl bg-green-500/10 text-green-600 dark:text-green-400 border border-green-200/20 dark:border-green-800/20">
                  <ServerIcon className="w-6 h-6" />
                </div>
              </div>
            </div>

            <div className="bg-white/70 dark:bg-slate-800/70 backdrop-blur-sm rounded-2xl border border-slate-200/50 dark:border-slate-700/50 p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-slate-600 dark:text-slate-400">Networks</p>
                  <p className="text-2xl font-bold text-slate-900 dark:text-white mt-1">
                    {networks?.length || 0}
                  </p>
                </div>
                <div className="p-3 rounded-xl bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-200/20 dark:border-purple-800/20">
                  <GlobeAltIcon className="w-6 h-6" />
                </div>
              </div>
            </div>

            <div className="bg-white/70 dark:bg-slate-800/70 backdrop-blur-sm rounded-2xl border border-slate-200/50 dark:border-slate-700/50 p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-slate-600 dark:text-slate-400">Volumes</p>
                  <p className="text-2xl font-bold text-slate-900 dark:text-white mt-1">
                    {volumes?.length || 0}
                  </p>
                </div>
                <div className="p-3 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-200/20 dark:border-emerald-800/20">
                  <FolderIcon className="w-6 h-6" />
                </div>
              </div>
            </div>
          </div>

          {/* Stack Info Card */}
          <div className="bg-white/50 dark:bg-slate-800/50 backdrop-blur-sm rounded-2xl border border-slate-200/50 dark:border-slate-700/50 overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-200/50 dark:border-slate-700/50">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 bg-gradient-to-r from-blue-500 to-purple-500 rounded-xl flex items-center justify-center">
                  <DocumentTextIcon className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
                    Stack Information
                  </h2>
                  <p className="text-sm text-slate-600 dark:text-slate-400">
                    Configuration and metadata
                  </p>
                </div>
              </div>
            </div>
            <div className="p-6">
              <dl className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                <div className="flex flex-col space-y-1">
                  <dt className="text-sm font-medium text-slate-600 dark:text-slate-400">
                    Compose File
                  </dt>
                  <dd className="text-sm font-mono bg-slate-100 dark:bg-slate-700 px-3 py-2 rounded-lg text-slate-900 dark:text-white">
                    {stackDetails.compose_file}
                  </dd>
                </div>
                <div className="flex flex-col space-y-1">
                  <dt className="text-sm font-medium text-slate-600 dark:text-slate-400">
                    Stack Path
                  </dt>
                  <dd className="text-sm font-mono bg-slate-100 dark:bg-slate-700 px-3 py-2 rounded-lg text-slate-900 dark:text-white">
                    {stackDetails.path}
                  </dd>
                </div>
              </dl>
            </div>
          </div>

          {/* Modern Tab Navigation */}
          <div className="bg-white/50 dark:bg-slate-800/50 backdrop-blur-sm rounded-2xl border border-slate-200/50 dark:border-slate-700/50 overflow-hidden">
            <div className="border-b border-slate-200/50 dark:border-slate-700/50">
              <nav className="flex space-x-1 p-2">
                {[
                  { id: 'services', name: 'Services', icon: CircleStackIcon },
                  { id: 'networks', name: 'Networks', icon: GlobeAltIcon },
                  { id: 'volumes', name: 'Volumes', icon: FolderIcon },
                  { id: 'environment', name: 'Environment', icon: Cog6ToothIcon },
                  { id: 'stats', name: 'Stats', icon: CpuChipIcon },
                  { id: 'logs', name: 'Logs', icon: DocumentTextIcon },
                  { id: 'files', name: 'Files', icon: FolderIcon },
                ].map((tab) => {
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
                            | 'stats'
                            | 'logs'
                            | 'files'
                        )
                      }
                      className={`flex items-center space-x-2 px-4 py-2 rounded-xl text-sm font-medium transition-all duration-200 ${
                        activeTab === tab.id
                          ? 'bg-gradient-to-r from-blue-500/10 to-purple-500/10 text-blue-600 dark:text-blue-400 shadow-sm border border-blue-200/20 dark:border-blue-800/20'
                          : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100/50 dark:hover:bg-slate-800/50 hover:text-slate-900 dark:hover:text-white'
                      }`}
                    >
                      <Icon className="w-4 h-4" />
                      <span>{tab.name}</span>
                      {activeTab === tab.id && (
                        <div className="w-2 h-2 bg-blue-600 dark:bg-blue-400 rounded-full" />
                      )}
                    </button>
                  );
                })}
              </nav>
            </div>

            {/* Tab Content */}
            <div className="p-6">
              {activeTab === 'services' &&
                stackDetails.services &&
                stackDetails.services.length > 0 && (
                  <div className="space-y-6">
                    {stackDetails.services.map((service) => (
                      <div
                        key={service.name}
                        className="bg-white/70 dark:bg-slate-800/70 backdrop-blur-sm rounded-xl border border-slate-200/50 dark:border-slate-700/50 p-6"
                      >
                        <div className="flex items-center justify-between mb-4">
                          <div>
                            <h3 className="text-lg font-semibold text-slate-900 dark:text-white">
                              {service.name}
                            </h3>
                            {service.image && (
                              <p className="text-sm text-slate-600 dark:text-slate-400 font-mono">
                                {service.image}
                              </p>
                            )}
                          </div>
                          <ServiceQuickActions
                            service={service}
                            onQuickOperation={handleQuickOperation}
                            serverid={serverid}
                            stackname={stackname}
                            isOperationRunning={quickOperationState.isRunning}
                            runningOperation={quickOperationState.operation}
                          />
                        </div>

                        {service.containers && service.containers.length > 0 && (
                          <div className="space-y-3">
                            {service.containers.map((container, index) => (
                              <div
                                key={container.name || index}
                                className="flex items-center justify-between p-4 bg-slate-50/50 dark:bg-slate-900/50 rounded-lg"
                              >
                                <div className="flex items-center space-x-4">
                                  <div className="w-3 h-3 rounded-full bg-emerald-500 animate-pulse" />
                                  <div>
                                    <p className="font-medium text-slate-900 dark:text-white">
                                      {container.name}
                                    </p>
                                    <p className="text-sm text-slate-600 dark:text-slate-400 font-mono">
                                      {container.image}
                                    </p>
                                  </div>
                                </div>
                                <div className="flex items-center space-x-2">
                                  <span
                                    className={`px-3 py-1 text-xs font-medium rounded-full ${getContainerStatusColor(container.state)}`}
                                  >
                                    {container.state}
                                  </span>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
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

              {activeTab === 'stats' && (
                <StackStats
                  containers={stackStats?.containers || []}
                  isLoading={statsLoading}
                  error={statsError}
                />
              )}

              {activeTab === 'logs' && (
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

              {activeTab === 'files' && (
                <FileManager
                  serverid={serverid}
                  stackname={stackname}
                  canRead={permissions.includes('files.read')}
                  canWrite={permissions.includes('files.write')}
                />
              )}
            </div>
          </div>
        </div>
      ) : (
        <div className="text-center py-16">
          <div className="relative">
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="w-32 h-32 bg-gradient-to-r from-slate-100 to-slate-200 dark:from-slate-800 dark:to-slate-700 rounded-full opacity-50" />
            </div>
            <div className="relative">
              <div className="mx-auto w-16 h-16 bg-gradient-to-br from-slate-100 to-slate-200 dark:from-slate-800 dark:to-slate-700 rounded-2xl flex items-center justify-center mb-6">
                <ExclamationTriangleIcon className="w-8 h-8 text-slate-400 dark:text-slate-500" />
              </div>
            </div>
          </div>
          <h3 className="text-xl font-semibold text-slate-900 dark:text-white mb-2">
            No stack details available
          </h3>
          <p className="text-slate-600 dark:text-slate-400">
            Unable to load information for this stack.
          </p>
        </div>
      )}

      {/* Operations Modal */}
      <OperationsModal
        isOpen={operationsModalOpen}
        onClose={() => setOperationsModalOpen(false)}
        serverid={String(serverid)}
        stackname={stackname}
        services={
          stackStats?.containers?.map((container) => ({
            name: container.name,
            service_name: container.service_name,
          })) || []
        }
        onOperationComplete={(success, _exitCode) => {
          if (success) {
            refetch();
            refetchStats();
          }
        }}
      />
    </Layout>
  );
};

export default StackDetails;
