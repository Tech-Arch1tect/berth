import React, { useState, useCallback } from 'react';
import { Head } from '@inertiajs/react';
import { Server } from '../../types/server';
import { useStackDetailsPage } from '../../hooks/useStackDetailsPage';
import { GlobalOperationsTracker } from '../../components/operations/GlobalOperationsTracker';
import { EmptyState } from '../../components/common/EmptyState';
import { LoadingSpinner } from '../../components/common/LoadingSpinner';
import { ComposeEditor } from '../../components/compose';
import { ServerStackProvider } from '../../contexts/ServerStackContext';
import { ImageUpdateBanner } from '../../components/image-updates';
import { useStackImageUpdates } from '../../hooks/useStackImageUpdates';
import { ExclamationTriangleIcon } from '@heroicons/react/24/outline';
import Layout from '../../components/layout/Layout';

import { StackDetailsLayout } from '../../components/stacks/layout/StackDetailsLayout';
import { StackSidebar } from '../../components/stacks/sidebar/StackSidebar';
import { SidebarSelection } from '../../components/stacks/sidebar/types';
import { StackToolbar } from '../../components/stacks/toolbar/StackToolbar';
import { StackStatusBar } from '../../components/stacks/statusbar/StackStatusBar';
import { StackContent } from '../../components/stacks/content/StackContent';

interface StackDetailsProps {
  title: string;
  server: Server;
  serverid: number;
  stackname: string;
}

type StackDetailsComponent = React.FC<StackDetailsProps> & {
  layout?: (page: React.ReactElement) => React.ReactElement;
};

const StackDetails: StackDetailsComponent = ({ title, server, serverid, stackname }) => {
  const stack = useStackDetailsPage({ serverid, stackname });
  const [selection, setSelection] = useState<SidebarSelection | null>({ type: 'overview' });
  const [lastUpdated, setLastUpdated] = useState<Date | null>(new Date());

  const canManageStack = stack.stackPermissions?.permissions?.includes('stacks.manage') ?? false;
  const canViewLogs = stack.stackPermissions?.permissions?.includes('logs.read') ?? false;
  const canViewFiles = stack.stackPermissions?.permissions?.includes('files.read') ?? false;
  const canWriteFiles = stack.stackPermissions?.permissions?.includes('files.write') ?? false;

  const { updates, hasUpdates, lastChecked } = useStackImageUpdates({
    serverid,
    stackname,
    enabled: true,
  });

  const handleRefresh = useCallback(() => {
    stack.handleRefreshAll();
    setLastUpdated(new Date());
  }, [stack]);

  React.useEffect(() => {
    if (selection?.type === 'stats') {
      stack.setActiveTab('stats');
    } else {
      stack.setActiveTab('services');
    }
  }, [selection, stack.setActiveTab]);

  return (
    <>
      <Head title={title} />
      <ServerStackProvider serverId={serverid} stackName={stackname} serverName={server.name}>
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
          <div className="h-full flex flex-col">
            {/* Image Update Banner */}
            {hasUpdates && (
              <ImageUpdateBanner
                updates={updates}
                stackName={stackname}
                lastChecked={lastChecked}
              />
            )}

            <div className="flex-1 min-h-0">
              <StackDetailsLayout
                toolbar={
                  <StackToolbar
                    stackName={stackname}
                    serverName={server.name}
                    serverId={serverid}
                    services={stack.stackDetails.services || []}
                    connectionStatus={stack.connectionStatus}
                    canManage={canManageStack}
                    isOperationRunning={stack.quickOperationState.isRunning}
                    runningOperation={stack.quickOperationState.operation}
                    isRefreshing={stack.isFetching}
                    selection={selection}
                    onQuickOperation={stack.handleQuickOperation}
                    onRefresh={handleRefresh}
                    onCopyDocs={stack.handleCopyDocumentation}
                    onDownloadDocs={stack.handleDownloadDocumentation}
                    onEditCompose={() => stack.setShowComposeEditor(true)}
                    onAdvancedOperations={() => stack.setAdvancedOperationsOpen(true)}
                  />
                }
                sidebar={
                  <StackSidebar
                    services={stack.stackDetails.services || []}
                    networks={stack.networks || []}
                    volumes={stack.volumes || []}
                    selection={selection}
                    onSelect={setSelection}
                    permissions={{
                      canViewLogs,
                      canViewFiles,
                    }}
                  />
                }
                content={
                  <StackContent
                    selection={selection}
                    stackPath={stack.stackDetails.path || ''}
                    composeFile={stack.stackDetails.compose_file || ''}
                    services={stack.stackDetails.services || []}
                    networks={stack.networks || []}
                    volumes={stack.volumes || []}
                    environment={stack.environmentVariables || {}}
                    statsContainers={stack.stackStats?.containers || []}
                    logContainers={
                      stack.stackDetails.services?.flatMap((s) =>
                        s.containers.map((c) => ({ name: c.name, service_name: s.name }))
                      ) || []
                    }
                    permissions={{
                      canManage: canManageStack,
                      canViewLogs,
                      canViewFiles,
                      canWriteFiles,
                    }}
                    onQuickOperation={stack.handleQuickOperation}
                    isOperationRunning={stack.quickOperationState.isRunning}
                    runningOperation={stack.quickOperationState.operation}
                    statsLoading={stack.statsLoading ?? false}
                    statsError={stack.statsError ?? null}
                    onSelectService={(serviceName) =>
                      setSelection({ type: 'service', serviceName })
                    }
                  />
                }
                statusBar={
                  <StackStatusBar
                    services={stack.stackDetails.services || []}
                    connectionStatus={stack.connectionStatus}
                    lastUpdated={lastUpdated}
                    isOperationRunning={stack.quickOperationState.isRunning}
                    runningOperation={stack.quickOperationState.operation}
                  />
                }
              />
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
            serverId={serverid}
            stackName={stackname}
            onUpdate={stack.handleComposeUpdate}
            onClose={() => stack.setShowComposeEditor(false)}
          />
        )}
      </ServerStackProvider>
    </>
  );
};

StackDetails.layout = (page: React.ReactElement) => <Layout>{page}</Layout>;

export default StackDetails;
