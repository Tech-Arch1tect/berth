import React from 'react';
import { SidebarSelection } from '../sidebar/types';
import type {
  ComposeService,
  Network,
  Volume,
  GetApiV1ServersServeridStacksStacknameEnvironment200,
  ContainerStats,
} from '../../../api/generated/models';
import { OverviewPanel } from '../panels/OverviewPanel';
import { ServiceDetailPanel } from '../panels/ServiceDetailPanel';
import { NetworkDetailPanel } from '../panels/NetworkDetailPanel';
import { VolumeDetailPanel } from '../panels/VolumeDetailPanel';
import { EnvironmentPanel } from '../panels/EnvironmentPanel';
import { OperationRequest } from '../../../types/operations';
import StackStats from '../StackStats';
import LogViewer from '../../logs/LogViewer';
import { FileManager } from '../../files/FileManager';
import { VulnerabilityScanPanel } from '../../vulnerability-scan';
import { StackImagesTab } from '../images';
import { cn } from '../../../utils/cn';
import { theme } from '../../../theme';
import { CubeIcon } from '@heroicons/react/24/outline';

interface StackContentProps {
  selection: SidebarSelection | null;
  serverid: number;
  stackname: string;
  stackPath: string;
  composeFile: string;
  services: ComposeService[];
  networks: Network[];
  volumes: Volume[];
  environment: GetApiV1ServersServeridStacksStacknameEnvironment200;
  statsContainers: ContainerStats[];
  logContainers: Array<{ name: string; service_name: string }>;
  permissions: {
    canManage: boolean;
    canViewLogs: boolean;
    canViewFiles: boolean;
    canWriteFiles: boolean;
  };
  onQuickOperation: (operation: OperationRequest) => void;
  isOperationRunning: boolean;
  runningOperation?: string;
  statsLoading: boolean;
  statsError: Error | null;
  onSelectService?: (serviceName: string) => void;
}

export const StackContent: React.FC<StackContentProps> = ({
  selection,
  serverid,
  stackname,
  stackPath,
  composeFile,
  services,
  networks,
  volumes,
  environment,
  statsContainers,
  logContainers,
  permissions,
  onQuickOperation,
  isOperationRunning,
  runningOperation,
  statsLoading,
  statsError,
  onSelectService,
}) => {
  if (!selection) {
    return (
      <OverviewPanel
        stackPath={stackPath}
        composeFile={composeFile}
        services={services}
        networks={networks}
        volumes={volumes}
        canManage={permissions.canManage}
        onQuickOperation={onQuickOperation}
        isOperationRunning={isOperationRunning}
        runningOperation={runningOperation}
        onServiceClick={onSelectService}
      />
    );
  }

  switch (selection.type) {
    case 'overview':
      return (
        <OverviewPanel
          stackPath={stackPath}
          composeFile={composeFile}
          services={services}
          networks={networks}
          volumes={volumes}
          canManage={permissions.canManage}
          onQuickOperation={onQuickOperation}
          isOperationRunning={isOperationRunning}
          runningOperation={runningOperation}
          onServiceClick={onSelectService}
        />
      );

    case 'service': {
      const service = services.find((s) => s.name === selection.serviceName);
      if (!service) {
        return (
          <div className="flex items-center justify-center h-full">
            <div className="text-center">
              <CubeIcon className={cn('w-12 h-12 mx-auto mb-4', theme.text.subtle)} />
              <p className={cn('text-lg font-medium', theme.text.muted)}>Service not found</p>
              <p className={cn('text-sm', theme.text.subtle)}>
                The service "{selection.serviceName}" could not be found
              </p>
            </div>
          </div>
        );
      }
      return (
        <ServiceDetailPanel
          service={service}
          canManage={permissions.canManage}
          canViewLogs={permissions.canViewLogs}
          onQuickOperation={onQuickOperation}
          isOperationRunning={isOperationRunning}
          runningOperation={runningOperation}
        />
      );
    }

    case 'network': {
      const network = networks.find((n) => n.name === selection.networkName);
      if (!network) {
        return (
          <div className="flex items-center justify-center h-full">
            <div className="text-center">
              <p className={cn('text-lg font-medium', theme.text.muted)}>Network not found</p>
            </div>
          </div>
        );
      }
      return <NetworkDetailPanel network={network} />;
    }

    case 'volume': {
      const volume = volumes.find((v) => v.name === selection.volumeName);
      if (!volume) {
        return (
          <div className="flex items-center justify-center h-full">
            <div className="text-center">
              <p className={cn('text-lg font-medium', theme.text.muted)}>Volume not found</p>
            </div>
          </div>
        );
      }
      return <VolumeDetailPanel volume={volume} />;
    }

    case 'environment':
      return <EnvironmentPanel environment={environment} />;

    case 'stats':
      return (
        <div className="h-full overflow-auto p-6">
          <StackStats containers={statsContainers} isLoading={statsLoading} error={statsError} />
        </div>
      );

    case 'logs':
      if (!permissions.canViewLogs) {
        return (
          <div className="flex items-center justify-center h-full">
            <div className="text-center">
              <p className={cn('text-lg font-medium', theme.text.muted)}>Permission denied</p>
              <p className={cn('text-sm', theme.text.subtle)}>
                You don't have permission to view logs
              </p>
            </div>
          </div>
        );
      }
      return (
        <div className="h-full">
          <LogViewer containers={logContainers} />
        </div>
      );

    case 'files':
      if (!permissions.canViewFiles) {
        return (
          <div className="flex items-center justify-center h-full">
            <div className="text-center">
              <p className={cn('text-lg font-medium', theme.text.muted)}>Permission denied</p>
              <p className={cn('text-sm', theme.text.subtle)}>
                You don't have permission to view files
              </p>
            </div>
          </div>
        );
      }
      return (
        <div className="h-full">
          <FileManager canRead={permissions.canViewFiles} canWrite={permissions.canWriteFiles} />
        </div>
      );

    case 'security':
      return (
        <div className="h-full">
          <VulnerabilityScanPanel
            serverid={serverid}
            stackname={stackname}
            canManage={permissions.canManage}
            services={services.map((s) => s.name)}
          />
        </div>
      );

    case 'images':
      return (
        <div className="h-full overflow-auto p-6">
          <StackImagesTab />
        </div>
      );

    default:
      return (
        <div className="flex items-center justify-center h-full">
          <div className="text-center">
            <p className={cn('text-lg font-medium', theme.text.muted)}>Select an item</p>
            <p className={cn('text-sm', theme.text.subtle)}>
              Choose a service, resource, or tool from the sidebar
            </p>
          </div>
        </div>
      );
  }
};
