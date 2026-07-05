import { useState, useCallback, useEffect } from 'react';
import { useParams } from '@tanstack/react-router';
import { useStackDetailsPage } from '../hooks/useStackDetailsPage';
import { AdvancedOperationsModal } from '../../operations/components/AdvancedOperationsModal';
import { EmptyState } from '../../../shared/components/EmptyState';
import { LoadingSpinner } from '../../../shared/components/LoadingSpinner';
import { ServerStackProvider } from '../../../shared/contexts/ServerStackContext';
import { ImageUpdateBanner } from '../../image-updates/components';
import { useStackImageUpdates } from '../../image-updates/hooks/useStackImageUpdates';
import { ExclamationTriangleIcon } from '@heroicons/react/24/outline';
import { ComposeEditorModal } from '../../compose-editor/components/ComposeEditorModal';
import { useDocumentTitle } from '../../../shared/hooks/useDocumentTitle';
import { useGetApiV1ServersServerid } from '../../../api/generated/servers/servers';

import {
  PERM_STACKS_MANAGE,
  PERM_LOGS_READ,
  PERM_FILES_READ,
  PERM_FILES_WRITE,
} from '../../../shared/constants/permissions';
import { SectionTabs } from '../../../shared/components/SectionTabs';
import type { Tab } from '../../../shared/components/Tabs';
import { SidebarSelection } from '../components/sidebar/types';
import { StackToolbar } from '../components/toolbar/StackToolbar';
import { StackStatusBar } from '../components/statusbar/StackStatusBar';
import { StackContent } from '../components/content/StackContent';
import {
  ViewColumnsIcon,
  CubeIcon,
  DocumentTextIcon,
  FolderIcon,
  ChartBarIcon,
  ShieldExclamationIcon,
  Square2StackIcon,
  CircleStackIcon,
} from '@heroicons/react/24/outline';

const TAB_FOR_SELECTION: Record<SidebarSelection['type'], string> = {
  overview: 'overview',
  services: 'services',
  service: 'services',
  resources: 'resources',
  network: 'resources',
  volume: 'resources',
  environment: 'resources',
  logs: 'logs',
  files: 'files',
  stats: 'stats',
  security: 'security',
  images: 'images',
};

export default function StackDetails() {
  const params = useParams({ strict: false }) as { serverid?: string; stackname?: string };
  const serverid = Number(params.serverid);
  const stackname = params.stackname ?? '';
  const { data: serverResponse, isLoading: serverLoading } = useGetApiV1ServersServerid(serverid, {
    query: { enabled: Number.isFinite(serverid) && serverid > 0 },
  });
  const server = serverResponse?.data?.server;
  useDocumentTitle(server ? `${server.name} - ${stackname}` : stackname || 'Stack');
  const stack = useStackDetailsPage({ serverid, stackname });
  const [selection, setSelection] = useState<SidebarSelection | null>({ type: 'overview' });
  const [lastUpdated, setLastUpdated] = useState<Date | null>(new Date());
  const [composeEditorOpen, setComposeEditorOpen] = useState(false);

  const canManageStack = stack.stackPermissions?.permissions?.includes(PERM_STACKS_MANAGE) ?? false;
  const canViewLogs = stack.stackPermissions?.permissions?.includes(PERM_LOGS_READ) ?? false;
  const canViewFiles = stack.stackPermissions?.permissions?.includes(PERM_FILES_READ) ?? false;
  const canWriteFiles = stack.stackPermissions?.permissions?.includes(PERM_FILES_WRITE) ?? false;

  const { updates, lastChecked } = useStackImageUpdates({
    serverid,
    stackname,
    enabled: true,
  });

  const handleRefresh = useCallback(() => {
    stack.handleRefreshAll();
    setLastUpdated(new Date());
  }, [stack]);

  useEffect(() => {
    if (selection?.type === 'stats') {
      stack.setActiveTab('stats');
    } else {
      stack.setActiveTab('services');
    }
  }, [selection, stack.setActiveTab]);

  const activeTab = TAB_FOR_SELECTION[selection?.type ?? 'overview'];

  const sectionTabs: Tab[] = [
    { id: 'overview', label: 'Overview', icon: ViewColumnsIcon },
    {
      id: 'services',
      label: 'Services',
      icon: CubeIcon,
      badge: stack.stackDetails?.services?.length,
    },
    { id: 'logs', label: 'Logs', icon: DocumentTextIcon, disabled: !canViewLogs },
    { id: 'files', label: 'Files', icon: FolderIcon, disabled: !canViewFiles },
    { id: 'stats', label: 'Stats', icon: ChartBarIcon },
    { id: 'security', label: 'Security', icon: ShieldExclamationIcon },
    { id: 'images', label: 'Images', icon: Square2StackIcon },
    { id: 'resources', label: 'Resources', icon: CircleStackIcon },
  ];

  const handleTabChange = useCallback((id: string) => {
    setSelection({ type: id } as SidebarSelection);
  }, []);

  if (serverLoading || !server) {
    return <LoadingSpinner size="lg" text="Loading server..." fullScreen />;
  }

  return (
    <>
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
            <ImageUpdateBanner
              updates={updates}
              lastChecked={lastChecked}
              onViewDetails={() => setSelection({ type: 'images' })}
            />

            <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
              <div className="flex-shrink-0 border-b border-zinc-200 dark:border-zinc-800">
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
                  onAdvancedOperations={() => stack.setAdvancedOperationsOpen(true)}
                  onOpenComposeEditor={() => setComposeEditorOpen(true)}
                />
              </div>

              <SectionTabs
                tabs={sectionTabs}
                activeTab={activeTab}
                onTabChange={handleTabChange}
                aria-label="Stack sections"
              />

              <div className="flex-1 min-h-0 overflow-auto bg-white dark:bg-zinc-900">
                <StackContent
                  selection={selection}
                  serverid={serverid}
                  stackname={stackname}
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
                  onSelectService={(serviceName) => setSelection({ type: 'service', serviceName })}
                  onSelect={setSelection}
                  imageUpdates={updates}
                />
              </div>

              <div className="flex-shrink-0 border-t border-zinc-200 dark:border-zinc-800">
                <StackStatusBar
                  services={stack.stackDetails.services || []}
                  connectionStatus={stack.connectionStatus}
                  lastUpdated={lastUpdated}
                  isOperationRunning={stack.quickOperationState.isRunning}
                  runningOperation={stack.quickOperationState.operation}
                />
              </div>
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
          <AdvancedOperationsModal
            config={{
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
        <ComposeEditorModal
          isOpen={composeEditorOpen}
          onClose={() => setComposeEditorOpen(false)}
          serverId={serverid}
          stackName={stackname}
          composeFile={stack.stackDetails?.compose_file || 'compose.yaml'}
        />
      </ServerStackProvider>
    </>
  );
}
