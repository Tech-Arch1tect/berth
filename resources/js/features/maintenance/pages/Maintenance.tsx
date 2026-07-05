import { useState } from 'react';
import { useParams } from '@tanstack/react-router';
import { ServerNavigation } from '../../../shared/layout/ServerNavigation';
import { LoadingSpinner } from '../../../shared/components/LoadingSpinner';
import { EmptyState } from '../../../shared/components/EmptyState';
import { ConfirmationModal } from '../../../shared/components/ConfirmationModal';
import { Breadcrumb } from '../../../shared/components/Breadcrumb';
import { SectionTabs } from '../../../shared/components/SectionTabs';
import type { Tab } from '../../../shared/components/Tabs';
import { useDocumentTitle } from '../../../shared/hooks/useDocumentTitle';
import { useGetApiV1ServersServerid } from '../../../api/generated/servers/servers';
import {
  useMaintenanceInfo,
  useDockerPrune,
  useDeleteResource,
} from '../hooks/useDockerMaintenance';
import { showToast } from '../../../shared/utils/toast';
import { formatBytes } from '../../../shared/utils/formatters';
import {
  ChartBarIcon,
  CircleStackIcon,
  DocumentDuplicateIcon,
  ExclamationTriangleIcon,
  FolderIcon,
  GlobeAltIcon,
  TrashIcon,
} from '@heroicons/react/24/outline';
import {
  MaintenanceToolbar,
  MaintenanceStatusBar,
  MaintenanceOverview,
  MaintenanceImagesTab,
  MaintenanceContainersTab,
  MaintenanceVolumesTab,
  MaintenanceNetworksTab,
  MaintenanceActionsTab,
} from '../components';

type TabType = 'overview' | 'images' | 'containers' | 'volumes' | 'networks' | 'actions';
type PruneType = 'images' | 'containers' | 'volumes' | 'networks' | 'build-cache' | 'system';
type DeleteResourceType = 'image' | 'container' | 'volume' | 'network';

export default function Maintenance() {
  const params = useParams({ strict: false }) as { serverid?: string };
  const serverid = Number(params.serverid);
  const { data: serverResponse, isLoading: serverLoading } = useGetApiV1ServersServerid(serverid, {
    query: { enabled: Number.isFinite(serverid) && serverid > 0 },
  });
  const server = serverResponse?.data?.server;
  useDocumentTitle(server ? `Docker Maintenance - ${server.name}` : 'Docker Maintenance');
  const [activeTab, setActiveTab] = useState<TabType>('overview');
  const [selectedPruneType, setSelectedPruneType] = useState<PruneType>('images');
  const [pruneAll, setPruneAll] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<{
    type: DeleteResourceType;
    id: string;
    name?: string;
  } | null>(null);

  const { data: maintenanceInfo, isLoading, error, refetch } = useMaintenanceInfo(serverid);
  const pruneMutation = useDockerPrune();
  const deleteMutation = useDeleteResource();

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

      if (result.data?.error) {
        showToast.error(`Failed to delete ${deleteConfirm.type}: ${result.data.error}`);
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
          filters: '',
        },
      });

      const pruneData = result.data;
      if (pruneData?.error) {
        showToast.error(`Cleanup failed: ${pruneData.error}`);
      } else {
        const itemCount = pruneData?.items_deleted ? pruneData.items_deleted.length : 0;
        const spaceFreed = formatBytes(pruneData?.space_reclaimed || 0);
        if (itemCount === 0 && (pruneData?.space_reclaimed || 0) === 0) {
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

  const getPruneDescription = (type: PruneType): string => {
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

  if (serverLoading || !server) {
    return <LoadingSpinner size="lg" text="Loading server..." fullScreen />;
  }

  if (isLoading) {
    return <LoadingSpinner size="lg" text="Loading maintenance information..." fullScreen />;
  }

  if (error) {
    return (
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
    );
  }

  const summary = maintenanceInfo
    ? {
        totalImages: maintenanceInfo.image_summary.total_count,
        totalContainers: maintenanceInfo.container_summary.total_count,
        totalVolumes: maintenanceInfo.volume_summary.total_count,
        totalNetworks: maintenanceInfo.network_summary.total_count,
        spaceUsed: maintenanceInfo.image_summary.total_size,
      }
    : undefined;

  const sectionTabs: Tab[] = [
    { id: 'overview', label: 'Overview', icon: ChartBarIcon },
    {
      id: 'images',
      label: 'Images',
      icon: DocumentDuplicateIcon,
      badge: summary?.totalImages,
    },
    {
      id: 'containers',
      label: 'Containers',
      icon: CircleStackIcon,
      badge: summary?.totalContainers,
    },
    { id: 'volumes', label: 'Volumes', icon: FolderIcon, badge: summary?.totalVolumes },
    { id: 'networks', label: 'Networks', icon: GlobeAltIcon, badge: summary?.totalNetworks },
    { id: 'actions', label: 'Cleanup', icon: TrashIcon },
  ];

  return (
    <>
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

      <ServerNavigation serverId={serverid} serverName={server.name} />

      <div className="flex h-full min-h-0 flex-col overflow-hidden">
        <div className="flex-shrink-0 border-b border-zinc-200 dark:border-zinc-800">
          <MaintenanceToolbar
            serverName={server.name}
            onRefresh={refetch}
            isRefreshing={isLoading}
          />
        </div>

        <SectionTabs
          tabs={sectionTabs}
          activeTab={activeTab}
          onTabChange={(tabId) => setActiveTab(tabId as TabType)}
          aria-label="Maintenance sections"
        />

        <div className="min-h-0 flex-1 overflow-auto bg-white p-4 dark:bg-zinc-900 lg:p-6">
          {maintenanceInfo && (
            <>
              {activeTab === 'overview' && (
                <MaintenanceOverview maintenanceInfo={maintenanceInfo} />
              )}

              {activeTab === 'images' && (
                <MaintenanceImagesTab
                  images={maintenanceInfo.image_summary.images}
                  onDelete={setDeleteConfirm}
                  isDeleting={deleteMutation.isPending}
                />
              )}

              {activeTab === 'containers' && (
                <MaintenanceContainersTab
                  containers={maintenanceInfo.container_summary.containers}
                  onDelete={setDeleteConfirm}
                  isDeleting={deleteMutation.isPending}
                />
              )}

              {activeTab === 'volumes' && (
                <MaintenanceVolumesTab
                  volumes={maintenanceInfo.volume_summary.volumes}
                  onDelete={setDeleteConfirm}
                  isDeleting={deleteMutation.isPending}
                />
              )}

              {activeTab === 'networks' && (
                <MaintenanceNetworksTab
                  networks={maintenanceInfo.network_summary.networks}
                  onDelete={setDeleteConfirm}
                  isDeleting={deleteMutation.isPending}
                />
              )}

              {activeTab === 'actions' && (
                <MaintenanceActionsTab
                  maintenanceInfo={maintenanceInfo}
                  selectedPruneType={selectedPruneType}
                  pruneAll={pruneAll}
                  isPruning={pruneMutation.isPending}
                  isLoading={isLoading}
                  onPruneTypeChange={setSelectedPruneType}
                  onPruneAllChange={setPruneAll}
                  onStartPrune={() => setShowConfirm(true)}
                  onRefresh={refetch}
                />
              )}
            </>
          )}
        </div>

        <div className="flex-shrink-0 border-t border-zinc-200 bg-zinc-50 px-4 py-2 dark:border-zinc-800 dark:bg-zinc-800/50">
          <MaintenanceStatusBar summary={summary} />
        </div>
      </div>

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
    </>
  );
}
