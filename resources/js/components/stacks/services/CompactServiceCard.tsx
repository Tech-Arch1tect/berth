import React, { useState } from 'react';
import { ComposeService, Container } from '../../../types/stack';
import { ServiceQuickActions } from './ServiceQuickActions';
import { OperationRequest } from '../../../types/operations';
import { useStackPermissions } from '../../../hooks/useStackPermissions';
import {
  ChevronDownIcon,
  ChevronUpIcon,
  ClockIcon,
  CpuChipIcon,
  ServerIcon,
  ArrowPathIcon,
  StopIcon,
  UserIcon,
  FolderIcon,
  CommandLineIcon,
  GlobeAltIcon,
  CircleStackIcon,
} from '@heroicons/react/24/outline';
import {
  CheckCircleIcon as CheckCircleIconSolid,
  XCircleIcon as XCircleIconSolid,
  ClockIcon as ClockIconSolid,
  ExclamationTriangleIcon as ExclamationTriangleIconSolid,
} from '@heroicons/react/24/solid';
import { cn } from '../../../utils/cn';
import { theme } from '../../../theme';

interface CompactServiceCardProps {
  service: ComposeService;
  onQuickOperation: (operation: OperationRequest) => void;
  serverid: number;
  stackname: string;
  isOperationRunning: boolean;
  runningOperation?: string;
  isExpanded?: boolean;
  onToggleExpand?: () => void;
}

export const CompactServiceCard: React.FC<CompactServiceCardProps> = ({
  service,
  onQuickOperation,
  serverid,
  stackname,
  isOperationRunning,
  runningOperation,
  isExpanded: externalIsExpanded,
  onToggleExpand,
}) => {
  const [internalIsExpanded, setInternalIsExpanded] = useState(false);
  const isExpanded = externalIsExpanded !== undefined ? externalIsExpanded : internalIsExpanded;

  const { data: stackPermissions } = useStackPermissions({
    serverid,
    stackname,
  });

  const getContainerStatusInfo = (container: Container) => {
    const state = container.state?.toLowerCase() || 'unknown';

    switch (state) {
      case 'running':
        return {
          icon: CheckCircleIconSolid,
          color: theme.text.success,
          bg: theme.intent.success.surface,
          border: theme.intent.success.border,
          label: 'Running',
        };
      case 'stopped':
      case 'exited':
        return {
          icon: StopIcon,
          color: theme.text.danger,
          bg: theme.intent.danger.surface,
          border: theme.intent.danger.border,
          label: container.exit_code === 0 ? 'Stopped' : `Error (${container.exit_code})`,
        };
      case 'paused':
        return {
          icon: ClockIconSolid,
          color: theme.text.warning,
          bg: theme.intent.warning.surface,
          border: theme.intent.warning.border,
          label: 'Paused',
        };
      case 'restarting':
        return {
          icon: ArrowPathIcon,
          color: theme.text.info,
          bg: theme.intent.info.surface,
          border: theme.intent.info.border,
          label: 'Restarting',
        };
      case 'not created':
        return {
          icon: XCircleIconSolid,
          color: theme.text.subtle,
          bg: theme.intent.neutral.surface,
          border: theme.intent.neutral.border,
          label: 'Not Created',
        };
      default:
        return {
          icon: ExclamationTriangleIconSolid,
          color: theme.text.warning,
          bg: theme.intent.warning.surface,
          border: theme.intent.warning.border,
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
    if (mb < 1024) return `${mb.toFixed(0)}MB`;
    return `${(mb / 1024).toFixed(1)}GB`;
  };

  const runningContainers =
    service.containers?.filter((c) => c.state?.toLowerCase() === 'running') || [];
  const totalContainers = service.containers?.length || 0;

  return (
    <div className={theme.cards.translucent}>
      {/* Service Header - Compact */}
      <div className="px-4 py-3 border-b border-slate-100/50 dark:border-slate-700/30">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3 min-w-0 flex-1">
            <div
              className={cn(
                'w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0',
                theme.brand.stack
              )}
            >
              <ServerIcon className="w-4 h-4" />
            </div>

            <div className="min-w-0 flex-1">
              <div className="flex items-center space-x-2">
                <h3 className={cn('font-semibold truncate', theme.text.strong)}>{service.name}</h3>
                <div className="flex items-center space-x-1 text-xs">
                  <div
                    className={cn(
                      'w-2 h-2 rounded-full',
                      runningContainers.length === totalContainers
                        ? theme.badges.dot.success
                        : runningContainers.length > 0
                          ? theme.badges.dot.warning
                          : theme.badges.dot.danger
                    )}
                  />
                  <span className={cn('font-medium', theme.text.muted)}>
                    {runningContainers.length}/{totalContainers}
                  </span>
                </div>
              </div>
              {service.image && (
                <div className={cn('text-xs font-mono truncate mt-0.5', theme.text.subtle)}>
                  {service.image}
                </div>
              )}
            </div>
          </div>

          <div className="flex items-center space-x-2 flex-shrink-0">
            <button
              onClick={() => {
                if (onToggleExpand) {
                  onToggleExpand();
                } else {
                  setInternalIsExpanded(!internalIsExpanded);
                }
              }}
              className={theme.buttons.ghost}
            >
              {isExpanded ? (
                <ChevronUpIcon className={cn('w-4 h-4', theme.text.subtle)} />
              ) : (
                <ChevronDownIcon className={cn('w-4 h-4', theme.text.subtle)} />
              )}
            </button>

            {stackPermissions?.permissions?.includes('stacks.manage') && (
              <ServiceQuickActions
                service={service}
                onQuickOperation={onQuickOperation}
                serverid={serverid}
                stackname={stackname}
                isOperationRunning={isOperationRunning}
                runningOperation={runningOperation}
              />
            )}
          </div>
        </div>
      </div>

      {/* Containers List */}
      <div className="px-4 py-3 space-y-2">
        {service.containers &&
          service.containers.map((container, index) => {
            const statusInfo = getContainerStatusInfo(container);
            const uptime = formatUptime(container.started);
            const StatusIcon = statusInfo.icon;

            return (
              <div key={container.name || index} className="flex items-center justify-between">
                <div className="flex items-center space-x-3 min-w-0 flex-1">
                  <div
                    className={`p-1.5 rounded-lg ${statusInfo.bg} ${statusInfo.border} border flex-shrink-0`}
                  >
                    <StatusIcon className={`w-3 h-3 ${statusInfo.color}`} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center space-x-2">
                      <span className={cn('font-medium text-sm truncate', theme.text.strong)}>
                        {container.name}
                      </span>
                      <span
                        className={`px-1.5 py-0.5 text-xs font-medium rounded ${statusInfo.bg} ${statusInfo.color} ${statusInfo.border} border`}
                      >
                        {statusInfo.label}
                      </span>
                    </div>
                    {uptime && <div className={cn('text-xs', theme.text.subtle)}>Up {uptime}</div>}
                  </div>
                </div>

                {container.ports && container.ports.length > 0 && (
                  <div className="flex items-center space-x-1 flex-shrink-0">
                    {container.ports.slice(0, 2).map((port, portIndex) => (
                      <span
                        key={portIndex}
                        className={cn('px-2 py-1 rounded text-xs font-mono', theme.surface.code)}
                      >
                        {port.public ? `${port.public}:${port.private}` : port.private}
                      </span>
                    ))}
                    {container.ports.length > 2 && (
                      <span className={cn('text-xs', theme.text.subtle)}>
                        +{container.ports.length - 2}
                      </span>
                    )}
                  </div>
                )}
              </div>
            );
          })}
      </div>

      {/* Expanded Details */}
      {isExpanded && (
        <div
          className={cn(
            'p-4 space-y-4 border-t border-slate-100/50 dark:border-slate-700/30',
            theme.surface.muted
          )}
        >
          {service.containers &&
            service.containers.map((container, index) => (
              <div key={`details-${container.name || index}`} className="space-y-3">
                <div className="flex items-center space-x-2 pb-2 border-b border-slate-200/30 dark:border-slate-700/30">
                  <ServerIcon className={cn('w-4 h-4', theme.text.muted)} />
                  <span className={cn('font-medium', theme.text.strong)}>{container.name}</span>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 text-sm">
                  {/* Left Column */}
                  <div className="space-y-3">
                    {/* Basic Info */}
                    <div className="space-y-2">
                      {container.restart_policy && (
                        <div className="flex items-center justify-between py-1">
                          <div className={cn('flex items-center space-x-2', theme.text.muted)}>
                            <ArrowPathIcon className="w-3 h-3" />
                            <span>Restart:</span>
                          </div>
                          <span className={cn('font-medium', theme.text.strong)}>
                            {container.restart_policy.name}
                          </span>
                        </div>
                      )}

                      {container.user && (
                        <div className="flex items-center justify-between py-1">
                          <div className={cn('flex items-center space-x-2', theme.text.muted)}>
                            <UserIcon className="w-3 h-3" />
                            <span>User:</span>
                          </div>
                          <span className={cn('font-mono', theme.text.strong)}>
                            {container.user}
                          </span>
                        </div>
                      )}

                      {container.working_dir && (
                        <div className="flex items-center justify-between py-1">
                          <div className={cn('flex items-center space-x-2', theme.text.muted)}>
                            <FolderIcon className="w-3 h-3" />
                            <span>WorkDir:</span>
                          </div>
                          <span className={cn('font-mono truncate', theme.text.strong)}>
                            {container.working_dir}
                          </span>
                        </div>
                      )}

                      {/* Resource Limits */}
                      {container.resource_limits && (
                        <>
                          {container.resource_limits.memory && (
                            <div className="flex items-center justify-between py-1">
                              <div className={cn('flex items-center space-x-2', theme.text.muted)}>
                                <CpuChipIcon className="w-3 h-3" />
                                <span>Memory:</span>
                              </div>
                              <span className={cn('font-medium', theme.text.strong)}>
                                {formatMemory(container.resource_limits.memory)}
                              </span>
                            </div>
                          )}
                          {container.resource_limits.cpu_shares && (
                            <div className="flex items-center justify-between py-1">
                              <div className={cn('flex items-center space-x-2', theme.text.muted)}>
                                <CpuChipIcon className="w-3 h-3" />
                                <span>CPU:</span>
                              </div>
                              <span className={cn('font-medium', theme.text.strong)}>
                                {container.resource_limits.cpu_shares} shares
                              </span>
                            </div>
                          )}
                        </>
                      )}
                    </div>

                    {/* Networks */}
                    {container.networks && container.networks.length > 0 && (
                      <div className="space-y-2">
                        <div
                          className={cn(
                            'flex items-center space-x-2 font-medium',
                            theme.text.standard
                          )}
                        >
                          <GlobeAltIcon className="w-4 h-4" />
                          <span>Networks</span>
                        </div>
                        {container.networks.map((network, netIndex) => (
                          <div key={netIndex} className="pl-6 space-y-1">
                            <div className="flex items-center justify-between">
                              <span className={theme.text.muted}>{network.name}</span>
                              {network.ip_address && (
                                <span
                                  className={cn(
                                    'font-mono text-xs px-2 py-1 rounded',
                                    theme.surface.code
                                  )}
                                >
                                  {network.ip_address}
                                </span>
                              )}
                            </div>
                            {network.aliases && network.aliases.length > 0 && (
                              <div className={cn('text-xs', theme.text.subtle)}>
                                Aliases: {network.aliases.join(', ')}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Right Column */}
                  <div className="space-y-3">
                    {/* Timestamps */}
                    <div className="space-y-2">
                      {container.created && (
                        <div className="flex items-center justify-between py-1">
                          <div className={cn('flex items-center space-x-2', theme.text.muted)}>
                            <ClockIcon className="w-3 h-3" />
                            <span>Created:</span>
                          </div>
                          <span className={cn('font-mono text-xs', theme.text.strong)}>
                            {new Date(container.created).toLocaleDateString()}{' '}
                            {new Date(container.created).toLocaleTimeString()}
                          </span>
                        </div>
                      )}

                      {container.started && (
                        <div className="flex items-center justify-between py-1">
                          <div className={cn('flex items-center space-x-2', theme.text.muted)}>
                            <ClockIcon className="w-3 h-3" />
                            <span>Started:</span>
                          </div>
                          <span className={cn('font-mono text-xs', theme.text.strong)}>
                            {new Date(container.started).toLocaleDateString()}{' '}
                            {new Date(container.started).toLocaleTimeString()}
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Mounts */}
                    {container.mounts && container.mounts.length > 0 && (
                      <div className="space-y-2">
                        <div
                          className={cn(
                            'flex items-center space-x-2 font-medium',
                            theme.text.standard
                          )}
                        >
                          <CircleStackIcon className="w-4 h-4" />
                          <span>Mounts</span>
                        </div>
                        <div className="pl-6 space-y-1 max-h-32 overflow-y-auto">
                          {container.mounts.map((mount, mountIndex) => (
                            <div key={mountIndex} className="space-y-1">
                              <div className="flex items-center space-x-2">
                                <span
                                  className={cn(
                                    theme.badges.tag.base,
                                    mount.type === 'volume'
                                      ? theme.badges.tag.info
                                      : mount.type === 'bind'
                                        ? theme.badges.tag.success
                                        : theme.badges.tag.neutral
                                  )}
                                >
                                  {mount.type}
                                </span>
                                <span
                                  className={`text-xs ${mount.rw ? theme.text.success : theme.text.danger}`}
                                >
                                  {mount.rw ? 'RW' : 'RO'}
                                </span>
                              </div>
                              <div className={cn('text-xs font-mono break-all', theme.text.muted)}>
                                {mount.source} → {mount.destination}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Command */}
                    {container.command && container.command.length > 0 && (
                      <div className="space-y-2">
                        <div
                          className={cn(
                            'flex items-center space-x-2 font-medium',
                            theme.text.standard
                          )}
                        >
                          <CommandLineIcon className="w-4 h-4" />
                          <span>Command</span>
                        </div>
                        <div
                          className={cn(
                            'font-mono text-xs p-2 rounded break-all',
                            theme.surface.code
                          )}
                        >
                          {container.command.join(' ')}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
        </div>
      )}
    </div>
  );
};
