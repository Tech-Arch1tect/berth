import React from 'react';
import { ComposeService, Network, Volume, Container } from '../../../types/stack';
import { OperationRequest } from '../../../types/operations';
import { ServiceQuickActions } from '../services/ServiceQuickActions';
import {
  CubeIcon,
  ServerIcon,
  GlobeAltIcon,
  CircleStackIcon,
  DocumentTextIcon,
  FolderIcon,
  ClockIcon,
  ExclamationTriangleIcon,
} from '@heroicons/react/24/outline';
import { CheckCircleIcon, XCircleIcon, StopIcon, PauseCircleIcon } from '@heroicons/react/24/solid';
import { cn } from '../../../utils/cn';
import { theme } from '../../../theme';

interface OverviewPanelProps {
  stackPath: string;
  composeFile: string;
  services: ComposeService[];
  networks: Network[];
  volumes: Volume[];
  canManage: boolean;
  onQuickOperation: (operation: OperationRequest) => void;
  isOperationRunning: boolean;
  runningOperation?: string;
  onServiceClick?: (serviceName: string) => void;
}

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

const getServiceStatus = (service: ComposeService) => {
  const containers = service.containers || [];
  const total = containers.length;
  const running = containers.filter((c) => c.state?.toLowerCase() === 'running').length;
  const unhealthy = containers.filter((c) => {
    const state = c.state?.toLowerCase();
    return state === 'exited' && c.exit_code !== 0;
  }).length;

  if (total === 0) {
    return {
      status: 'no-containers',
      icon: XCircleIcon,
      color: 'text-zinc-400',
      bg: 'bg-zinc-100 dark:bg-zinc-800',
      label: 'No Containers',
    };
  }
  if (unhealthy > 0) {
    return {
      status: 'unhealthy',
      icon: ExclamationTriangleIcon,
      color: 'text-red-500',
      bg: 'bg-red-100 dark:bg-red-900/30',
      label: 'Unhealthy',
    };
  }
  if (running === total) {
    return {
      status: 'running',
      icon: CheckCircleIcon,
      color: 'text-emerald-500',
      bg: 'bg-emerald-100 dark:bg-emerald-900/30',
      label: 'Running',
    };
  }
  if (running === 0) {
    return {
      status: 'stopped',
      icon: StopIcon,
      color: 'text-zinc-500',
      bg: 'bg-zinc-100 dark:bg-zinc-800',
      label: 'Stopped',
    };
  }
  return {
    status: 'partial',
    icon: PauseCircleIcon,
    color: 'text-amber-500',
    bg: 'bg-amber-100 dark:bg-amber-900/30',
    label: 'Partial',
  };
};

const getOldestUptime = (containers: Container[]) => {
  const runningContainers = containers.filter(
    (c) => c.state?.toLowerCase() === 'running' && c.started
  );
  if (runningContainers.length === 0) return null;

  const startTimes = runningContainers.map((c) => new Date(c.started!).getTime());
  const oldestStart = new Date(Math.min(...startTimes)).toISOString();
  return formatUptime(oldestStart);
};

export const OverviewPanel: React.FC<OverviewPanelProps> = ({
  stackPath,
  composeFile,
  services,
  networks,
  volumes,
  canManage,
  onQuickOperation,
  isOperationRunning,
  runningOperation,
  onServiceClick,
}) => {
  const totalContainers = services.reduce((sum, s) => sum + (s.containers?.length || 0), 0);
  const runningContainers = services.reduce(
    (sum, s) =>
      sum + (s.containers?.filter((c) => c.state?.toLowerCase() === 'running').length || 0),
    0
  );
  const activeNetworks = networks.filter((n) => n.exists).length;
  const activeVolumes = volumes.filter((v) => v.exists).length;

  const healthyServices = services.filter((s) => {
    const status = getServiceStatus(s);
    return status.status === 'running';
  }).length;

  return (
    <div className="h-full overflow-auto p-6">
      <div className="max-w-5xl mx-auto space-y-6">
        {/* Header */}
        <div>
          <h2 className={cn('text-xl font-bold', theme.text.strong)}>Overview</h2>
          <p className={cn('text-sm', theme.text.subtle)}>Stack dashboard and service status</p>
        </div>

        {/* Quick Stats Grid */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            icon={CubeIcon}
            label="Services"
            value={`${healthyServices}/${services.length}`}
            sublabel={
              healthyServices === services.length
                ? 'all healthy'
                : `${services.length - healthyServices} need attention`
            }
            color={healthyServices === services.length ? 'emerald' : 'amber'}
          />
          <StatCard
            icon={ServerIcon}
            label="Containers"
            value={`${runningContainers}/${totalContainers}`}
            sublabel={
              runningContainers === totalContainers
                ? 'all running'
                : `${totalContainers - runningContainers} stopped`
            }
            color={runningContainers === totalContainers ? 'emerald' : 'amber'}
          />
          <StatCard
            icon={GlobeAltIcon}
            label="Networks"
            value={`${activeNetworks}/${networks.length}`}
            sublabel="active"
            color="blue"
          />
          <StatCard
            icon={CircleStackIcon}
            label="Volumes"
            value={`${activeVolumes}/${volumes.length}`}
            sublabel="active"
            color="purple"
          />
        </div>

        {/* Services Dashboard */}
        <div
          className={cn(
            'rounded-lg border',
            'border-zinc-200 dark:border-zinc-800',
            'bg-white dark:bg-zinc-900'
          )}
        >
          <div
            className={cn(
              'px-4 py-3 border-b',
              'border-zinc-200 dark:border-zinc-800',
              theme.surface.muted
            )}
          >
            <h3 className={cn('text-sm font-semibold', theme.text.strong)}>Services</h3>
          </div>
          <div className="divide-y divide-zinc-100 dark:divide-zinc-800">
            {services.map((service) => {
              const status = getServiceStatus(service);
              const StatusIcon = status.icon;
              const uptime = getOldestUptime(service.containers || []);
              const running =
                service.containers?.filter((c) => c.state?.toLowerCase() === 'running').length || 0;
              const total = service.containers?.length || 0;

              return (
                <div
                  key={service.name}
                  className={cn(
                    'px-4 py-3 flex items-center justify-between gap-4',
                    onServiceClick &&
                      'cursor-pointer hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors'
                  )}
                  onClick={() => onServiceClick?.(service.name)}
                >
                  {/* Service Info */}
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <StatusIcon className={cn('w-5 h-5 flex-shrink-0', status.color)} />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className={cn('font-medium truncate', theme.text.strong)}>
                          {service.name}
                        </span>
                        <span
                          className={cn(
                            'text-xs px-1.5 py-0.5 rounded hidden sm:inline',
                            status.bg,
                            status.color
                          )}
                        >
                          {status.label}
                        </span>
                      </div>
                      {service.image && (
                        <p className={cn('text-xs font-mono truncate', theme.text.subtle)}>
                          {service.image}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Uptime & Containers */}
                  <div className="flex items-center gap-4 flex-shrink-0">
                    {uptime && (
                      <div
                        className={cn(
                          'hidden md:flex items-center gap-1.5 text-sm',
                          theme.text.muted
                        )}
                      >
                        <ClockIcon className="w-4 h-4" />
                        <span>{uptime}</span>
                      </div>
                    )}
                    <div className={cn('text-sm tabular-nums', theme.text.muted)}>
                      <span
                        className={
                          running === total && total > 0
                            ? 'text-emerald-600 dark:text-emerald-400'
                            : ''
                        }
                      >
                        {running}
                      </span>
                      <span className={theme.text.subtle}>/{total}</span>
                    </div>
                    {canManage && (
                      <div onClick={(e) => e.stopPropagation()}>
                        <ServiceQuickActions
                          service={service}
                          onQuickOperation={onQuickOperation}
                          isOperationRunning={isOperationRunning}
                          runningOperation={runningOperation}
                        />
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Stack Info */}
        <div
          className={cn(
            'rounded-lg border p-4',
            'border-zinc-200 dark:border-zinc-800',
            'bg-white dark:bg-zinc-900'
          )}
        >
          <h3 className={cn('text-sm font-semibold mb-3', theme.text.strong)}>Stack Information</h3>
          <div className="space-y-3">
            <InfoRow icon={FolderIcon} label="Stack Path" value={stackPath} mono />
            <InfoRow icon={DocumentTextIcon} label="Compose File" value={composeFile} mono />
          </div>
        </div>
      </div>
    </div>
  );
};

const StatCard: React.FC<{
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string | number;
  sublabel?: string;
  color: 'teal' | 'emerald' | 'amber' | 'blue' | 'purple';
}> = ({ icon: Icon, label, value, sublabel, color }) => {
  const colorClasses = {
    teal: 'bg-teal-50 dark:bg-teal-900/20 text-teal-600 dark:text-teal-400',
    emerald: 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400',
    amber: 'bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400',
    blue: 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400',
    purple: 'bg-purple-50 dark:bg-purple-900/20 text-purple-600 dark:text-purple-400',
  };

  return (
    <div
      className={cn(
        'rounded-lg border p-4',
        'border-zinc-200 dark:border-zinc-800',
        'bg-white dark:bg-zinc-900'
      )}
    >
      <div className="flex items-center gap-3">
        <div
          className={cn(
            'w-10 h-10 rounded-lg flex items-center justify-center',
            colorClasses[color]
          )}
        >
          <Icon className="w-5 h-5" />
        </div>
        <div>
          <p className={cn('text-2xl font-bold tabular-nums', theme.text.strong)}>{value}</p>
          <p className={cn('text-xs', theme.text.muted)}>
            {label}
            {sublabel && <span className="ml-1 text-zinc-400">· {sublabel}</span>}
          </p>
        </div>
      </div>
    </div>
  );
};

const InfoRow: React.FC<{
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  mono?: boolean;
}> = ({ icon: Icon, label, value, mono }) => (
  <div className="flex items-start gap-3">
    <Icon className={cn('w-4 h-4 mt-0.5 flex-shrink-0', theme.text.subtle)} />
    <div className="min-w-0 flex-1">
      <p className={cn('text-xs', theme.text.muted)}>{label}</p>
      <p className={cn('text-sm break-all', theme.text.strong, mono && 'font-mono')}>{value}</p>
    </div>
  </div>
);
