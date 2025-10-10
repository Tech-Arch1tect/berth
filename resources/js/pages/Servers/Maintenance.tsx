import React, { useState } from 'react';
import { Head, Link } from '@inertiajs/react';
import Layout from '../../components/Layout';
import { ServerNavigation } from '../../components/ServerNavigation';
import { Server } from '../../types/server';
import { cn } from '../../utils/cn';
import { theme } from '../../theme';
import { LoadingSpinner } from '../../components/common/LoadingSpinner';
import { EmptyState } from '../../components/common/EmptyState';
import { ConfirmationModal } from '../../components/common/ConfirmationModal';
import { Breadcrumb } from '../../components/common/Breadcrumb';
import { StatCard } from '../../components/common/StatCard';
import { Table, Column } from '../../components/common/Table';
import { Tabs, Tab } from '../../components/common/Tabs';
import {
  useMaintenanceInfo,
  useDockerPrune,
  useDeleteResource,
  PruneRequest,
  DeleteRequest,
  ImageInfo,
  ContainerInfo,
  VolumeInfo,
  NetworkInfo,
} from '../../hooks/useDockerMaintenance';
import { showToast } from '../../utils/toast';
import { formatBytes, formatNumber, formatDate } from '../../utils/formatters';
import { getContainerStatusBadge, getResourceStatusBadge } from '../../utils/statusHelpers';
import {
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

  const getStatusBadge = (status: string, isUnused?: boolean, isDangling?: boolean) => {
    const badgeInfo =
      isUnused !== undefined || isDangling !== undefined
        ? getResourceStatusBadge(status, isUnused, isDangling)
        : getContainerStatusBadge(status);

    return <span className={badgeInfo.className}>{badgeInfo.label}</span>;
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
        <LoadingSpinner size="lg" text="Loading maintenance information..." fullScreen />
      </Layout>
    );
  }

  if (error) {
    return (
      <Layout>
        <Head title={title} />
        <EmptyState
          icon={ExclamationTriangleIcon}
          title="Failed to load maintenance information"
          description="Unable to connect to the Docker maintenance service."
          variant="error"
          size="lg"
          action={{
            label: 'Retry',
            onClick: () => refetch(),
          }}
        />
      </Layout>
    );
  }

  return (
    <Layout>
      <Head title={title} />

      {/* Breadcrumb */}
      <Breadcrumb
        items={[
          {
            label: server.name,
            href: `/servers/${serverid}/stacks`,
          },
          {
            label: 'Docker Maintenance',
          },
        ]}
      />

      {/* Server Navigation */}
      <div className="mb-8">
        <ServerNavigation serverId={serverid} serverName={server.name} />
      </div>

      <div className="mb-8">
        <h1 className={cn('text-3xl font-bold', theme.text.strong)}>Docker Maintenance</h1>
        <p className={cn('mt-2', theme.text.muted)}>Manage Docker resources on {server.name}</p>
      </div>

      {/* Tabs */}
      {maintenanceInfo && (
        <Tabs
          tabs={[
            { id: 'overview', label: 'Overview', icon: ChartBarIcon },
            { id: 'images', label: 'Images', icon: DocumentDuplicateIcon },
            { id: 'containers', label: 'Containers', icon: CircleStackIcon },
            { id: 'volumes', label: 'Volumes', icon: FolderIcon },
            { id: 'networks', label: 'Networks', icon: GlobeAltIcon },
            { id: 'actions', label: 'Cleanup Actions', icon: TrashIcon },
          ]}
          activeTab={activeTab}
          onTabChange={(tabId) => setActiveTab(tabId as TabType)}
        >
          <div>
            {/* Overview Tab */}
            {activeTab === 'overview' && (
              <>
                {/* System Information */}
                <div className={cn(theme.containers.panel, 'rounded-lg mb-8')}>
                  <div className={cn('px-6 py-4', theme.cards.sectionDivider)}>
                    <h3 className={cn('text-lg font-medium flex items-center', theme.text.strong)}>
                      <ServerIcon className={cn('h-5 w-5 mr-2', theme.text.info)} />
                      System Information
                    </h3>
                  </div>
                  <div className="p-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                      <div className="space-y-3">
                        <div>
                          <dt className={cn('text-sm font-medium', theme.text.muted)}>
                            Docker Version
                          </dt>
                          <dd className={cn('text-sm font-mono', theme.text.strong)}>
                            {maintenanceInfo.system_info.version}
                          </dd>
                        </div>
                        <div>
                          <dt className="text-sm font-medium {cn(theme.text.muted)}">
                            API Version
                          </dt>
                          <dd className="text-sm {cn(theme.text.strong)} font-mono">
                            {maintenanceInfo.system_info.api_version}
                          </dd>
                        </div>
                        <div>
                          <dt className="text-sm font-medium {cn(theme.text.muted)}">
                            Server Version
                          </dt>
                          <dd className="text-sm {cn(theme.text.strong)} font-mono">
                            {maintenanceInfo.system_info.server_version}
                          </dd>
                        </div>
                      </div>
                      <div className="space-y-3">
                        <div>
                          <dt className="text-sm font-medium {cn(theme.text.muted)}">
                            Architecture
                          </dt>
                          <dd className="text-sm {cn(theme.text.strong)} font-mono">
                            {maintenanceInfo.system_info.architecture}
                          </dd>
                        </div>
                        <div>
                          <dt className="text-sm font-medium {cn(theme.text.muted)}">
                            Operating System
                          </dt>
                          <dd className="text-sm {cn(theme.text.strong)} font-mono">
                            {maintenanceInfo.system_info.os}
                          </dd>
                        </div>
                        <div>
                          <dt className="text-sm font-medium {cn(theme.text.muted)}">
                            Kernel Version
                          </dt>
                          <dd className="text-sm {cn(theme.text.strong)} font-mono">
                            {maintenanceInfo.system_info.kernel_version}
                          </dd>
                        </div>
                      </div>
                      <div className="space-y-3">
                        <div>
                          <dt className="text-sm font-medium {cn(theme.text.muted)}">CPU Cores</dt>
                          <dd className="text-sm {cn(theme.text.strong)} font-mono">
                            {maintenanceInfo.system_info.ncpu}
                          </dd>
                        </div>
                        <div>
                          <dt className="text-sm font-medium {cn(theme.text.muted)}">
                            Total Memory
                          </dt>
                          <dd className="text-sm {cn(theme.text.strong)} font-mono">
                            {formatBytes(maintenanceInfo.system_info.total_memory)}
                          </dd>
                        </div>
                        <div>
                          <dt className="text-sm font-medium {cn(theme.text.muted)}">
                            Storage Driver
                          </dt>
                          <dd className="text-sm {cn(theme.text.strong)} font-mono">
                            {maintenanceInfo.system_info.storage_driver}
                          </dd>
                        </div>
                      </div>
                    </div>
                    <div className="mt-6 pt-6 border-t {cn(theme.cards.sectionDivider)}">
                      <div>
                        <dt className="text-sm font-medium {cn(theme.text.muted)}">
                          Docker Root Directory
                        </dt>
                        <dd className="text-sm {cn(theme.text.strong)} font-mono break-all">
                          {maintenanceInfo.system_info.docker_root_dir}
                        </dd>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Resource Summary Cards */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
                  <StatCard
                    label="Images"
                    value={maintenanceInfo.image_summary.total_count}
                    icon={DocumentDuplicateIcon}
                    iconColor="text-blue-600 dark:text-blue-400"
                    iconBg="bg-blue-100 dark:bg-blue-900/20"
                    subtext={
                      maintenanceInfo.image_summary.unused_count > 0
                        ? `${maintenanceInfo.image_summary.unused_count} unused`
                        : undefined
                    }
                    subtextColor="text-red-600 dark:text-red-400"
                  />
                  <StatCard
                    label="Containers"
                    value={maintenanceInfo.container_summary.total_count}
                    icon={CircleStackIcon}
                    iconColor="text-green-600 dark:text-green-400"
                    iconBg="bg-green-100 dark:bg-green-900/20"
                    subtext={`${maintenanceInfo.container_summary.running_count} running`}
                    subtextColor="text-green-600 dark:text-green-400"
                  />
                  <StatCard
                    label="Volumes"
                    value={maintenanceInfo.volume_summary.total_count}
                    icon={FolderIcon}
                    iconColor="text-purple-600 dark:text-purple-400"
                    iconBg="bg-purple-100 dark:bg-purple-900/20"
                    subtext={
                      maintenanceInfo.volume_summary.unused_count > 0
                        ? `${maintenanceInfo.volume_summary.unused_count} unused`
                        : undefined
                    }
                    subtextColor="text-red-600 dark:text-red-400"
                  />
                  <StatCard
                    label="Networks"
                    value={maintenanceInfo.network_summary.total_count}
                    icon={GlobeAltIcon}
                    iconColor="text-indigo-600 dark:text-indigo-400"
                    iconBg="bg-indigo-100 dark:bg-indigo-900/20"
                    subtext={
                      maintenanceInfo.network_summary.unused_count > 0
                        ? `${maintenanceInfo.network_summary.unused_count} unused`
                        : undefined
                    }
                    subtextColor="text-red-600 dark:text-red-400"
                  />
                </div>

                {/* Disk Usage Breakdown */}
                <div className="{cn(theme.containers.panel)} p-6 rounded-lg shadow-sm border {cn(theme.cards.sectionDivider)} mb-8">
                  <h3 className="text-lg font-medium {cn(theme.text.strong)} mb-4 flex items-center">
                    <ChartBarIcon className="h-5 w-5 text-purple-600 mr-2" />
                    Detailed Storage Usage
                  </h3>
                  <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                    <div className="text-center">
                      <div className="text-2xl font-bold text-blue-600">
                        {formatBytes(maintenanceInfo.disk_usage.images_size)}
                      </div>
                      <div className="text-sm {cn(theme.text.muted)}">Images</div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold text-green-600">
                        {formatBytes(maintenanceInfo.disk_usage.containers_size)}
                      </div>
                      <div className="text-sm {cn(theme.text.muted)}">Containers</div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold text-purple-600">
                        {formatBytes(maintenanceInfo.disk_usage.volumes_size)}
                      </div>
                      <div className="text-sm {cn(theme.text.muted)}">Volumes</div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold text-orange-600">
                        {formatBytes(maintenanceInfo.disk_usage.layers_size)}
                      </div>
                      <div className="text-sm {cn(theme.text.muted)}">Layers</div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold text-indigo-600">
                        {formatBytes(maintenanceInfo.disk_usage.build_cache_size)}
                      </div>
                      <div className="text-sm {cn(theme.text.muted)}">Build Cache</div>
                    </div>
                  </div>
                </div>

                {/* Resource Summary */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <div className="{cn(theme.containers.panel)} p-6 rounded-lg shadow-sm border {cn(theme.cards.sectionDivider)}">
                    <h3 className="text-lg font-medium {cn(theme.text.strong)} mb-4 flex items-center">
                      <DocumentDuplicateIcon className="h-5 w-5 text-blue-600 mr-2" />
                      Images Summary
                    </h3>
                    <div className="space-y-3">
                      <div className="flex justify-between">
                        <span className="{cn(theme.text.muted)}">Total Images:</span>
                        <span className="font-medium {cn(theme.text.strong)}">
                          {formatNumber(maintenanceInfo.image_summary.total_count)}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="{cn(theme.text.muted)}">Dangling Images:</span>
                        <span className="font-medium text-orange-600">
                          {formatNumber(maintenanceInfo.image_summary.dangling_count)} (
                          {formatBytes(maintenanceInfo.image_summary.dangling_size)})
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="{cn(theme.text.muted)}">Unused Images:</span>
                        <span className="font-medium text-red-600">
                          {formatNumber(maintenanceInfo.image_summary.unused_count)} (
                          {formatBytes(maintenanceInfo.image_summary.unused_size)})
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="{cn(theme.containers.panel)} p-6 rounded-lg shadow-sm border {cn(theme.cards.sectionDivider)}">
                    <h3 className="text-lg font-medium {cn(theme.text.strong)} mb-4 flex items-center">
                      <CircleStackIcon className="h-5 w-5 text-green-600 mr-2" />
                      Container Summary
                    </h3>
                    <div className="space-y-3">
                      <div className="flex justify-between">
                        <span className="{cn(theme.text.muted)}">Running:</span>
                        <span className="font-medium text-green-600">
                          {formatNumber(maintenanceInfo.container_summary.running_count)}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="{cn(theme.text.muted)}">Stopped:</span>
                        <span className="font-medium text-orange-600">
                          {formatNumber(maintenanceInfo.container_summary.stopped_count)}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="{cn(theme.text.muted)}">Total:</span>
                        <span className="font-medium {cn(theme.text.strong)}">
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
              <div className="{cn(theme.containers.panel)} rounded-lg shadow-sm border {cn(theme.cards.sectionDivider)} overflow-hidden">
                <div className="px-6 py-4 border-b {cn(theme.cards.sectionDivider)}">
                  <h3 className="text-lg font-medium {cn(theme.text.strong)} flex items-center">
                    <DocumentDuplicateIcon className="h-5 w-5 text-blue-600 mr-2" />
                    Docker Images ({maintenanceInfo.image_summary.images.length})
                  </h3>
                </div>
                <Table<ImageInfo>
                  data={maintenanceInfo.image_summary.images}
                  keyExtractor={(image) => image.id}
                  emptyMessage="No Docker images found"
                  columns={[
                    {
                      key: 'repository',
                      header: 'Repository',
                      render: (image) => (
                        <span className={cn('text-sm font-medium', theme.text.strong)}>
                          {image.repository || '<none>'}
                        </span>
                      ),
                    },
                    {
                      key: 'tag',
                      header: 'Tag',
                      render: (image) => (
                        <span className={cn('text-sm', theme.text.muted)}>
                          {image.tag || '<none>'}
                        </span>
                      ),
                    },
                    {
                      key: 'id',
                      header: 'Image ID',
                      render: (image) => (
                        <span className={cn('text-sm font-mono', theme.text.muted)}>
                          {image.id.substring(0, 12)}
                        </span>
                      ),
                    },
                    {
                      key: 'size',
                      header: 'Size',
                      render: (image) => (
                        <span className={cn('text-sm', theme.text.muted)}>
                          {formatBytes(image.size)}
                        </span>
                      ),
                    },
                    {
                      key: 'created',
                      header: 'Created',
                      render: (image) => (
                        <span className={cn('text-sm', theme.text.muted)}>
                          {formatDate(image.created)}
                        </span>
                      ),
                    },
                    {
                      key: 'status',
                      header: 'Status',
                      render: (image) => getStatusBadge('active', image.unused, image.dangling),
                    },
                    {
                      key: 'actions',
                      header: 'Actions',
                      render: (image) => (
                        <button
                          onClick={() =>
                            setDeleteConfirm({
                              type: 'image',
                              id: image.id,
                              name: `${image.repository}:${image.tag}`,
                            })
                          }
                          className={cn(theme.text.danger, 'hover:opacity-75')}
                          disabled={deleteMutation.isPending}
                        >
                          <TrashIcon className="h-4 w-4" />
                        </button>
                      ),
                    },
                  ]}
                />
              </div>
            )}

            {/* Containers Tab */}
            {activeTab === 'containers' && (
              <div className="{cn(theme.containers.panel)} rounded-lg shadow-sm border {cn(theme.cards.sectionDivider)} overflow-hidden">
                <div className="px-6 py-4 border-b {cn(theme.cards.sectionDivider)}">
                  <h3 className="text-lg font-medium {cn(theme.text.strong)} flex items-center">
                    <CircleStackIcon className="h-5 w-5 text-green-600 mr-2" />
                    Docker Containers ({maintenanceInfo.container_summary.containers.length})
                  </h3>
                </div>
                <Table<ContainerInfo>
                  data={maintenanceInfo.container_summary.containers}
                  keyExtractor={(container) => container.id}
                  emptyMessage="No Docker containers found"
                  columns={[
                    {
                      key: 'name',
                      header: 'Name',
                      render: (container) => (
                        <span className={cn('text-sm font-medium', theme.text.strong)}>
                          {container.name}
                        </span>
                      ),
                    },
                    {
                      key: 'id',
                      header: 'Container ID',
                      render: (container) => (
                        <span className={cn('text-sm font-mono', theme.text.muted)}>
                          {container.id.substring(0, 12)}
                        </span>
                      ),
                    },
                    {
                      key: 'image',
                      header: 'Image',
                      render: (container) => (
                        <span className={cn('text-sm', theme.text.muted)}>{container.image}</span>
                      ),
                    },
                    {
                      key: 'state',
                      header: 'State',
                      render: (container) => getStatusBadge(container.state),
                    },
                    {
                      key: 'status',
                      header: 'Status',
                      render: (container) => (
                        <span className={cn('text-sm', theme.text.muted)}>{container.status}</span>
                      ),
                    },
                    {
                      key: 'size',
                      header: 'Size',
                      render: (container) => (
                        <span className={cn('text-sm', theme.text.muted)}>
                          {formatBytes(container.size)}
                        </span>
                      ),
                    },
                    {
                      key: 'actions',
                      header: 'Actions',
                      render: (container) => (
                        <button
                          onClick={() =>
                            setDeleteConfirm({
                              type: 'container',
                              id: container.id,
                              name: container.name,
                            })
                          }
                          className={cn(theme.text.danger, 'hover:opacity-75')}
                          disabled={deleteMutation.isPending}
                        >
                          <TrashIcon className="h-4 w-4" />
                        </button>
                      ),
                    },
                  ]}
                />
              </div>
            )}

            {/* Volumes Tab */}
            {activeTab === 'volumes' && (
              <div className="{cn(theme.containers.panel)} rounded-lg shadow-sm border {cn(theme.cards.sectionDivider)} overflow-hidden">
                <div className="px-6 py-4 border-b {cn(theme.cards.sectionDivider)}">
                  <h3 className="text-lg font-medium {cn(theme.text.strong)} flex items-center">
                    <FolderIcon className="h-5 w-5 text-purple-600 mr-2" />
                    Docker Volumes ({maintenanceInfo.volume_summary.volumes.length})
                  </h3>
                </div>
                <Table<VolumeInfo>
                  data={maintenanceInfo.volume_summary.volumes}
                  keyExtractor={(volume) => volume.name}
                  emptyMessage="No Docker volumes found"
                  columns={[
                    {
                      key: 'name',
                      header: 'Name',
                      render: (volume) => (
                        <span className={cn('text-sm font-medium', theme.text.strong)}>
                          {volume.name}
                        </span>
                      ),
                    },
                    {
                      key: 'driver',
                      header: 'Driver',
                      render: (volume) => (
                        <span className={cn('text-sm', theme.text.muted)}>{volume.driver}</span>
                      ),
                    },
                    {
                      key: 'mountpoint',
                      header: 'Mountpoint',
                      render: (volume) => (
                        <span className={cn('text-sm max-w-xs truncate', theme.text.muted)}>
                          {volume.mountpoint}
                        </span>
                      ),
                    },
                    {
                      key: 'size',
                      header: 'Size',
                      render: (volume) => (
                        <span className={cn('text-sm', theme.text.muted)}>
                          {formatBytes(volume.size)}
                        </span>
                      ),
                    },
                    {
                      key: 'created',
                      header: 'Created',
                      render: (volume) => (
                        <span className={cn('text-sm', theme.text.muted)}>
                          {formatDate(volume.created)}
                        </span>
                      ),
                    },
                    {
                      key: 'status',
                      header: 'Status',
                      render: (volume) => getStatusBadge('active', volume.unused),
                    },
                    {
                      key: 'actions',
                      header: 'Actions',
                      render: (volume) => (
                        <button
                          onClick={() =>
                            setDeleteConfirm({
                              type: 'volume',
                              id: volume.name,
                              name: volume.name,
                            })
                          }
                          className={cn(theme.text.danger, 'hover:opacity-75')}
                          disabled={deleteMutation.isPending}
                        >
                          <TrashIcon className="h-4 w-4" />
                        </button>
                      ),
                    },
                  ]}
                />
              </div>
            )}

            {/* Networks Tab */}
            {activeTab === 'networks' && (
              <div className="{cn(theme.containers.panel)} rounded-lg shadow-sm border {cn(theme.cards.sectionDivider)} overflow-hidden">
                <div className="px-6 py-4 border-b {cn(theme.cards.sectionDivider)}">
                  <h3 className="text-lg font-medium {cn(theme.text.strong)} flex items-center">
                    <GlobeAltIcon className="h-5 w-5 text-indigo-600 mr-2" />
                    Docker Networks ({maintenanceInfo.network_summary.networks.length})
                  </h3>
                </div>
                <Table<NetworkInfo>
                  data={maintenanceInfo.network_summary.networks}
                  keyExtractor={(network) => network.id}
                  emptyMessage="No Docker networks found"
                  columns={[
                    {
                      key: 'name',
                      header: 'Name',
                      render: (network) => (
                        <span className={cn('text-sm font-medium', theme.text.strong)}>
                          {network.name}
                          {network.internal && (
                            <span className="ml-2 inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200">
                              Internal
                            </span>
                          )}
                        </span>
                      ),
                    },
                    {
                      key: 'id',
                      header: 'Network ID',
                      render: (network) => (
                        <span className={cn('text-sm font-mono', theme.text.muted)}>
                          {network.id.substring(0, 12)}
                        </span>
                      ),
                    },
                    {
                      key: 'driver',
                      header: 'Driver',
                      render: (network) => (
                        <span className={cn('text-sm', theme.text.muted)}>{network.driver}</span>
                      ),
                    },
                    {
                      key: 'scope',
                      header: 'Scope',
                      render: (network) => (
                        <span className={cn('text-sm', theme.text.muted)}>{network.scope}</span>
                      ),
                    },
                    {
                      key: 'subnet',
                      header: 'Subnet',
                      render: (network) => (
                        <span className={cn('text-sm font-mono', theme.text.muted)}>
                          {network.subnet || 'N/A'}
                        </span>
                      ),
                    },
                    {
                      key: 'created',
                      header: 'Created',
                      render: (network) => (
                        <span className={cn('text-sm', theme.text.muted)}>
                          {formatDate(network.created)}
                        </span>
                      ),
                    },
                    {
                      key: 'status',
                      header: 'Status',
                      render: (network) => getStatusBadge('active', network.unused),
                    },
                    {
                      key: 'actions',
                      header: 'Actions',
                      render: (network) => (
                        <button
                          onClick={() =>
                            setDeleteConfirm({
                              type: 'network',
                              id: network.id,
                              name: network.name,
                            })
                          }
                          className={cn(theme.text.danger, 'hover:opacity-75')}
                          disabled={
                            deleteMutation.isPending ||
                            ['bridge', 'host', 'none'].includes(network.name)
                          }
                        >
                          <TrashIcon className="h-4 w-4" />
                        </button>
                      ),
                    },
                  ]}
                />
              </div>
            )}

            {/* Actions Tab */}
            {activeTab === 'actions' && (
              <div className="space-y-6">
                {/* Cleanup Type Selection */}
                <div className="{cn(theme.containers.panel)} p-6 rounded-lg shadow-sm border {cn(theme.cards.sectionDivider)}">
                  <h3 className="text-lg font-medium {cn(theme.text.strong)} mb-6 flex items-center">
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
                      {
                        type: 'system' as const,
                        name: 'System',
                        description: 'Full system cleanup',
                      },
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
                              : '{cn(theme.cards.sectionDivider)} hover:border-gray-300 dark:hover:border-gray-600 {cn(theme.containers.panel)}'
                          }`}
                        >
                          <div className="flex items-start space-x-3">
                            <Icon
                              className={`h-6 w-6 mt-1 ${
                                isSelected
                                  ? 'text-blue-600 dark:text-blue-400'
                                  : '{cn(theme.text.muted)}'
                              }`}
                            />
                            <div className="flex-1 min-w-0">
                              <h4
                                className={`font-medium ${
                                  isSelected
                                    ? 'text-blue-900 dark:text-blue-100'
                                    : '{cn(theme.text.strong)}'
                                }`}
                              >
                                {name}
                              </h4>
                              <p className="text-sm {cn(theme.text.muted)} mt-1">{description}</p>
                              {stats && (
                                <div className="mt-2 text-xs space-y-1">
                                  <div className="flex justify-between">
                                    <span className="{cn(theme.text.muted)}">Total:</span>
                                    <span className="font-medium text-gray-700 dark:text-slate-300">
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
                                      <span className="{cn(theme.text.muted)}">Size:</span>
                                      <span className="font-medium text-gray-700 dark:text-slate-300">
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
                          className="ml-2 block text-sm {cn(theme.text.strong)}"
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
                <div className="{cn(theme.containers.panel)} p-6 rounded-lg shadow-sm border {cn(theme.cards.sectionDivider)}">
                  <h4 className="text-md font-medium {cn(theme.text.strong)} mb-4">
                    System Overview
                  </h4>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="text-center">
                      <div className="text-2xl font-bold text-blue-600">
                        {maintenanceInfo?.image_summary.total_count || 0}
                      </div>
                      <div className="text-sm {cn(theme.text.muted)}">Images</div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold text-green-600">
                        {maintenanceInfo?.container_summary.total_count || 0}
                      </div>
                      <div className="text-sm {cn(theme.text.muted)}">Containers</div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold text-purple-600">
                        {maintenanceInfo?.volume_summary.total_count || 0}
                      </div>
                      <div className="text-sm {cn(theme.text.muted)}">Volumes</div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold text-indigo-600">
                        {maintenanceInfo?.network_summary.total_count || 0}
                      </div>
                      <div className="text-sm {cn(theme.text.muted)}">Networks</div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </Tabs>
      )}

      {/* Prune Confirmation Modal */}
      <ConfirmationModal
        isOpen={showConfirm}
        onClose={() => setShowConfirm(false)}
        onConfirm={handlePrune}
        title="Confirm Cleanup"
        message={getPruneDescription(selectedPruneType)}
        variant="danger"
        isLoading={pruneMutation.isPending}
      />

      {/* Delete Confirmation Modal */}
      <ConfirmationModal
        isOpen={!!deleteConfirm}
        onClose={() => setDeleteConfirm(null)}
        onConfirm={handleDelete}
        title="Confirm Deletion"
        message={`Are you sure you want to delete this ${deleteConfirm?.type}?\n\n${deleteConfirm?.name || deleteConfirm?.id}`}
        confirmText="Delete"
        variant="danger"
        isLoading={deleteMutation.isPending}
      />
    </Layout>
  );
};

export default Maintenance;
