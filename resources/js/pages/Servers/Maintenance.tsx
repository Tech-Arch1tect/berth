import { useState } from 'react';
import { Head } from '@inertiajs/react';
import { ServerNavigation } from '../../components/layout/ServerNavigation';
import { Server } from '../../types/server';
import { LoadingSpinner } from '../../components/common/LoadingSpinner';
import { EmptyState } from '../../components/common/EmptyState';
import { ConfirmationModal } from '../../components/common/ConfirmationModal';
import { Breadcrumb } from '../../components/common/Breadcrumb';
import { PanelLayout } from '../../components/common/PanelLayout';
import {
  useMaintenanceInfo,
  useDockerPrune,
  useDeleteResource,
} from '../../hooks/useDockerMaintenance';
import { showToast } from '../../utils/toast';
import { formatBytes } from '../../utils/formatters';
import { ExclamationTriangleIcon } from '@heroicons/react/24/outline';
import {
  MaintenanceToolbar,
  MaintenanceSidebar,
  MaintenanceContent,
  MaintenanceStatusBar,
  MaintenanceOverview,
  MaintenanceImagesTab,
  MaintenanceContainersTab,
  MaintenanceVolumesTab,
  MaintenanceNetworksTab,
  MaintenanceActionsTab,
} from '../../components/maintenance';

interface MaintenanceProps {
  title: string;
  server: Server;
  serverid: number;
}

type TabType = 'overview' | 'images' | 'containers' | 'volumes' | 'networks' | 'actions';
type PruneType = 'images' | 'containers' | 'volumes' | 'networks' | 'build-cache' | 'system';
type DeleteResourceType = 'image' | 'container' | 'volume' | 'network';

const Maintenance: React.FC<MaintenanceProps> = ({ title, server, serverid }) => {
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
          filters: '',
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

  if (isLoading) {
    return (
      <>
        <Head title={title} />
        <LoadingSpinner size="lg" text="Loading maintenance information..." fullScreen />
      </>
    );
  }

  if (error) {
    return (
      <>
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
      </>
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

  return (
    <>
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
      <ServerNavigation serverId={serverid} serverName={server.name} />

      <PanelLayout
        storageKey="maintenance"
        sidebarTitle="Resources"
        defaultWidth={260}
        maxWidthPercent={35}
        toolbar={
          <MaintenanceToolbar
            serverName={server.name}
            onRefresh={refetch}
            isRefreshing={isLoading}
          />
        }
        sidebar={
          <MaintenanceSidebar
            activeTab={activeTab}
            onTabChange={(tabId) => setActiveTab(tabId as TabType)}
            summary={summary}
          />
        }
        content={
          <MaintenanceContent>
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
          </MaintenanceContent>
        }
        statusBar={<MaintenanceStatusBar summary={summary} />}
      />

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
};

export default Maintenance;
