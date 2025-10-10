import React, { useState } from 'react';
import { Head } from '@inertiajs/react';
import Layout from '../../components/Layout';
import { ServerNavigation } from '../../components/ServerNavigation';
import { Server } from '../../types/server';
import { cn } from '../../utils/cn';
import { theme } from '../../theme';
import { LoadingSpinner } from '../../components/common/LoadingSpinner';
import { EmptyState } from '../../components/common/EmptyState';
import { ConfirmationModal } from '../../components/common/ConfirmationModal';
import { Breadcrumb } from '../../components/common/Breadcrumb';
import { Tabs } from '../../components/common/Tabs';
import {
  useMaintenanceInfo,
  useDockerPrune,
  useDeleteResource,
  PruneRequest,
  DeleteRequest,
} from '../../hooks/useDockerMaintenance';
import { showToast } from '../../utils/toast';
import { formatBytes } from '../../utils/formatters';
import {
  DocumentDuplicateIcon,
  CircleStackIcon,
  FolderIcon,
  GlobeAltIcon,
  TrashIcon,
  ExclamationTriangleIcon,
  ChartBarIcon,
} from '@heroicons/react/24/outline';
import { MaintenanceOverview } from '../../components/maintenance/MaintenanceOverview';
import { MaintenanceImagesTab } from '../../components/maintenance/MaintenanceImagesTab';
import { MaintenanceContainersTab } from '../../components/maintenance/MaintenanceContainersTab';
import { MaintenanceVolumesTab } from '../../components/maintenance/MaintenanceVolumesTab';
import { MaintenanceNetworksTab } from '../../components/maintenance/MaintenanceNetworksTab';
import { MaintenanceActionsTab } from '../../components/maintenance/MaintenanceActionsTab';

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
            {activeTab === 'overview' && <MaintenanceOverview maintenanceInfo={maintenanceInfo} />}

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
