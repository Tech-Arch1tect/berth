import React from 'react';
import { Head } from '@inertiajs/react';
import Layout from '../../components/layout/Layout';
import { cn } from '../../utils/cn';
import { theme } from '../../theme';
import { Server } from '../../types/server';
import { useStackDetailsPage } from '../../hooks/useStackDetailsPage';
import NetworkList from '../../components/stacks/resources/NetworkList';
import VolumeList from '../../components/stacks/resources/VolumeList';
import EnvironmentVariableList from '../../components/stacks/resources/EnvironmentVariableList';
import StackStats from '../../components/stacks/StackStats';
import LogViewer from '../../components/logs/LogViewer';
import { GlobalOperationsTracker } from '../../components/operations/GlobalOperationsTracker';
import { FileManager } from '../../components/files/FileManager';
import { EmptyState } from '../../components/common/EmptyState';
import { LoadingSpinner } from '../../components/common/LoadingSpinner';
import { Breadcrumb } from '../../components/common/Breadcrumb';
import { Tabs } from '../../components/common/Tabs';
import { StackImagesTab } from '../../components/stacks/images';
import { ComposeEditor } from '../../components/compose';
import { StackHeader } from '../../components/stacks/details/StackHeader';
import { StackQuickStats } from '../../components/stacks/details/StackQuickStats';
import { StackInfoCard } from '../../components/stacks/details/StackInfoCard';
import { StackServicesTab } from '../../components/stacks/details/StackServicesTab';
import { ServerStackProvider } from '../../contexts/ServerStackContext';
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
  const stack = useStackDetailsPage({ serverid, stackname });

  const canManageStack = stack.stackPermissions?.permissions?.includes('stacks.manage') ?? false;

  return (
    <Layout>
      <Head title={title} />
      <ServerStackProvider serverId={serverid} stackName={stackname} serverName={server.name}>
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
        {stack.stackDetails && (
          <div className="mb-8">
            <StackHeader
              stackname={stackname}
              server={server}
              connectionStatus={stack.connectionStatus}
              services={stack.stackDetails.services}
              serviceCount={stack.stackDetails.services?.length || 0}
              containerCount={
                stack.stackDetails.services?.reduce(
                  (total, service) => total + (service.containers?.length || 0),
                  0
                ) || 0
              }
              canManageStack={canManageStack}
              onQuickOperation={stack.handleQuickOperation}
              quickOperationState={stack.quickOperationState}
              onGenerateDocumentation={stack.handleGenerateDocumentation}
              onRefresh={stack.handleRefreshAll}
              isRefreshing={stack.isFetching}
              onOpenAdvancedOperations={() => stack.setAdvancedOperationsOpen(true)}
            />
          </div>
        )}

        {/* Main Content */}
        {stack.loading ? (
          <LoadingSpinner size="lg" text="Loading stack details..." />
        ) : stack.error ? (
          <EmptyState
            icon={ExclamationTriangleIcon}
            title="Error loading stack details"
            description={stack.error?.message || 'Unable to connect to the Docker stack.'}
            variant="error"
            size="lg"
            action={{
              label: 'Try Again',
              onClick: () => stack.refetch(),
            }}
          />
        ) : stack.stackDetails ? (
          <div className="space-y-8">
            {/* Quick Stats Grid */}
            <StackQuickStats
              serviceCount={stack.stackDetails.services?.length || 0}
              containerCount={
                stack.stackDetails.services?.reduce(
                  (total, service) => total + (service.containers?.length || 0),
                  0
                ) || 0
              }
              networkCount={stack.networks?.length || 0}
              volumeCount={stack.volumes?.length || 0}
            />

            {/* Stack Info Card */}
            <StackInfoCard
              composeFile={stack.stackDetails.compose_file}
              stackPath={stack.stackDetails.path}
            />

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
                  hidden: !stack.stackPermissions?.permissions?.includes('logs.read'),
                },
                {
                  id: 'files',
                  label: 'Files',
                  icon: FolderIcon,
                  hidden: !stack.stackPermissions?.permissions?.includes('files.read'),
                },
              ]}
              activeTab={stack.activeTab}
              onTabChange={(tabId) => stack.setActiveTab(tabId as typeof stack.activeTab)}
              className="rounded-2xl"
            >
              {stack.activeTab === 'services' && (
                <StackServicesTab
                  services={stack.stackDetails.services || []}
                  onQuickOperation={stack.handleQuickOperation}
                  quickOperationState={stack.quickOperationState}
                  expandedServices={stack.expandedServices}
                  onToggleExpand={stack.toggleServiceExpanded}
                  onExpandAll={stack.handleExpandAll}
                  onCollapseAll={stack.handleCollapseAll}
                  canManageStack={canManageStack}
                  onEditCompose={() => stack.setShowComposeEditor(true)}
                />
              )}

              {stack.activeTab === 'networks' && (
                <NetworkList
                  networks={stack.networks || []}
                  isLoading={stack.networksLoading}
                  error={stack.networksError}
                />
              )}

              {stack.activeTab === 'volumes' && (
                <VolumeList
                  volumes={stack.volumes || []}
                  isLoading={stack.volumesLoading}
                  error={stack.volumesError}
                />
              )}

              {stack.activeTab === 'environment' && (
                <EnvironmentVariableList
                  environmentData={stack.environmentVariables || {}}
                  isLoading={stack.environmentLoading}
                  error={stack.environmentError}
                />
              )}

              {stack.activeTab === 'images' && <StackImagesTab />}

              {stack.activeTab === 'stats' && (
                <StackStats
                  containers={stack.stackStats?.containers || []}
                  isLoading={stack.statsLoading}
                  error={stack.statsError}
                />
              )}

              {stack.activeTab === 'logs' &&
                stack.stackPermissions?.permissions?.includes('logs.read') && (
                  <LogViewer
                    containers={
                      stack.stackStats?.containers?.map((container) => ({
                        name: container.name,
                        service_name: container.service_name,
                      })) || []
                    }
                  />
                )}

              {stack.activeTab === 'files' &&
                stack.stackPermissions?.permissions?.includes('files.read') && (
                  <FileManager
                    canRead={stack.stackPermissions.permissions.includes('files.read')}
                    canWrite={stack.stackPermissions.permissions.includes('files.write')}
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
        {stack.advancedOperationsOpen && (
          <GlobalOperationsTracker
            advancedMode={{
              serverid: String(serverid),
              stackname,
              services:
                stack.stackDetails?.services?.map((service) => ({
                  name: service.name,
                  service_name: service.name,
                })) || [],
              onClose: () => stack.setAdvancedOperationsOpen(false),
            }}
          />
        )}

        {/* Compose Editor Modal */}
        {stack.showComposeEditor && stack.stackDetails && stack.stackDetails.services && (
          <ComposeEditor
            services={stack.stackDetails.services}
            onUpdate={stack.handleComposeUpdate}
            onClose={() => stack.setShowComposeEditor(false)}
          />
        )}
      </ServerStackProvider>
    </Layout>
  );
};

export default StackDetails;
