import React from 'react';
import { SidebarSection } from './SidebarSection';
import { ServiceItem } from './ServiceItem';
import { ResourceItem } from './ResourceItem';
import { ToolItem } from './ToolItem';
import { SidebarSelection } from './types';
import { ComposeService, Network, Volume } from '../../../types/stack';
import {
  CubeIcon,
  CircleStackIcon,
  GlobeAltIcon,
  DocumentTextIcon,
  ChartBarIcon,
  FolderIcon,
  Cog6ToothIcon,
  ViewColumnsIcon,
  ShieldExclamationIcon,
} from '@heroicons/react/24/outline';

interface StackSidebarProps {
  services: ComposeService[];
  networks: Network[];
  volumes: Volume[];
  selection: SidebarSelection | null;
  onSelect: (selection: SidebarSelection) => void;
  permissions: {
    canViewLogs: boolean;
    canViewFiles: boolean;
  };
}

export const StackSidebar: React.FC<StackSidebarProps> = ({
  services,
  networks,
  volumes,
  selection,
  onSelect,
  permissions,
}) => {
  const activeNetworks = networks.filter((n) => n.exists);
  const activeVolumes = volumes.filter((v) => v.exists);

  return (
    <div className="py-1">
      {/* Services Section */}
      <SidebarSection
        title="Services"
        icon={<CubeIcon className="w-4 h-4 text-zinc-400" />}
        count={services.length}
        defaultExpanded={true}
      >
        {services.map((service) => (
          <ServiceItem
            key={service.name}
            service={service}
            isSelected={selection?.type === 'service' && selection.serviceName === service.name}
            onSelect={() => onSelect({ type: 'service', serviceName: service.name })}
          />
        ))}
        {services.length === 0 && (
          <div className="px-3 py-2 text-xs text-zinc-400 dark:text-zinc-500 italic">
            No services defined
          </div>
        )}
      </SidebarSection>

      {/* Resources Section */}
      <SidebarSection
        title="Resources"
        icon={<CircleStackIcon className="w-4 h-4 text-zinc-400" />}
        defaultExpanded={false}
      >
        {/* Networks sub-section */}
        <div className="py-1">
          <div className="px-3 py-1 text-xs font-medium text-zinc-400 dark:text-zinc-500 uppercase tracking-wider">
            Networks ({activeNetworks.length}/{networks.length})
          </div>
          {networks.map((network) => (
            <ResourceItem
              key={network.name}
              label={network.name}
              icon={<GlobeAltIcon className="w-4 h-4" />}
              isSelected={selection?.type === 'network' && selection.networkName === network.name}
              onSelect={() => onSelect({ type: 'network', networkName: network.name })}
              isActive={network.exists}
            />
          ))}
          {networks.length === 0 && (
            <div className="px-3 py-1 pl-7 text-xs text-zinc-400 dark:text-zinc-500 italic">
              No networks defined
            </div>
          )}
        </div>

        {/* Volumes sub-section */}
        <div className="py-1">
          <div className="px-3 py-1 text-xs font-medium text-zinc-400 dark:text-zinc-500 uppercase tracking-wider">
            Volumes ({activeVolumes.length}/{volumes.length})
          </div>
          {volumes.map((volume) => (
            <ResourceItem
              key={volume.name}
              label={volume.name}
              icon={<CircleStackIcon className="w-4 h-4" />}
              isSelected={selection?.type === 'volume' && selection.volumeName === volume.name}
              onSelect={() => onSelect({ type: 'volume', volumeName: volume.name })}
              isActive={volume.exists}
            />
          ))}
          {volumes.length === 0 && (
            <div className="px-3 py-1 pl-7 text-xs text-zinc-400 dark:text-zinc-500 italic">
              No volumes defined
            </div>
          )}
        </div>

        {/* Environment */}
        <ResourceItem
          label="Environment Variables"
          icon={<Cog6ToothIcon className="w-4 h-4" />}
          isSelected={selection?.type === 'environment'}
          onSelect={() => onSelect({ type: 'environment' })}
        />
      </SidebarSection>

      {/* Tools Section */}
      <div className="py-2 px-1">
        <div className="border-t border-zinc-200 dark:border-zinc-700 mb-2" />

        <ToolItem
          label="Overview"
          icon={<ViewColumnsIcon className="w-4 h-4" />}
          isSelected={selection?.type === 'overview'}
          onSelect={() => onSelect({ type: 'overview' })}
        />

        <ToolItem
          label="Logs"
          icon={<DocumentTextIcon className="w-4 h-4" />}
          isSelected={selection?.type === 'logs'}
          onSelect={() => onSelect({ type: 'logs' })}
          disabled={!permissions.canViewLogs}
        />

        <ToolItem
          label="Files"
          icon={<FolderIcon className="w-4 h-4" />}
          isSelected={selection?.type === 'files'}
          onSelect={() => onSelect({ type: 'files' })}
          disabled={!permissions.canViewFiles}
        />

        <ToolItem
          label="Stats"
          icon={<ChartBarIcon className="w-4 h-4" />}
          isSelected={selection?.type === 'stats'}
          onSelect={() => onSelect({ type: 'stats' })}
        />

        <ToolItem
          label="Security"
          icon={<ShieldExclamationIcon className="w-4 h-4" />}
          isSelected={selection?.type === 'security'}
          onSelect={() => onSelect({ type: 'security' })}
        />
      </div>
    </div>
  );
};
