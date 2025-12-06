import React from 'react';
import { ComposeService, Container } from '../../../types/stack';
import { ServiceQuickActions } from '../services/ServiceQuickActions';
import { OperationRequest } from '../../../types/operations';
import {
  ClockIcon,
  CpuChipIcon,
  ServerIcon,
  ArrowPathIcon,
  StopIcon,
  UserIcon,
  FolderIcon,
  GlobeAltIcon,
  CircleStackIcon,
  CommandLineIcon,
} from '@heroicons/react/24/outline';
import {
  CheckCircleIcon as CheckCircleIconSolid,
  XCircleIcon as XCircleIconSolid,
  ClockIcon as ClockIconSolid,
  ExclamationTriangleIcon as ExclamationTriangleIconSolid,
} from '@heroicons/react/24/solid';
import { cn } from '../../../utils/cn';
import { theme } from '../../../theme';

interface ServiceDetailPanelProps {
  service: ComposeService;
  onQuickOperation: (operation: OperationRequest) => void;
  isOperationRunning: boolean;
  runningOperation?: string;
  canManage: boolean;
}

const getContainerStatusInfo = (container: Container) => {
  const state = container.state?.toLowerCase() || 'unknown';

  switch (state) {
    case 'running':
      return {
        icon: CheckCircleIconSolid,
        color: 'text-emerald-500',
        bg: 'bg-emerald-50 dark:bg-emerald-900/20',
        label: 'Running',
      };
    case 'stopped':
    case 'exited':
      return {
        icon: container.exit_code === 0 ? StopIcon : XCircleIconSolid,
        color: container.exit_code === 0 ? 'text-zinc-500' : 'text-red-500',
        bg:
          container.exit_code === 0
            ? 'bg-zinc-50 dark:bg-zinc-800'
            : 'bg-red-50 dark:bg-red-900/20',
        label: container.exit_code === 0 ? 'Stopped' : `Error (${container.exit_code})`,
      };
    case 'paused':
      return {
        icon: ClockIconSolid,
        color: 'text-amber-500',
        bg: 'bg-amber-50 dark:bg-amber-900/20',
        label: 'Paused',
      };
    case 'restarting':
      return {
        icon: ArrowPathIcon,
        color: 'text-blue-500',
        bg: 'bg-blue-50 dark:bg-blue-900/20',
        label: 'Restarting',
      };
    default:
      return {
        icon: ExclamationTriangleIconSolid,
        color: 'text-zinc-400',
        bg: 'bg-zinc-50 dark:bg-zinc-800',
        label: state.charAt(0).toUpperCase() + state.slice(1),
      };
  }
};

const formatUptime = (startedAt?: string) => {
  if (!startedAt) return null;
  const start = new Date(startedAt);
  const now = new Date();
  const diffMs = now.getTime() - start.getTime();
  const days = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  const hours = Math.floor((diffMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
};

const formatMemory = (bytes?: number) => {
  if (!bytes) return null;
  const mb = bytes / (1024 * 1024);
  if (mb < 1024) return `${mb.toFixed(0)} MB`;
  return `${(mb / 1024).toFixed(1)} GB`;
};

const formatDateTime = (dateStr?: string) => {
  if (!dateStr) return null;
  const date = new Date(dateStr);
  return date.toLocaleString();
};

export const ServiceDetailPanel: React.FC<ServiceDetailPanelProps> = ({
  service,
  onQuickOperation,
  isOperationRunning,
  runningOperation,
  canManage,
}) => {
  const runningContainers =
    service.containers?.filter((c) => c.state?.toLowerCase() === 'running') || [];
  const totalContainers = service.containers?.length || 0;

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* Service Header */}
      <div
        className={cn(
          'flex-shrink-0 px-6 py-4 border-b',
          theme.surface.muted,
          'border-zinc-200 dark:border-zinc-800'
        )}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div
              className={cn(
                'w-10 h-10 rounded-lg flex items-center justify-center',
                theme.brand.stack
              )}
            >
              <ServerIcon className="w-5 h-5" />
            </div>
            <div>
              <h2 className={cn('text-lg font-bold', theme.text.strong)}>{service.name}</h2>
              {service.image && (
                <p className={cn('text-sm font-mono', theme.text.subtle)}>{service.image}</p>
              )}
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <div
                className={cn(
                  'w-2.5 h-2.5 rounded-full',
                  runningContainers.length === totalContainers && totalContainers > 0
                    ? 'bg-emerald-500'
                    : runningContainers.length > 0
                      ? 'bg-amber-500'
                      : 'bg-zinc-400'
                )}
              />
              <span className={cn('text-sm font-medium', theme.text.muted)}>
                {runningContainers.length}/{totalContainers} running
              </span>
            </div>

            {canManage && (
              <ServiceQuickActions
                service={service}
                onQuickOperation={onQuickOperation}
                isOperationRunning={isOperationRunning}
                runningOperation={runningOperation}
              />
            )}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-6">
        {service.containers && service.containers.length > 0 ? (
          <div className="space-y-6">
            {service.containers.map((container, index) => (
              <ContainerDetail key={container.name || index} container={container} />
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center h-64 text-center">
            <ServerIcon className={cn('w-12 h-12 mb-4', theme.text.subtle)} />
            <p className={cn('text-lg font-medium', theme.text.muted)}>No containers</p>
            <p className={cn('text-sm', theme.text.subtle)}>
              This service has no running or stopped containers
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

const ContainerDetail: React.FC<{ container: Container }> = ({ container }) => {
  const statusInfo = getContainerStatusInfo(container);
  const StatusIcon = statusInfo.icon;
  const uptime = formatUptime(container.started);

  return (
    <div
      className={cn(
        'rounded-lg border',
        'border-zinc-200 dark:border-zinc-800',
        'bg-white dark:bg-zinc-900'
      )}
    >
      {/* Container Header */}
      <div
        className={cn(
          'px-4 py-3 border-b flex items-center justify-between',
          'border-zinc-200 dark:border-zinc-800'
        )}
      >
        <div className="flex items-center gap-3">
          <StatusIcon className={cn('w-5 h-5', statusInfo.color)} />
          <span className={cn('font-semibold', theme.text.strong)}>{container.name}</span>
          <span className={cn('text-xs px-2 py-0.5 rounded', statusInfo.bg, statusInfo.color)}>
            {statusInfo.label}
          </span>
        </div>
        {uptime && (
          <span className={cn('text-sm', theme.text.subtle)}>
            <ClockIcon className="w-4 h-4 inline mr-1" />
            {uptime}
          </span>
        )}
      </div>

      {/* Container Details Grid */}
      <div className="p-4 grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left Column */}
        <div className="space-y-4">
          {/* Ports */}
          {container.ports && container.ports.length > 0 && (
            <DetailSection title="Ports">
              <div className="flex flex-wrap gap-2">
                {container.ports.map((port, i) => (
                  <span
                    key={i}
                    className={cn('px-2 py-1 rounded text-sm font-mono', theme.surface.code)}
                  >
                    {port.public ? `${port.public}:${port.private}` : port.private}/{port.type}
                  </span>
                ))}
              </div>
            </DetailSection>
          )}

          {/* Configuration */}
          <DetailSection title="Configuration">
            <div className="space-y-2">
              {container.restart_policy && (
                <DetailRow
                  icon={ArrowPathIcon}
                  label="Restart"
                  value={container.restart_policy.name}
                />
              )}
              {container.user && (
                <DetailRow icon={UserIcon} label="User" value={container.user} mono />
              )}
              {container.working_dir && (
                <DetailRow
                  icon={FolderIcon}
                  label="Working Dir"
                  value={container.working_dir}
                  mono
                />
              )}
              {container.resource_limits?.memory && (
                <DetailRow
                  icon={CpuChipIcon}
                  label="Memory Limit"
                  value={formatMemory(container.resource_limits.memory) || ''}
                />
              )}
            </div>
          </DetailSection>

          {/* Networks */}
          {container.networks && container.networks.length > 0 && (
            <DetailSection title="Networks">
              <div className="space-y-2">
                {container.networks.map((network, i) => (
                  <div key={i} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <GlobeAltIcon className={cn('w-4 h-4', theme.text.subtle)} />
                      <span className={theme.text.muted}>{network.name}</span>
                    </div>
                    {network.ip_address && (
                      <span
                        className={cn(
                          'text-sm font-mono',
                          theme.surface.code,
                          'px-2 py-0.5 rounded'
                        )}
                      >
                        {network.ip_address}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </DetailSection>
          )}
        </div>

        {/* Right Column */}
        <div className="space-y-4">
          {/* Timestamps */}
          {(container.created || container.started) && (
            <DetailSection title="Timestamps">
              <div className="space-y-2">
                {container.created && (
                  <DetailRow
                    icon={ClockIcon}
                    label="Created"
                    value={formatDateTime(container.created) || ''}
                  />
                )}
                {container.started && (
                  <DetailRow
                    icon={ClockIcon}
                    label="Started"
                    value={formatDateTime(container.started) || ''}
                  />
                )}
              </div>
            </DetailSection>
          )}

          {/* Mounts */}
          {container.mounts && container.mounts.length > 0 && (
            <DetailSection title={`Mounts (${container.mounts.length})`}>
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {container.mounts.map((mount, i) => (
                  <div key={i} className="text-sm">
                    <div className="flex items-center gap-2 mb-1">
                      <span
                        className={cn(
                          'text-xs px-1.5 py-0.5 rounded font-medium',
                          mount.type === 'volume'
                            ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
                            : mount.type === 'bind'
                              ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                              : 'bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400'
                        )}
                      >
                        {mount.type}
                      </span>
                      <span
                        className={cn('text-xs', mount.rw ? 'text-emerald-600' : 'text-red-600')}
                      >
                        {mount.rw ? 'RW' : 'RO'}
                      </span>
                    </div>
                    <div className={cn('font-mono text-xs break-all', theme.text.subtle)}>
                      {mount.source} → {mount.destination}
                    </div>
                  </div>
                ))}
              </div>
            </DetailSection>
          )}

          {/* Command */}
          {container.command && container.command.length > 0 && (
            <DetailSection title="Command">
              <div className={cn('font-mono text-xs p-2 rounded break-all', theme.surface.code)}>
                {container.command.join(' ')}
              </div>
            </DetailSection>
          )}
        </div>
      </div>
    </div>
  );
};

const DetailSection: React.FC<{ title: string; children: React.ReactNode }> = ({
  title,
  children,
}) => (
  <div>
    <h4 className={cn('text-xs font-semibold uppercase tracking-wider mb-2', theme.text.subtle)}>
      {title}
    </h4>
    {children}
  </div>
);

const DetailRow: React.FC<{
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  mono?: boolean;
}> = ({ icon: Icon, label, value, mono }) => (
  <div className="flex items-center justify-between text-sm">
    <div className={cn('flex items-center gap-2', theme.text.muted)}>
      <Icon className="w-4 h-4" />
      <span>{label}</span>
    </div>
    <span className={cn(theme.text.strong, mono && 'font-mono text-xs')}>{value}</span>
  </div>
);
