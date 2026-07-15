import type { FC } from 'react';
import { SidebarSelection } from '../sidebar/types';
import type {
  ComposeService,
  Network,
  Volume,
  StackEnvironmentDataServices,
  ContainerStats,
  ImageUpdate,
} from '../../../../api/generated/models';
import { OverviewPanel } from '../panels/OverviewPanel';
import { BackBar } from '../../../../shared/components/BackBar';
import { ServicesListPanel } from '../panels/ServicesListPanel';
import { ResourcesListPanel } from '../panels/ResourcesListPanel';
import { ServiceDetailPanel } from '../panels/ServiceDetailPanel';
import { NetworkDetailPanel } from '../panels/NetworkDetailPanel';
import { VolumeDetailPanel } from '../panels/VolumeDetailPanel';
import { EnvironmentPanel } from '../panels/EnvironmentPanel';
import { OperationRequest } from '../../../operations/types';
import StackStats from '../StackStats';
import LogViewer from '../../../logs/components/LogViewer';
import { FileManager } from '../../../files/components/FileManager';
import { VulnerabilityScanPanel } from '../../../vulnerability-scan/components';
import { BackupsPanel } from '../../../backups/components';
import { StackImagesTab } from '../images';
import { cn } from '../../../../shared/utils/cn';
import { theme } from '../../../../shared/theme';
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
  environment: StackEnvironmentDataServices;
  statsContainers: ContainerStats[];
  logContainers: Array<{ name: string; service_name: string }>;
  permissions: {
    canManage: boolean;
    canViewLogs: boolean;
    canViewFiles: boolean;
    canWriteFiles: boolean;
    canViewBackups: boolean;
    canManageBackups: boolean;
    canRestoreBackups: boolean;
  };
  onQuickOperation: (operation: OperationRequest) => void;
  isOperationRunning: boolean;
  runningOperation?: string;
  statsLoading: boolean;
  statsError: Error | null;
  onSelectService?: (serviceName: string) => void;
  onSelect?: (selection: SidebarSelection) => void;
  imageUpdates?: ImageUpdate[];
}

export const StackContent: FC<StackContentProps> = ({
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
  onSelect,
  imageUpdates,
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
        imageUpdates={imageUpdates}
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
          imageUpdates={imageUpdates}
        />
      );

    case 'services':
      return (
        <ServicesListPanel
          services={services}
          imageUpdates={imageUpdates}
          onSelect={(serviceName) => onSelect?.({ type: 'service', serviceName })}
        />
      );

    case 'resources':
      return (
        <ResourcesListPanel
          networks={networks}
          volumes={volumes}
          onSelectNetwork={(networkName) => onSelect?.({ type: 'network', networkName })}
          onSelectVolume={(volumeName) => onSelect?.({ type: 'volume', volumeName })}
          onSelectEnvironment={() => onSelect?.({ type: 'environment' })}
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
        <div className="flex h-full min-h-0 flex-col">
          <BackBar label="Services" onBack={() => onSelect?.({ type: 'services' })} />
          <div className="min-h-0 flex-1 overflow-auto">
            <ServiceDetailPanel
              service={service}
              imageUpdates={imageUpdates}
              canManage={permissions.canManage}
              canViewLogs={permissions.canViewLogs}
              onQuickOperation={onQuickOperation}
              isOperationRunning={isOperationRunning}
              runningOperation={runningOperation}
            />
          </div>
        </div>
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
      return (
        <div className="flex h-full min-h-0 flex-col">
          <BackBar label="Resources" onBack={() => onSelect?.({ type: 'resources' })} />
          <div className="min-h-0 flex-1 overflow-auto">
            <NetworkDetailPanel network={network} />
          </div>
        </div>
      );
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
      return (
        <div className="flex h-full min-h-0 flex-col">
          <BackBar label="Resources" onBack={() => onSelect?.({ type: 'resources' })} />
          <div className="min-h-0 flex-1 overflow-auto">
            <VolumeDetailPanel volume={volume} />
          </div>
        </div>
      );
    }

    case 'environment':
      return (
        <div className="flex h-full min-h-0 flex-col">
          <BackBar label="Resources" onBack={() => onSelect?.({ type: 'resources' })} />
          <div className="min-h-0 flex-1 overflow-auto">
            <EnvironmentPanel environment={environment} />
          </div>
        </div>
      );

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
          <StackImagesTab imageUpdates={imageUpdates} />
        </div>
      );

    case 'backups':
      if (!permissions.canViewBackups) {
        return (
          <div className="flex items-center justify-center h-full">
            <div className="text-center">
              <p className={cn('text-lg font-medium', theme.text.muted)}>Permission denied</p>
              <p className={cn('text-sm', theme.text.subtle)}>
                You don't have permission to view backups
              </p>
            </div>
          </div>
        );
      }
      return (
        <div className="h-full">
          <BackupsPanel
            serverid={serverid}
            stackname={stackname}
            canManage={permissions.canManageBackups}
            canRestore={permissions.canRestoreBackups}
            canBrowseFiles={permissions.canViewBackups && permissions.canViewFiles}
          />
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
