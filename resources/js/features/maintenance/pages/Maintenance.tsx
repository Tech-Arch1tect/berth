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
import {
  pruneDescription,
  pruneTypeLabels,
  removalRows,
  totalDiskUsage,
  type PruneType,
} from '../pruneModes';
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
  const [pruneAllByType, setPruneAllByType] = useState<Partial<Record<PruneType, boolean>>>({});
  const [showConfirm, setShowConfirm] = useState(false);
  const [isRechecking, setIsRechecking] = useState(false);
  const [confirmCounts, setConfirmCounts] = useState<{ shown: number; fresh: number } | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<{
    type: DeleteResourceType;
    id: string;
    name?: string;
  } | null>(null);

  const {
    data: maintenanceInfo,
    isLoading,
    isFetching,
    error,
    refetch,
  } = useMaintenanceInfo(serverid);
  const pruneMutation = useDockerPrune();
  const deleteMutation = useDeleteResource();

  const pruneAllFor = (type: PruneType) => pruneAllByType[type] ?? false;

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
      }
    } catch (error) {
      showToast.error(`Failed to delete ${deleteConfirm.type}`);
      console.error('Delete error:', error);
    } finally {
      setDeleteConfirm(null);
    }
  };

  const startPrune = async () => {
    const shownCount = removalRows(
      maintenanceInfo,
      selectedPruneType,
      pruneAllFor(selectedPruneType)
    ).length;

    setIsRechecking(true);
    const refreshed = await refetch();
    setIsRechecking(false);

    const label = pruneTypeLabels[selectedPruneType];
    if (refreshed.error || !refreshed.data) {
      showToast.error(`Could not re-read the Docker state, ${label} cleanup not started`);
      return;
    }

    const freshCount = removalRows(
      refreshed.data,
      selectedPruneType,
      pruneAllFor(selectedPruneType)
    ).length;

    if (freshCount === 0) {
      showToast.success(`${label} cleanup not needed, nothing left to remove`);
      return;
    }

    setConfirmCounts({ shown: shownCount, fresh: freshCount });
    setShowConfirm(true);
  };

  const confirmMessage = () => {
    const description = pruneDescription(selectedPruneType, pruneAllFor(selectedPruneType));
    if (!confirmCounts) return description;
    if (confirmCounts.shown !== confirmCounts.fresh) {
      return `This changed since you last looked: ${confirmCounts.fresh} will now be removed, not ${confirmCounts.shown}.\n\n${description}`;
    }
    return `${confirmCounts.fresh} will be removed.\n\n${description}`;
  };

  const handlePrune = async () => {
    if (!selectedPruneType) return;

    try {
      const result = await pruneMutation.mutateAsync({
        serverid,
        request: {
          type: selectedPruneType,
          all: pruneAllFor(selectedPruneType),
        },
      });

      const pruneData = result.data;
      const label = pruneTypeLabels[selectedPruneType];
      if (pruneData?.error) {
        showToast.error(`${label} cleanup failed: ${pruneData.error}`);
      } else if (pruneData?.items_deleted?.length) {
        showToast.success(`${label} cleanup finished, updated totals below`);
      } else {
        showToast.success(`${label} cleanup finished, nothing needed removing`);
      }
    } catch (error) {
      showToast.error('Failed to perform cleanup operation');
      console.error('Prune error:', error);
    } finally {
      setShowConfirm(false);
    }
  };

  if (serverLoading || !server) {
    return <LoadingSpinner size="lg" text="Loading server..." fullScreen />;
  }

  const summary = maintenanceInfo
    ? {
        totalImages: maintenanceInfo.image_summary.total.count,
        totalContainers: maintenanceInfo.container_summary.total.count,
        totalVolumes: maintenanceInfo.volume_summary.total.count,
        totalNetworks: maintenanceInfo.network_summary.total_count,
        spaceUsed: totalDiskUsage(maintenanceInfo),
        lastUpdated: maintenanceInfo.last_updated,
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
      <div className="px-4 pt-4 sm:px-6 lg:px-8">
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
      </div>

      <ServerNavigation serverId={serverid} serverName={server.name} />

      <div className="flex h-full min-h-0 flex-col overflow-hidden">
        <div className="flex-shrink-0 border-b border-zinc-200 dark:border-zinc-800">
          <MaintenanceToolbar
            serverName={server.name}
            onRefresh={refetch}
            isRefreshing={isFetching}
          />
        </div>

        <SectionTabs
          tabs={sectionTabs}
          activeTab={activeTab}
          onTabChange={(tabId) => setActiveTab(tabId as TabType)}
          aria-label="Maintenance sections"
        />

        <div className="min-h-0 flex-1 overflow-auto bg-white p-4 dark:bg-zinc-900 lg:p-6">
          {isLoading && <LoadingSpinner size="lg" text="Reading Docker disk usage..." />}

          {Boolean(error) && !maintenanceInfo && (
            <EmptyState
              icon={ExclamationTriangleIcon}
              title="Failed to load maintenance information"
              description={
                error instanceof Error ? error.message : 'The agent did not return disk usage.'
              }
              variant="error"
              size="lg"
              action={{
                label: 'Retry',
                onClick: () => refetch(),
              }}
            />
          )}

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
                  pruneAll={pruneAllFor(selectedPruneType)}
                  isPruning={pruneMutation.isPending}
                  isRechecking={isRechecking}
                  isFetching={isFetching}
                  onPruneTypeChange={setSelectedPruneType}
                  onPruneAllChange={(value) =>
                    setPruneAllByType((current) => ({ ...current, [selectedPruneType]: value }))
                  }
                  onStartPrune={startPrune}
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
        title={`Confirm ${pruneTypeLabels[selectedPruneType]} Cleanup`}
        message={confirmMessage()}
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
