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
import { StackQuickActions } from '../../components/stack/StackQuickActions';
import { OperationRequest } from '../../types/operations';
import { showToast } from '../../utils/toast';

interface StackDetailsProps {
  title: string;
  server: Server;
  serverId: number;
  stackName: string;
}

const StackDetails: React.FC<StackDetailsProps> = ({ title, server, serverId, stackName }) => {
  const [activeTab, setActiveTab] = useState<
    'services' | 'networks' | 'volumes' | 'environment' | 'stats' | 'logs' | 'operations'
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
  } = useStackDetails({ serverId, stackName });

  const {
    data: networks,
    isLoading: networksLoading,
    error: networksError,
    isFetching: networksFetching,
    refetch: refetchNetworks,
  } = useStackNetworks({ serverId, stackName });

  const {
    data: volumes,
    isLoading: volumesLoading,
    error: volumesError,
    isFetching: volumesFetching,
    refetch: refetchVolumes,
  } = useStackVolumes({ serverId, stackName });

  const {
    data: environmentVariables,
    isLoading: environmentLoading,
    error: environmentError,
    isFetching: environmentFetching,
    refetch: refetchEnvironment,
  } = useStackEnvironmentVariables({ serverId, stackName });

  const {
    data: stackStats,
    isLoading: statsLoading,
    error: statsError,
    isFetching: statsFetching,
    refetch: refetchStats,
  } = useStackStats(serverId, stackName, activeTab === 'stats' || activeTab === 'logs');

  const { isConnected, connectionStatus } = useStackWebSocket({
    serverId,
    stackName,
    enabled: true,
  });

  const { startOperation } = useOperations({
    serverId: String(serverId),
    stackName,
    onOperationComplete: (success, _exitCode) => {
      const currentOp = quickOperationState.operation;
      setQuickOperationState({ isRunning: false });

      if (currentOp) {
        const [commandOrStack, serviceName] = currentOp.split(':');
        const isStackOperation = commandOrStack === 'stack';
        const command = isStackOperation ? serviceName : commandOrStack;
        const targetName = isStackOperation ? `stack ${stackName}` : serviceName;
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

      const targetName = isStackOperation ? `stack ${stackName}` : operation.services[0];
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

      <div className="py-12">
        <div className="max-w-7xl mx-auto sm:px-6 lg:px-8">
          {/* Header */}
          <div className="mb-8">
            <nav className="flex" aria-label="Breadcrumb">
              <ol className="inline-flex items-center space-x-1 md:space-x-3">
                <li className="inline-flex items-center">
                  <Link
                    href="/"
                    className="inline-flex items-center text-sm font-medium text-gray-700 hover:text-blue-600 dark:text-gray-400 dark:hover:text-white"
                  >
                    <svg className="w-3 h-3 mr-2" fill="currentColor" viewBox="0 0 20 20">
                      <path d="M10.707 2.293a1 1 0 00-1.414 0l-7 7a1 1 0 001.414 1.414L4 10.414V17a1 1 0 001 1h2a1 1 0 001-1v-2a1 1 0 011-1h2a1 1 0 011 1v2a1 1 0 001 1h2a1 1 0 001-1v-6.586l.293.293a1 1 0 001.414-1.414l-7-7z"></path>
                    </svg>
                    Dashboard
                  </Link>
                </li>
                <li>
                  <div className="flex items-center">
                    <svg className="w-6 h-6 text-gray-400" fill="currentColor" viewBox="0 0 20 20">
                      <path
                        fillRule="evenodd"
                        d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z"
                        clipRule="evenodd"
                      ></path>
                    </svg>
                    <Link
                      href={`/servers/${serverId}/stacks`}
                      className="ml-1 text-sm font-medium text-gray-700 hover:text-blue-600 md:ml-2 dark:text-gray-400 dark:hover:text-white"
                    >
                      {server.name} Stacks
                    </Link>
                  </div>
                </li>
                <li aria-current="page">
                  <div className="flex items-center">
                    <svg className="w-6 h-6 text-gray-400" fill="currentColor" viewBox="0 0 20 20">
                      <path
                        fillRule="evenodd"
                        d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z"
                        clipRule="evenodd"
                      ></path>
                    </svg>
                    <span className="ml-1 text-sm font-medium text-gray-500 md:ml-2 dark:text-gray-400">
                      {stackName}
                    </span>
                  </div>
                </li>
              </ol>
            </nav>

            <div className="mt-4">
              <div className="flex items-center justify-between">
                <div>
                  <div className="flex items-center space-x-3">
                    <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
                      {stackName}
                    </h1>
                    {isFetching && !loading && (
                      <div className="flex items-center text-sm text-gray-500 dark:text-gray-400">
                        <svg
                          className="animate-spin -ml-1 mr-2 h-4 w-4"
                          xmlns="http://www.w3.org/2000/svg"
                          fill="none"
                          viewBox="0 0 24 24"
                        >
                          <circle
                            className="opacity-25"
                            cx="12"
                            cy="12"
                            r="10"
                            stroke="currentColor"
                            strokeWidth="4"
                          ></circle>
                          <path
                            className="opacity-75"
                            fill="currentColor"
                            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                          ></path>
                        </svg>
                        Updating...
                      </div>
                    )}
                    {/* WebSocket Connection Status */}
                    <div className="flex items-center space-x-2 mt-2">
                      <div
                        className={`h-2 w-2 rounded-full ${
                          connectionStatus === 'connected'
                            ? 'bg-green-500'
                            : connectionStatus === 'connecting'
                              ? 'bg-yellow-500 animate-pulse'
                              : 'bg-red-500'
                        }`}
                      ></div>
                      <span className="text-xs text-gray-500 dark:text-gray-400">
                        {connectionStatus === 'connected'
                          ? 'Live updates active'
                          : connectionStatus === 'connecting'
                            ? 'Connecting to live updates...'
                            : 'Live updates disconnected'}
                      </span>
                    </div>
                  </div>
                  <p className="text-gray-600 dark:text-gray-400 mt-2">
                    Stack details for {server.name}
                  </p>
                </div>
                <div className="flex items-center space-x-2">
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
                    className="inline-flex items-center px-3 py-2 border border-gray-300 dark:border-gray-600 shadow-sm text-sm leading-4 font-medium rounded-md text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <svg
                      className={`-ml-0.5 mr-2 h-4 w-4 ${isFetching || networksFetching || volumesFetching || environmentFetching || statsFetching ? 'animate-spin' : ''}`}
                      xmlns="http://www.w3.org/2000/svg"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                      />
                    </svg>
                    Refresh
                  </button>
                </div>
              </div>
            </div>
          </div>

          {loading ? (
            <div className="text-center py-12">
              <div className="inline-flex items-center justify-center w-16 h-16 bg-gray-100 dark:bg-gray-800 rounded-full mb-4 animate-spin">
                <svg
                  className="w-8 h-8 text-gray-400 dark:text-gray-600"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                  />
                </svg>
              </div>
              <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                Loading stack details...
              </h3>
            </div>
          ) : error ? (
            <div className="text-center py-12">
              <div className="inline-flex items-center justify-center w-16 h-16 bg-red-100 dark:bg-red-900/20 rounded-full mb-4">
                <svg
                  className="w-8 h-8 text-red-400"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
              </div>
              <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                Error loading stack details
              </h3>
              <p className="text-gray-500 dark:text-gray-400 mb-4">
                {error?.message || 'An unknown error occurred'}
              </p>
            </div>
          ) : stackDetails ? (
            <div className="space-y-6">
              {/* Real-time Status Bar */}
              <div className="bg-blue-50 dark:bg-blue-900/20 border-l-4 border-blue-400 p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center">
                    <div
                      className={`flex-shrink-0 w-3 h-3 rounded-full mr-3 ${
                        isConnected ? 'bg-green-500' : 'bg-red-500'
                      }`}
                    ></div>
                    <div className="flex-1">
                      <p className="text-sm text-blue-700 dark:text-blue-300">
                        {isConnected
                          ? 'Connected to real-time updates'
                          : 'Real-time updates disconnected'}
                      </p>
                      <p className="text-xs text-blue-600 dark:text-blue-400 mt-1">
                        Status: {connectionStatus} • Container and stack changes will update
                        automatically
                      </p>
                    </div>
                  </div>
                  <div className="flex-shrink-0">
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-800/30 dark:text-blue-300">
                      Live
                    </span>
                  </div>
                </div>
              </div>

              {/* Stack Overview */}
              <div className="bg-white dark:bg-gray-800 overflow-hidden shadow-sm sm:rounded-lg">
                <div className="p-6">
                  <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
                    Stack Overview
                  </h2>
                  <dl className="grid grid-cols-1 gap-x-4 gap-y-6 sm:grid-cols-2">
                    <div>
                      <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">
                        Compose File
                      </dt>
                      <dd className="mt-1 text-sm text-gray-900 dark:text-white">
                        {stackDetails.compose_file}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">Path</dt>
                      <dd className="mt-1 text-sm text-gray-900 dark:text-white">
                        {stackDetails.path}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">
                        Services Count
                      </dt>
                      <dd className="mt-1 text-sm text-gray-900 dark:text-white">
                        {stackDetails.services?.length || 0}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">
                        Total Containers
                      </dt>
                      <dd className="mt-1 text-sm text-gray-900 dark:text-white">
                        {stackDetails.services?.reduce(
                          (total, service) => total + (service.containers?.length || 0),
                          0
                        ) || 0}
                      </dd>
                    </div>
                  </dl>
                </div>
              </div>

              {/* Tab Navigation */}
              <div className="bg-white dark:bg-gray-800 overflow-hidden shadow-sm sm:rounded-lg">
                <div className="border-b border-gray-200 dark:border-gray-700">
                  <nav className="-mb-px flex">
                    <button
                      onClick={() => setActiveTab('services')}
                      className={`${
                        activeTab === 'services'
                          ? 'border-blue-500 text-blue-600 dark:border-blue-400 dark:text-blue-400'
                          : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300'
                      } whitespace-nowrap py-4 px-6 border-b-2 font-medium text-sm transition-colors`}
                    >
                      <div className="flex items-center space-x-2">
                        <svg
                          className="w-5 h-5"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"
                          />
                        </svg>
                        <span>Services & Containers</span>
                        {stackDetails?.services && (
                          <span className="bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 py-0.5 px-2 rounded-full text-xs">
                            {stackDetails.services.length}
                          </span>
                        )}
                      </div>
                    </button>
                    <button
                      onClick={() => setActiveTab('networks')}
                      className={`${
                        activeTab === 'networks'
                          ? 'border-blue-500 text-blue-600 dark:border-blue-400 dark:text-blue-400'
                          : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300'
                      } whitespace-nowrap py-4 px-6 border-b-2 font-medium text-sm transition-colors`}
                    >
                      <div className="flex items-center space-x-2">
                        <svg
                          className="w-5 h-5"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
                          />
                        </svg>
                        <span>Networks</span>
                        {networks && (
                          <span className="bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 py-0.5 px-2 rounded-full text-xs">
                            {networks.length}
                          </span>
                        )}
                      </div>
                    </button>
                    <button
                      onClick={() => setActiveTab('volumes')}
                      className={`${
                        activeTab === 'volumes'
                          ? 'border-blue-500 text-blue-600 dark:border-blue-400 dark:text-blue-400'
                          : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300'
                      } whitespace-nowrap py-4 px-6 border-b-2 font-medium text-sm transition-colors`}
                    >
                      <div className="flex items-center space-x-2">
                        <svg
                          className="w-5 h-5"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M5 19a2 2 0 01-2-2V7a2 2 0 012-2h4l2 2h4a2 2 0 012 2v1M5 19h14a2 2 0 002-2v-5a2 2 0 00-2-2H9a2 2 0 00-2 2v5a2 2 0 01-2 2z"
                          />
                        </svg>
                        <span>Volumes</span>
                        {volumes && (
                          <span className="bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 py-0.5 px-2 rounded-full text-xs">
                            {volumes.length}
                          </span>
                        )}
                      </div>
                    </button>
                    <button
                      onClick={() => setActiveTab('environment')}
                      className={`${
                        activeTab === 'environment'
                          ? 'border-blue-500 text-blue-600 dark:border-blue-400 dark:text-blue-400'
                          : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300'
                      } whitespace-nowrap py-4 px-6 border-b-2 font-medium text-sm transition-colors`}
                    >
                      <div className="flex items-center space-x-2">
                        <svg
                          className="w-5 h-5"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4"
                          />
                        </svg>
                        <span>Environment</span>
                        {environmentVariables && (
                          <span className="bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 py-0.5 px-2 rounded-full text-xs">
                            {Object.values(environmentVariables).reduce(
                              (total, serviceEnvs) =>
                                total +
                                serviceEnvs.reduce(
                                  (envTotal, env) => envTotal + env.variables.length,
                                  0
                                ),
                              0
                            )}
                          </span>
                        )}
                      </div>
                    </button>
                    <button
                      onClick={() => setActiveTab('stats')}
                      className={`${
                        activeTab === 'stats'
                          ? 'border-blue-500 text-blue-600 dark:border-blue-400 dark:text-blue-400'
                          : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300'
                      } whitespace-nowrap py-4 px-6 border-b-2 font-medium text-sm transition-colors`}
                    >
                      <div className="flex items-center space-x-2">
                        <svg
                          className="w-5 h-5"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                          xmlns="http://www.w3.org/2000/svg"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
                          />
                        </svg>
                        <span>Stats</span>
                        {stackStats && (
                          <span className="bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 py-0.5 px-2 rounded-full text-xs">
                            {stackStats.containers.length}
                          </span>
                        )}
                      </div>
                    </button>
                    <button
                      onClick={() => setActiveTab('logs')}
                      className={`${
                        activeTab === 'logs'
                          ? 'border-blue-500 text-blue-600 dark:border-blue-400 dark:text-blue-400'
                          : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300'
                      } whitespace-nowrap py-4 px-6 border-b-2 font-medium text-sm transition-colors`}
                    >
                      <div className="flex items-center space-x-2">
                        <svg
                          className="w-5 h-5"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                          />
                        </svg>
                        <span>Logs</span>
                      </div>
                    </button>
                    <button
                      onClick={() => setOperationsModalOpen(true)}
                      className="border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300 whitespace-nowrap py-4 px-6 border-b-2 font-medium text-sm transition-colors hover:bg-blue-50 dark:hover:bg-blue-900/20"
                    >
                      <div className="flex items-center space-x-2">
                        <svg
                          className="w-5 h-5"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 100 4m0-4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 100 4m0-4v2m0-6V4"
                          />
                        </svg>
                        <span>Operations</span>
                      </div>
                    </button>
                  </nav>
                </div>
              </div>

              {/* Tab Content */}
              {activeTab === 'services' &&
                stackDetails.services &&
                stackDetails.services.length > 0 && (
                  <div className="bg-white dark:bg-gray-800 overflow-hidden shadow-sm sm:rounded-lg">
                    <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
                      <div className="flex items-center justify-between">
                        <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
                          Services & Containers
                        </h2>
                        <div className="flex items-center space-x-2">
                          <span className="text-sm text-gray-500 dark:text-gray-400">
                            Stack Actions:
                          </span>
                          <StackQuickActions
                            services={stackDetails.services}
                            onQuickOperation={handleQuickOperation}
                            isOperationRunning={quickOperationState.isRunning}
                            runningOperation={quickOperationState.operation}
                          />
                        </div>
                      </div>
                    </div>
                    <div className="p-6 space-y-6">
                      {stackDetails.services.map((service) => (
                        <div
                          key={service.name}
                          className="border border-gray-200 dark:border-gray-700 rounded-lg"
                        >
                          <div className="px-4 py-3 bg-gray-50 dark:bg-gray-700 border-b border-gray-200 dark:border-gray-600">
                            <div className="flex items-center justify-between">
                              <div>
                                <h3 className="text-lg font-medium text-gray-900 dark:text-white">
                                  {service.name}
                                </h3>
                                {service.image && (
                                  <span className="text-sm text-gray-600 dark:text-gray-400 font-mono">
                                    {service.image}
                                  </span>
                                )}
                              </div>
                              <ServiceQuickActions
                                service={service}
                                onQuickOperation={handleQuickOperation}
                                serverId={serverId}
                                stackName={stackName}
                                isOperationRunning={quickOperationState.isRunning}
                                runningOperation={quickOperationState.operation}
                              />
                            </div>
                          </div>
                          <div className="p-4">
                            {service.containers && service.containers.length > 0 ? (
                              <div className="overflow-x-auto">
                                <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-600">
                                  <thead className="bg-gray-50 dark:bg-gray-700">
                                    <tr>
                                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                                        Container
                                      </th>
                                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                                        Status
                                      </th>
                                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                                        Image
                                      </th>
                                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                                        Ports
                                      </th>
                                    </tr>
                                  </thead>
                                  <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-600">
                                    {service.containers.map((container, index) => (
                                      <tr key={container.name || index}>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white">
                                          {container.name}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                          <span
                                            className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getContainerStatusColor(container.state)}`}
                                          >
                                            {container.state}
                                          </span>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600 dark:text-gray-400 font-mono">
                                          {container.image}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600 dark:text-gray-400">
                                          {container.ports && container.ports.length > 0 ? (
                                            <div className="space-y-1">
                                              {container.ports.map((port, portIndex) => (
                                                <div key={portIndex} className="text-xs">
                                                  {port.public
                                                    ? `${port.public}:${port.private}`
                                                    : port.private}
                                                  /{port.type}
                                                </div>
                                              ))}
                                            </div>
                                          ) : (
                                            <span className="text-gray-400">—</span>
                                          )}
                                        </td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                            ) : (
                              <p className="text-gray-500 dark:text-gray-400 text-sm">
                                No containers found for this service.
                              </p>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

              {/* Networks Tab */}
              {activeTab === 'networks' && (
                <div className="bg-white dark:bg-gray-800 overflow-hidden shadow-sm sm:rounded-lg">
                  <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
                    <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
                      Networks
                    </h2>
                  </div>
                  <div className="p-6">
                    <NetworkList
                      networks={networks || []}
                      isLoading={networksLoading}
                      error={networksError}
                    />
                  </div>
                </div>
              )}

              {/* Volumes Tab */}
              {activeTab === 'volumes' && (
                <div className="bg-white dark:bg-gray-800 overflow-hidden shadow-sm sm:rounded-lg">
                  <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
                    <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Volumes</h2>
                  </div>
                  <div className="p-6">
                    <VolumeList
                      volumes={volumes || []}
                      isLoading={volumesLoading}
                      error={volumesError}
                    />
                  </div>
                </div>
              )}

              {/* Environment Variables Tab */}
              {activeTab === 'environment' && (
                <div className="bg-white dark:bg-gray-800 overflow-hidden shadow-sm sm:rounded-lg">
                  <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
                    <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
                      Environment Variables
                    </h2>
                  </div>
                  <div className="p-6">
                    <EnvironmentVariableList
                      environmentData={environmentVariables || {}}
                      isLoading={environmentLoading}
                      error={environmentError}
                    />
                  </div>
                </div>
              )}

              {/* Stats Tab */}
              {activeTab === 'stats' && (
                <div className="bg-white dark:bg-gray-800 overflow-hidden shadow-sm sm:rounded-lg">
                  <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
                    <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
                      Resource Statistics
                    </h2>
                  </div>
                  <div className="p-6">
                    <StackStats
                      containers={stackStats?.containers || []}
                      isLoading={statsLoading}
                      error={statsError}
                    />
                  </div>
                </div>
              )}

              {/* Logs Tab */}
              {activeTab === 'logs' && (
                <div className="space-y-6">
                  <LogViewer
                    serverId={serverId}
                    stackName={stackName}
                    containers={
                      stackStats?.containers?.map((container) => ({
                        name: container.name,
                        service_name: container.service_name,
                      })) || []
                    }
                  />
                </div>
              )}
            </div>
          ) : (
            <div className="text-center py-12">
              <div className="inline-flex items-center justify-center w-16 h-16 bg-gray-100 dark:bg-gray-800 rounded-full mb-4">
                <svg
                  className="w-8 h-8 text-gray-400 dark:text-gray-600"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"
                  />
                </svg>
              </div>
              <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                No stack details available
              </h3>
              <p className="text-gray-500 dark:text-gray-400">
                Unable to load information for this stack.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Operations Modal */}
      <OperationsModal
        isOpen={operationsModalOpen}
        onClose={() => setOperationsModalOpen(false)}
        serverId={String(serverId)}
        stackName={stackName}
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
