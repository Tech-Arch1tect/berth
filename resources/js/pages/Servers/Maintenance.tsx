import React, { useState } from 'react';
import { Head, Link } from '@inertiajs/react';
import Layout from '../../components/Layout';
import { ServerNavigation } from '../../components/ServerNavigation';
import { Server } from '../../types/server';
import {
  useMaintenanceInfo,
  useDockerPrune,
  useDeleteResource,
  PruneRequest,
  DeleteRequest,
} from '../../hooks/useDockerMaintenance';
import { showToast } from '../../utils/toast';
import {
  HomeIcon,
  ChevronRightIcon,
  ServerIcon,
  CpuChipIcon,
  CircleStackIcon,
  DocumentDuplicateIcon,
  FolderIcon,
  GlobeAltIcon,
  TrashIcon,
  ExclamationTriangleIcon,
  InformationCircleIcon,
  ChartBarIcon,
  CheckCircleIcon,
  ClockIcon,
  TagIcon,
  CubeIcon,
  CloudIcon,
  WrenchIcon,
} from '@heroicons/react/24/outline';

interface MaintenanceProps {
  title: string;
  server: Server;
  serverid: number;
}

type TabType = 'overview' | 'images' | 'containers' | 'volumes' | 'networks' | 'actions';

const Maintenance: React.FC<MaintenanceProps> = ({ title, server, serverid }) => {
  const [activeTab, setActiveTab] = useState<TabType>('overview');
  const [selectedPruneType, setSelectedPruneType] = useState<PruneRequest['type']>('images');
  const [pruneAll, setPruneAll] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<{
    type: DeleteRequest['type'];
    id: string;
    name?: string;
  } | null>(null);

  const { data: maintenanceInfo, isLoading, error, refetch } = useMaintenanceInfo(serverid);
  const pruneMutation = useDockerPrune();
  const deleteMutation = useDeleteResource();

  const formatBytes = (bytes: number): string => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const formatNumber = (num: number): string => {
    return num.toLocaleString();
  };

  const formatDate = (dateString: string): string => {
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString() + ' ' + date.toLocaleTimeString();
    } catch {
      return dateString;
    }
  };

  const getStatusBadge = (status: string, isUnused?: boolean, isDangling?: boolean) => {
    if (isDangling) {
      return (
        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200">
          Dangling
        </span>
      );
    }
    if (isUnused) {
      return (
        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200">
          Unused
        </span>
      );
    }

    const statusMap: { [key: string]: { bg: string; text: string; label: string } } = {
      running: {
        bg: 'bg-green-100 dark:bg-green-900',
        text: 'text-green-800 dark:text-green-200',
        label: 'Running',
      },
      exited: {
        bg: 'bg-red-100 dark:bg-red-900',
        text: 'text-red-800 dark:text-red-200',
        label: 'Exited',
      },
      created: {
        bg: 'bg-blue-100 dark:bg-blue-900',
        text: 'text-blue-800 dark:text-blue-200',
        label: 'Created',
      },
      paused: {
        bg: 'bg-yellow-100 dark:bg-yellow-900',
        text: 'text-yellow-800 dark:text-yellow-200',
        label: 'Paused',
      },
      restarting: {
        bg: 'bg-purple-100 dark:bg-purple-900',
        text: 'text-purple-800 dark:text-purple-200',
        label: 'Restarting',
      },
      removing: {
        bg: 'bg-orange-100 dark:bg-orange-900',
        text: 'text-orange-800 dark:text-orange-200',
        label: 'Removing',
      },
      dead: {
        bg: 'bg-gray-100 dark:bg-gray-900',
        text: 'text-gray-800 dark:text-gray-200',
        label: 'Dead',
      },
    };

    const statusInfo = statusMap[status.toLowerCase()] || {
      bg: 'bg-gray-100 dark:bg-gray-900',
      text: 'text-gray-800 dark:text-gray-200',
      label: status,
    };
    return (
      <span
        className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${statusInfo.bg} ${statusInfo.text}`}
      >
        {statusInfo.label}
      </span>
    );
  };

  const handleDelete = async () => {
    if (!deleteConfirm) return;

    try {
      const result = await deleteMutation.mutateAsync({
        serverid,
        request: {
          type: deleteConfirm.type,
          id: deleteConfirm.id,
        },
      });

      if (result.error) {
        showToast.error(`Failed to delete ${deleteConfirm.type}: ${result.error}`);
      } else {
        showToast.success(
          `Successfully deleted ${deleteConfirm.type}: ${deleteConfirm.name || deleteConfirm.id}`
        );
        refetch();
      }
    } catch (error) {
      showToast.error(`Failed to delete ${deleteConfirm.type}`);
      console.error('Delete error:', error);
    } finally {
      setDeleteConfirm(null);
    }
  };

  const handlePrune = async () => {
    if (!selectedPruneType) return;

    try {
      const result = await pruneMutation.mutateAsync({
        serverid,
        request: {
          type: selectedPruneType,
          all: pruneAll,
          force: false,
        },
      });

      if (result.error) {
        showToast.error(`Cleanup failed: ${result.error}`);
      } else {
        const itemCount = result.items_deleted ? result.items_deleted.length : 0;
        const spaceFreed = formatBytes(result.space_reclaimed || 0);
        if (itemCount === 0 && (result.space_reclaimed || 0) === 0) {
          showToast.success(`Cleanup completed: No items needed to be removed`);
        } else {
          showToast.success(`Cleanup completed: ${itemCount} items removed, ${spaceFreed} freed`);
        }
        refetch();
      }
    } catch (error) {
      showToast.error('Failed to perform cleanup operation');
      console.error('Prune error:', error);
    } finally {
      setShowConfirm(false);
    }
  };

  const getPruneDescription = (type: PruneRequest['type']): string => {
    const descriptions = {
      images: pruneAll
        ? 'Remove all unused images (not just dangling)'
        : 'Remove dangling images only',
      containers: 'Remove all stopped containers',
      volumes: pruneAll
        ? 'Remove all unused volumes (including named volumes)'
        : 'Remove dangling volumes only (anonymous volumes)',
      networks: 'Remove all unused networks',
      'build-cache': pruneAll
        ? 'Remove all build cache entries'
        : 'Remove unused build cache entries only',
      system: 'Remove all unused containers, networks, images, and optionally volumes',
    };
    return descriptions[type];
  };

  const getPruneIcon = (type: PruneRequest['type']) => {
    const icons = {
      images: DocumentDuplicateIcon,
      containers: CircleStackIcon,
      volumes: FolderIcon,
      networks: GlobeAltIcon,
      'build-cache': CubeIcon,
      system: WrenchIcon,
    };
    return icons[type];
  };

  const getPruneStats = (type: PruneRequest['type']) => {
    if (!maintenanceInfo) return null;

    const stats = {
      images: {
        total: maintenanceInfo.image_summary.total_count,
        problematic:
          maintenanceInfo.image_summary.dangling_count + maintenanceInfo.image_summary.unused_count,
        size:
          maintenanceInfo.image_summary.dangling_size + maintenanceInfo.image_summary.unused_size,
      },
      containers: {
        total: maintenanceInfo.container_summary.total_count,
        problematic: maintenanceInfo.container_summary.stopped_count,
        size: 0,
      },
      volumes: {
        total: maintenanceInfo.volume_summary.total_count,
        problematic: maintenanceInfo.volume_summary.unused_count,
        size: maintenanceInfo.volume_summary.unused_size,
      },
      networks: {
        total: maintenanceInfo.network_summary.total_count,
        problematic: maintenanceInfo.network_summary.unused_count,
        size: 0,
      },
      'build-cache': {
        total: maintenanceInfo.build_cache_summary.total_count,
        problematic: maintenanceInfo.build_cache_summary.cache.filter((c) => !c.in_use).length,
        size: maintenanceInfo.build_cache_summary.total_size,
      },
      system: {
        total:
          maintenanceInfo.image_summary.total_count +
          maintenanceInfo.container_summary.total_count +
          maintenanceInfo.volume_summary.total_count +
          maintenanceInfo.network_summary.total_count,
        problematic:
          maintenanceInfo.image_summary.dangling_count +
          maintenanceInfo.image_summary.unused_count +
          maintenanceInfo.container_summary.stopped_count +
          maintenanceInfo.volume_summary.unused_count +
          maintenanceInfo.network_summary.unused_count,
        size: maintenanceInfo.disk_usage.total_size,
      },
    };
    return stats[type];
  };

  if (isLoading) {
    return (
      <Layout>
        <Head title={title} />
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600"></div>
        </div>
      </Layout>
    );
  }

  if (error) {
    return (
      <Layout>
        <Head title={title} />
        <div className="text-center py-12">
          <ExclamationTriangleIcon className="h-12 w-12 text-red-500 mx-auto mb-4" />
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
            Failed to load maintenance information
          </h2>
          <p className="text-gray-600 dark:text-gray-400 mb-4">
            Unable to connect to the Docker maintenance service.
          </p>
          <button
            onClick={() => refetch()}
            className="px-4 py-2 bg-blue-600 dark:bg-blue-600 text-white rounded-md hover:bg-blue-700 dark:hover:bg-blue-700"
          >
            Retry
          </button>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <Head title={title} />

      {/* Breadcrumb */}
      <nav className="flex mb-6" aria-label="Breadcrumb">
        <ol className="flex items-center space-x-4">
          <li>
            <Link
              href="/"
              className="text-gray-400 hover:text-gray-500 dark:text-gray-500 dark:hover:text-gray-400"
            >
              <HomeIcon className="h-5 w-5" />
            </Link>
          </li>
          <li>
            <div className="flex items-center">
              <ChevronRightIcon className="h-5 w-5 text-gray-400" />
              <Link
                href={`/servers/${serverid}/stacks`}
                className="ml-4 text-sm font-medium text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300"
              >
                {server.name}
              </Link>
            </div>
          </li>
          <li>
            <div className="flex items-center">
              <ChevronRightIcon className="h-5 w-5 text-gray-400" />
              <span className="ml-4 text-sm font-medium text-gray-900 dark:text-white">
                Docker Maintenance
              </span>
            </div>
          </li>
        </ol>
      </nav>

      {/* Server Navigation */}
      <div className="mb-8">
        <ServerNavigation serverId={serverid} serverName={server.name} />
      </div>

      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Docker Maintenance</h1>
        <p className="mt-2 text-gray-600 dark:text-gray-400">
          Manage Docker resources on {server.name}
        </p>
      </div>

      {/* Tabs */}
      <div className="mb-8">
        <div className="border-b border-gray-200 dark:border-gray-700">
          <nav className="-mb-px flex space-x-8" aria-label="Tabs">
            {[
              { id: 'overview', name: 'Overview', icon: ChartBarIcon },
              { id: 'images', name: 'Images', icon: DocumentDuplicateIcon },
              { id: 'containers', name: 'Containers', icon: CircleStackIcon },
              { id: 'volumes', name: 'Volumes', icon: FolderIcon },
              { id: 'networks', name: 'Networks', icon: GlobeAltIcon },
              { id: 'actions', name: 'Cleanup Actions', icon: TrashIcon },
            ].map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as TabType)}
                  className={`${
                    activeTab === tab.id
                      ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                      : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'
                  } whitespace-nowrap py-2 px-1 border-b-2 font-medium text-sm flex items-center`}
                >
                  <Icon className="h-5 w-5 mr-2" />
                  {tab.name}
                </button>
              );
            })}
          </nav>
        </div>
      </div>

      {/* Tab Content */}
      {maintenanceInfo && (
        <div>
          {/* Overview Tab */}
          {activeTab === 'overview' && (
            <>
              {/* System Information */}
              <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 mb-8">
                <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
                  <h3 className="text-lg font-medium text-gray-900 dark:text-white flex items-center">
                    <ServerIcon className="h-5 w-5 text-blue-600 mr-2" />
                    System Information
                  </h3>
                </div>
                <div className="p-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    <div className="space-y-3">
                      <div>
                        <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">
                          Docker Version
                        </dt>
                        <dd className="text-sm text-gray-900 dark:text-white font-mono">
                          {maintenanceInfo.system_info.version}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">
                          API Version
                        </dt>
                        <dd className="text-sm text-gray-900 dark:text-white font-mono">
                          {maintenanceInfo.system_info.api_version}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">
                          Server Version
                        </dt>
                        <dd className="text-sm text-gray-900 dark:text-white font-mono">
                          {maintenanceInfo.system_info.server_version}
                        </dd>
                      </div>
                    </div>
                    <div className="space-y-3">
                      <div>
                        <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">
                          Architecture
                        </dt>
                        <dd className="text-sm text-gray-900 dark:text-white font-mono">
                          {maintenanceInfo.system_info.architecture}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">
                          Operating System
                        </dt>
                        <dd className="text-sm text-gray-900 dark:text-white font-mono">
                          {maintenanceInfo.system_info.os}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">
                          Kernel Version
                        </dt>
                        <dd className="text-sm text-gray-900 dark:text-white font-mono">
                          {maintenanceInfo.system_info.kernel_version}
                        </dd>
                      </div>
                    </div>
                    <div className="space-y-3">
                      <div>
                        <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">
                          CPU Cores
                        </dt>
                        <dd className="text-sm text-gray-900 dark:text-white font-mono">
                          {maintenanceInfo.system_info.ncpu}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">
                          Total Memory
                        </dt>
                        <dd className="text-sm text-gray-900 dark:text-white font-mono">
                          {formatBytes(maintenanceInfo.system_info.total_memory)}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">
                          Storage Driver
                        </dt>
                        <dd className="text-sm text-gray-900 dark:text-white font-mono">
                          {maintenanceInfo.system_info.storage_driver}
                        </dd>
                      </div>
                    </div>
                  </div>
                  <div className="mt-6 pt-6 border-t border-gray-200 dark:border-gray-700">
                    <div>
                      <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">
                        Docker Root Directory
                      </dt>
                      <dd className="text-sm text-gray-900 dark:text-white font-mono break-all">
                        {maintenanceInfo.system_info.docker_root_dir}
                      </dd>
                    </div>
                  </div>
                </div>
              </div>

              {/* Resource Summary Cards */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
                <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
                  <div className="flex items-center">
                    <DocumentDuplicateIcon className="h-8 w-8 text-blue-600" />
                    <div className="ml-4">
                      <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Images</p>
                      <p className="text-2xl font-bold text-gray-900 dark:text-white">
                        {maintenanceInfo.image_summary.total_count}
                      </p>
                      {maintenanceInfo.image_summary.unused_count > 0 && (
                        <p className="text-xs text-red-600 dark:text-red-400">
                          {maintenanceInfo.image_summary.unused_count} unused
                        </p>
                      )}
                    </div>
                  </div>
                </div>
                <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
                  <div className="flex items-center">
                    <CircleStackIcon className="h-8 w-8 text-green-600" />
                    <div className="ml-4">
                      <p className="text-sm font-medium text-gray-500 dark:text-gray-400">
                        Containers
                      </p>
                      <p className="text-2xl font-bold text-gray-900 dark:text-white">
                        {maintenanceInfo.container_summary.total_count}
                      </p>
                      <p className="text-xs text-green-600 dark:text-green-400">
                        {maintenanceInfo.container_summary.running_count} running
                      </p>
                    </div>
                  </div>
                </div>
                <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
                  <div className="flex items-center">
                    <FolderIcon className="h-8 w-8 text-purple-600" />
                    <div className="ml-4">
                      <p className="text-sm font-medium text-gray-500 dark:text-gray-400">
                        Volumes
                      </p>
                      <p className="text-2xl font-bold text-gray-900 dark:text-white">
                        {maintenanceInfo.volume_summary.total_count}
                      </p>
                      {maintenanceInfo.volume_summary.unused_count > 0 && (
                        <p className="text-xs text-red-600 dark:text-red-400">
                          {maintenanceInfo.volume_summary.unused_count} unused
                        </p>
                      )}
                    </div>
                  </div>
                </div>
                <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
                  <div className="flex items-center">
                    <GlobeAltIcon className="h-8 w-8 text-indigo-600" />
                    <div className="ml-4">
                      <p className="text-sm font-medium text-gray-500 dark:text-gray-400">
                        Networks
                      </p>
                      <p className="text-2xl font-bold text-gray-900 dark:text-white">
                        {maintenanceInfo.network_summary.total_count}
                      </p>
                      {maintenanceInfo.network_summary.unused_count > 0 && (
                        <p className="text-xs text-red-600 dark:text-red-400">
                          {maintenanceInfo.network_summary.unused_count} unused
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Disk Usage Breakdown */}
              <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 mb-8">
                <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4 flex items-center">
                  <ChartBarIcon className="h-5 w-5 text-purple-600 mr-2" />
                  Detailed Storage Usage
                </h3>
                <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                  <div className="text-center">
                    <div className="text-2xl font-bold text-blue-600">
                      {formatBytes(maintenanceInfo.disk_usage.images_size)}
                    </div>
                    <div className="text-sm text-gray-600 dark:text-gray-400">Images</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-green-600">
                      {formatBytes(maintenanceInfo.disk_usage.containers_size)}
                    </div>
                    <div className="text-sm text-gray-600 dark:text-gray-400">Containers</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-purple-600">
                      {formatBytes(maintenanceInfo.disk_usage.volumes_size)}
                    </div>
                    <div className="text-sm text-gray-600 dark:text-gray-400">Volumes</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-orange-600">
                      {formatBytes(maintenanceInfo.disk_usage.layers_size)}
                    </div>
                    <div className="text-sm text-gray-600 dark:text-gray-400">Layers</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-indigo-600">
                      {formatBytes(maintenanceInfo.disk_usage.build_cache_size)}
                    </div>
                    <div className="text-sm text-gray-600 dark:text-gray-400">Build Cache</div>
                  </div>
                </div>
              </div>

              {/* Resource Summary */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
                  <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4 flex items-center">
                    <DocumentDuplicateIcon className="h-5 w-5 text-blue-600 mr-2" />
                    Images Summary
                  </h3>
                  <div className="space-y-3">
                    <div className="flex justify-between">
                      <span className="text-gray-600 dark:text-gray-400">Total Images:</span>
                      <span className="font-medium text-gray-900 dark:text-white">
                        {formatNumber(maintenanceInfo.image_summary.total_count)}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600 dark:text-gray-400">Dangling Images:</span>
                      <span className="font-medium text-orange-600">
                        {formatNumber(maintenanceInfo.image_summary.dangling_count)} (
                        {formatBytes(maintenanceInfo.image_summary.dangling_size)})
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600 dark:text-gray-400">Unused Images:</span>
                      <span className="font-medium text-red-600">
                        {formatNumber(maintenanceInfo.image_summary.unused_count)} (
                        {formatBytes(maintenanceInfo.image_summary.unused_size)})
                      </span>
                    </div>
                  </div>
                </div>

                <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
                  <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4 flex items-center">
                    <CircleStackIcon className="h-5 w-5 text-green-600 mr-2" />
                    Container Summary
                  </h3>
                  <div className="space-y-3">
                    <div className="flex justify-between">
                      <span className="text-gray-600 dark:text-gray-400">Running:</span>
                      <span className="font-medium text-green-600">
                        {formatNumber(maintenanceInfo.container_summary.running_count)}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600 dark:text-gray-400">Stopped:</span>
                      <span className="font-medium text-orange-600">
                        {formatNumber(maintenanceInfo.container_summary.stopped_count)}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600 dark:text-gray-400">Total:</span>
                      <span className="font-medium text-gray-900 dark:text-white">
                        {formatNumber(maintenanceInfo.container_summary.total_count)}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </>
          )}

          {/* Images Tab */}
          {activeTab === 'images' && (
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
              <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
                <h3 className="text-lg font-medium text-gray-900 dark:text-white flex items-center">
                  <DocumentDuplicateIcon className="h-5 w-5 text-blue-600 mr-2" />
                  Docker Images ({maintenanceInfo.image_summary.images.length})
                </h3>
              </div>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                  <thead className="bg-gray-50 dark:bg-gray-900">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                        Repository
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                        Tag
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                        Image ID
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                        Size
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                        Created
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                        Status
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                    {maintenanceInfo.image_summary.images.map((image) => (
                      <tr key={image.id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white">
                          {image.repository || '<none>'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600 dark:text-gray-400">
                          {image.tag || '<none>'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600 dark:text-gray-400 font-mono">
                          {image.id.substring(0, 12)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600 dark:text-gray-400">
                          {formatBytes(image.size)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600 dark:text-gray-400">
                          {formatDate(image.created)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          {getStatusBadge('active', image.unused, image.dangling)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm">
                          <button
                            onClick={() =>
                              setDeleteConfirm({
                                type: 'image',
                                id: image.id,
                                name: `${image.repository}:${image.tag}`,
                              })
                            }
                            className="text-red-600 hover:text-red-900 dark:hover:text-red-400"
                            disabled={deleteMutation.isPending}
                          >
                            <TrashIcon className="h-4 w-4" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Containers Tab */}
          {activeTab === 'containers' && (
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
              <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
                <h3 className="text-lg font-medium text-gray-900 dark:text-white flex items-center">
                  <CircleStackIcon className="h-5 w-5 text-green-600 mr-2" />
                  Docker Containers ({maintenanceInfo.container_summary.containers.length})
                </h3>
              </div>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                  <thead className="bg-gray-50 dark:bg-gray-900">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                        Name
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                        Container ID
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                        Image
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                        State
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                        Status
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                        Size
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                    {maintenanceInfo.container_summary.containers.map((container) => (
                      <tr key={container.id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white">
                          {container.name}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600 dark:text-gray-400 font-mono">
                          {container.id.substring(0, 12)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600 dark:text-gray-400">
                          {container.image}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          {getStatusBadge(container.state)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600 dark:text-gray-400">
                          {container.status}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600 dark:text-gray-400">
                          {formatBytes(container.size)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm">
                          <button
                            onClick={() =>
                              setDeleteConfirm({
                                type: 'container',
                                id: container.id,
                                name: container.name,
                              })
                            }
                            className="text-red-600 hover:text-red-900 dark:hover:text-red-400"
                            disabled={deleteMutation.isPending}
                          >
                            <TrashIcon className="h-4 w-4" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Volumes Tab */}
          {activeTab === 'volumes' && (
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
              <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
                <h3 className="text-lg font-medium text-gray-900 dark:text-white flex items-center">
                  <FolderIcon className="h-5 w-5 text-purple-600 mr-2" />
                  Docker Volumes ({maintenanceInfo.volume_summary.volumes.length})
                </h3>
              </div>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                  <thead className="bg-gray-50 dark:bg-gray-900">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                        Name
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                        Driver
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                        Mountpoint
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                        Size
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                        Created
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                        Status
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                    {maintenanceInfo.volume_summary.volumes.map((volume) => (
                      <tr key={volume.name} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white">
                          {volume.name}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600 dark:text-gray-400">
                          {volume.driver}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600 dark:text-gray-400 max-w-xs truncate">
                          {volume.mountpoint}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600 dark:text-gray-400">
                          {formatBytes(volume.size)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600 dark:text-gray-400">
                          {formatDate(volume.created)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          {getStatusBadge('active', volume.unused)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm">
                          <button
                            onClick={() =>
                              setDeleteConfirm({
                                type: 'volume',
                                id: volume.name,
                                name: volume.name,
                              })
                            }
                            className="text-red-600 hover:text-red-900 dark:hover:text-red-400"
                            disabled={deleteMutation.isPending}
                          >
                            <TrashIcon className="h-4 w-4" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Networks Tab */}
          {activeTab === 'networks' && (
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
              <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
                <h3 className="text-lg font-medium text-gray-900 dark:text-white flex items-center">
                  <GlobeAltIcon className="h-5 w-5 text-indigo-600 mr-2" />
                  Docker Networks ({maintenanceInfo.network_summary.networks.length})
                </h3>
              </div>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                  <thead className="bg-gray-50 dark:bg-gray-900">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                        Name
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                        Network ID
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                        Driver
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                        Scope
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                        Created
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                        Status
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                    {maintenanceInfo.network_summary.networks.map((network) => (
                      <tr key={network.id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white">
                          {network.name}
                          {network.internal && (
                            <span className="ml-2 inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200">
                              Internal
                            </span>
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600 dark:text-gray-400 font-mono">
                          {network.id.substring(0, 12)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600 dark:text-gray-400">
                          {network.driver}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600 dark:text-gray-400">
                          {network.scope}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600 dark:text-gray-400">
                          {formatDate(network.created)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          {getStatusBadge('active', network.unused)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm">
                          <button
                            onClick={() =>
                              setDeleteConfirm({
                                type: 'network',
                                id: network.id,
                                name: network.name,
                              })
                            }
                            className="text-red-600 hover:text-red-900 dark:hover:text-red-400"
                            disabled={
                              deleteMutation.isPending ||
                              ['bridge', 'host', 'none'].includes(network.name)
                            }
                          >
                            <TrashIcon className="h-4 w-4" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Actions Tab */}
          {activeTab === 'actions' && (
            <div className="space-y-6">
              {/* Cleanup Type Selection */}
              <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
                <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-6 flex items-center">
                  <TrashIcon className="h-5 w-5 text-red-600 mr-2" />
                  Docker Cleanup Actions
                </h3>

                {/* Cleanup Type Cards */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
                  {[
                    {
                      type: 'images' as const,
                      name: 'Images',
                      description: 'Remove unused Docker images',
                    },
                    {
                      type: 'containers' as const,
                      name: 'Containers',
                      description: 'Remove stopped containers',
                    },
                    {
                      type: 'volumes' as const,
                      name: 'Volumes',
                      description: 'Remove unused volumes',
                    },
                    {
                      type: 'networks' as const,
                      name: 'Networks',
                      description: 'Remove unused networks',
                    },
                    {
                      type: 'build-cache' as const,
                      name: 'Build Cache',
                      description: 'Remove build cache entries',
                    },
                    { type: 'system' as const, name: 'System', description: 'Full system cleanup' },
                  ].map(({ type, name, description }) => {
                    const Icon = getPruneIcon(type);
                    const stats = getPruneStats(type);
                    const isSelected = selectedPruneType === type;

                    return (
                      <div
                        key={type}
                        onClick={() => setSelectedPruneType(type)}
                        className={`p-4 rounded-lg border-2 cursor-pointer transition-all duration-200 ${
                          isSelected
                            ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                            : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600 bg-white dark:bg-gray-800'
                        }`}
                      >
                        <div className="flex items-start space-x-3">
                          <Icon
                            className={`h-6 w-6 mt-1 ${
                              isSelected
                                ? 'text-blue-600 dark:text-blue-400'
                                : 'text-gray-600 dark:text-gray-400'
                            }`}
                          />
                          <div className="flex-1 min-w-0">
                            <h4
                              className={`font-medium ${
                                isSelected
                                  ? 'text-blue-900 dark:text-blue-100'
                                  : 'text-gray-900 dark:text-white'
                              }`}
                            >
                              {name}
                            </h4>
                            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                              {description}
                            </p>
                            {stats && (
                              <div className="mt-2 text-xs space-y-1">
                                <div className="flex justify-between">
                                  <span className="text-gray-500 dark:text-gray-400">Total:</span>
                                  <span className="font-medium text-gray-700 dark:text-gray-300">
                                    {stats.total}
                                  </span>
                                </div>
                                {stats.problematic > 0 && (
                                  <div className="flex justify-between">
                                    <span className="text-orange-600 dark:text-orange-400">
                                      To Clean:
                                    </span>
                                    <span className="font-medium text-orange-700 dark:text-orange-300">
                                      {stats.problematic}
                                    </span>
                                  </div>
                                )}
                                {stats.size > 0 && (
                                  <div className="flex justify-between">
                                    <span className="text-gray-500 dark:text-gray-400">Size:</span>
                                    <span className="font-medium text-gray-700 dark:text-gray-300">
                                      {formatBytes(stats.size)}
                                    </span>
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                          {isSelected && (
                            <CheckCircleIcon className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Options */}
                {(selectedPruneType === 'images' ||
                  selectedPruneType === 'volumes' ||
                  selectedPruneType === 'build-cache') && (
                  <div className="mb-6 p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                    <div className="flex items-center">
                      <input
                        id="prune-all"
                        type="checkbox"
                        checked={pruneAll}
                        onChange={(e) => setPruneAll(e.target.checked)}
                        className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700"
                        disabled={pruneMutation.isPending}
                      />
                      <label
                        htmlFor="prune-all"
                        className="ml-2 block text-sm text-gray-900 dark:text-white"
                      >
                        {selectedPruneType === 'images'
                          ? 'Remove all unused images (not just dangling)'
                          : selectedPruneType === 'volumes'
                            ? 'Remove all unused volumes (including named volumes)'
                            : 'Remove all build cache entries (not just unused)'}
                      </label>
                    </div>
                  </div>
                )}

                {/* Description */}
                <div className="mb-6 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                  <div className="flex items-start space-x-3">
                    <InformationCircleIcon className="h-5 w-5 text-blue-600 dark:text-blue-400 mt-0.5" />
                    <div>
                      <p className="text-sm font-medium text-blue-900 dark:text-blue-100 mb-1">
                        {selectedPruneType.charAt(0).toUpperCase() + selectedPruneType.slice(1)}{' '}
                        Cleanup
                      </p>
                      <p className="text-sm text-blue-800 dark:text-blue-300">
                        {getPruneDescription(selectedPruneType)}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="flex flex-col sm:flex-row gap-3">
                  <button
                    onClick={() => setShowConfirm(true)}
                    disabled={pruneMutation.isPending}
                    className="flex-1 px-6 py-3 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center transition-colors"
                  >
                    {pruneMutation.isPending ? (
                      <>
                        <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-3"></div>
                        Cleaning...
                      </>
                    ) : (
                      <>
                        <TrashIcon className="h-5 w-5 mr-3" />
                        Start{' '}
                        {selectedPruneType.charAt(0).toUpperCase() +
                          selectedPruneType.slice(1)}{' '}
                        Cleanup
                      </>
                    )}
                  </button>

                  <button
                    onClick={() => refetch()}
                    disabled={isLoading || pruneMutation.isPending}
                    className="px-6 py-3 bg-gray-600 dark:bg-gray-600 text-white rounded-lg hover:bg-gray-700 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center transition-colors"
                  >
                    <CloudIcon className="h-5 w-5 mr-2" />
                    Refresh Data
                  </button>
                </div>
              </div>

              {/* Quick Stats */}
              <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
                <h4 className="text-md font-medium text-gray-900 dark:text-white mb-4">
                  System Overview
                </h4>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="text-center">
                    <div className="text-2xl font-bold text-blue-600">
                      {maintenanceInfo?.image_summary.total_count || 0}
                    </div>
                    <div className="text-sm text-gray-600 dark:text-gray-400">Images</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-green-600">
                      {maintenanceInfo?.container_summary.total_count || 0}
                    </div>
                    <div className="text-sm text-gray-600 dark:text-gray-400">Containers</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-purple-600">
                      {maintenanceInfo?.volume_summary.total_count || 0}
                    </div>
                    <div className="text-sm text-gray-600 dark:text-gray-400">Volumes</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-indigo-600">
                      {maintenanceInfo?.network_summary.total_count || 0}
                    </div>
                    <div className="text-sm text-gray-600 dark:text-gray-400">Networks</div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Prune Confirmation Modal */}
      {showConfirm && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 dark:bg-gray-900 dark:bg-opacity-75 overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-5 border border-gray-200 dark:border-gray-700 w-96 shadow-lg rounded-md bg-white dark:bg-gray-800">
            <div className="mt-3 text-center">
              <ExclamationTriangleIcon className="w-16 h-16 text-red-600 mx-auto" />
              <h3 className="text-lg font-medium text-gray-900 dark:text-white mt-4">
                Confirm Cleanup
              </h3>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">
                {getPruneDescription(selectedPruneType)}
              </p>
              <p className="text-sm text-red-600 mt-2 font-medium">This action cannot be undone.</p>
              <div className="mt-6 flex space-x-3">
                <button
                  onClick={handlePrune}
                  disabled={pruneMutation.isPending}
                  className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed flex-1"
                >
                  {pruneMutation.isPending ? 'Processing...' : 'Confirm'}
                </button>
                <button
                  onClick={() => setShowConfirm(false)}
                  disabled={pruneMutation.isPending}
                  className="px-4 py-2 bg-gray-300 dark:bg-gray-600 text-gray-700 dark:text-gray-200 rounded-md hover:bg-gray-400 dark:hover:bg-gray-500 disabled:opacity-50 disabled:cursor-not-allowed flex-1"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteConfirm && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 dark:bg-gray-900 dark:bg-opacity-75 overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-5 border border-gray-200 dark:border-gray-700 w-96 shadow-lg rounded-md bg-white dark:bg-gray-800">
            <div className="mt-3 text-center">
              <ExclamationTriangleIcon className="w-16 h-16 text-red-600 mx-auto" />
              <h3 className="text-lg font-medium text-gray-900 dark:text-white mt-4">
                Confirm Deletion
              </h3>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">
                Are you sure you want to delete this {deleteConfirm.type}?
              </p>
              <p className="text-sm font-medium text-gray-900 dark:text-white mt-2">
                {deleteConfirm.name || deleteConfirm.id}
              </p>
              <p className="text-sm text-red-600 mt-2 font-medium">This action cannot be undone.</p>
              <div className="mt-6 flex space-x-3">
                <button
                  onClick={handleDelete}
                  disabled={deleteMutation.isPending}
                  className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed flex-1"
                >
                  {deleteMutation.isPending ? 'Deleting...' : 'Delete'}
                </button>
                <button
                  onClick={() => setDeleteConfirm(null)}
                  disabled={deleteMutation.isPending}
                  className="px-4 py-2 bg-gray-300 dark:bg-gray-600 text-gray-700 dark:text-gray-200 rounded-md hover:bg-gray-400 dark:hover:bg-gray-500 disabled:opacity-50 disabled:cursor-not-allowed flex-1"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </Layout>
  );
};

export default Maintenance;
