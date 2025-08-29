import React, { useState } from 'react';
import { ComposeService, Container } from '../../types/stack';
import { ServiceQuickActions } from './ServiceQuickActions';
import { OperationRequest } from '../../types/operations';
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

interface CompactServiceCardProps {
  service: ComposeService;
  onQuickOperation: (operation: OperationRequest) => void;
  serverid: number;
  stackname: string;
  isOperationRunning: boolean;
  runningOperation?: string;
}

export const CompactServiceCard: React.FC<CompactServiceCardProps> = ({
  service,
  onQuickOperation,
  serverid,
  stackname,
  isOperationRunning,
  runningOperation,
}) => {
  const [isExpanded, setIsExpanded] = useState(false);

  const getContainerStatusInfo = (container: Container) => {
    const state = container.state?.toLowerCase() || 'unknown';

    switch (state) {
      case 'running':
        return {
          icon: CheckCircleIconSolid,
          color: 'text-emerald-500',
          bg: 'bg-emerald-50 dark:bg-emerald-900/20',
          border: 'border-emerald-200 dark:border-emerald-800/50',
          label: 'Running',
        };
      case 'stopped':
      case 'exited':
        return {
          icon: StopIcon,
          color: 'text-red-500',
          bg: 'bg-red-50 dark:bg-red-900/20',
          border: 'border-red-200 dark:border-red-800/50',
          label: container.exit_code === 0 ? 'Stopped' : `Error (${container.exit_code})`,
        };
      case 'paused':
        return {
          icon: ClockIconSolid,
          color: 'text-amber-500',
          bg: 'bg-amber-50 dark:bg-amber-900/20',
          border: 'border-amber-200 dark:border-amber-800/50',
          label: 'Paused',
        };
      case 'restarting':
        return {
          icon: ArrowPathIcon,
          color: 'text-blue-500',
          bg: 'bg-blue-50 dark:bg-blue-900/20',
          border: 'border-blue-200 dark:border-blue-800/50',
          label: 'Restarting',
        };
      case 'not created':
        return {
          icon: XCircleIconSolid,
          color: 'text-slate-400',
          bg: 'bg-slate-50 dark:bg-slate-800/20',
          border: 'border-slate-200 dark:border-slate-700/50',
          label: 'Not Created',
        };
      default:
        return {
          icon: ExclamationTriangleIconSolid,
          color: 'text-orange-500',
          bg: 'bg-orange-50 dark:bg-orange-900/20',
          border: 'border-orange-200 dark:border-orange-800/50',
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
    <div className="bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm rounded-xl border border-slate-200/50 dark:border-slate-700/50 shadow-sm hover:shadow-md transition-all duration-200">
      {/* Service Header - Compact */}
      <div className="px-4 py-3 border-b border-slate-100/50 dark:border-slate-700/30">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3 min-w-0 flex-1">
            <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg flex items-center justify-center flex-shrink-0">
              <ServerIcon className="w-4 h-4 text-white" />
            </div>

            <div className="min-w-0 flex-1">
              <div className="flex items-center space-x-2">
                <h3 className="font-semibold text-slate-900 dark:text-white truncate">
                  {service.name}
                </h3>
                <div className="flex items-center space-x-1 text-xs">
                  <div
                    className={`w-2 h-2 rounded-full ${runningContainers.length === totalContainers ? 'bg-emerald-500' : runningContainers.length > 0 ? 'bg-amber-500' : 'bg-red-500'}`}
                  />
                  <span className="text-slate-600 dark:text-slate-400 font-medium">
                    {runningContainers.length}/{totalContainers}
                  </span>
                </div>
              </div>
              {service.image && (
                <div className="text-xs text-slate-500 dark:text-slate-400 font-mono truncate mt-0.5">
                  {service.image}
                </div>
              )}
            </div>
          </div>

          <div className="flex items-center space-x-2 flex-shrink-0">
            <button
              onClick={() => setIsExpanded(!isExpanded)}
              className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
            >
              {isExpanded ? (
                <ChevronUpIcon className="w-4 h-4 text-slate-500" />
              ) : (
                <ChevronDownIcon className="w-4 h-4 text-slate-500" />
              )}
            </button>

            <ServiceQuickActions
              service={service}
              onQuickOperation={onQuickOperation}
              serverid={serverid}
              stackname={stackname}
              isOperationRunning={isOperationRunning}
              runningOperation={runningOperation}
            />
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
                      <span className="font-medium text-slate-900 dark:text-white text-sm truncate">
                        {container.name}
                      </span>
                      <span
                        className={`px-1.5 py-0.5 text-xs font-medium rounded ${statusInfo.bg} ${statusInfo.color} ${statusInfo.border} border`}
                      >
                        {statusInfo.label}
                      </span>
                    </div>
                    {uptime && (
                      <div className="text-xs text-slate-500 dark:text-slate-400">Up {uptime}</div>
                    )}
                  </div>
                </div>

                {container.ports && container.ports.length > 0 && (
                  <div className="flex items-center space-x-1 flex-shrink-0">
                    {container.ports.slice(0, 2).map((port, portIndex) => (
                      <span
                        key={portIndex}
                        className="px-2 py-1 bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 rounded text-xs font-mono"
                      >
                        {port.public ? `${port.public}:${port.private}` : port.private}
                      </span>
                    ))}
                    {container.ports.length > 2 && (
                      <span className="text-xs text-slate-500 dark:text-slate-400">
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
        <div className="border-t border-slate-100/50 dark:border-slate-700/30 p-4 space-y-4 bg-slate-50/30 dark:bg-slate-800/30">
          {service.containers &&
            service.containers.map((container, index) => (
              <div key={`details-${container.name || index}`} className="space-y-3">
                <div className="flex items-center space-x-2 pb-2 border-b border-slate-200/30 dark:border-slate-700/30">
                  <ServerIcon className="w-4 h-4 text-slate-600 dark:text-slate-400" />
                  <span className="font-medium text-slate-900 dark:text-white">
                    {container.name}
                  </span>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 text-sm">
                  {/* Left Column */}
                  <div className="space-y-3">
                    {/* Basic Info */}
                    <div className="space-y-2">
                      {container.restart_policy && (
                        <div className="flex items-center justify-between py-1">
                          <div className="flex items-center space-x-2 text-slate-600 dark:text-slate-400">
                            <ArrowPathIcon className="w-3 h-3" />
                            <span>Restart:</span>
                          </div>
                          <span className="font-medium text-slate-900 dark:text-white">
                            {container.restart_policy.name}
                          </span>
                        </div>
                      )}

                      {container.user && (
                        <div className="flex items-center justify-between py-1">
                          <div className="flex items-center space-x-2 text-slate-600 dark:text-slate-400">
                            <UserIcon className="w-3 h-3" />
                            <span>User:</span>
                          </div>
                          <span className="font-mono text-slate-900 dark:text-white">
                            {container.user}
                          </span>
                        </div>
                      )}

                      {container.working_dir && (
                        <div className="flex items-center justify-between py-1">
                          <div className="flex items-center space-x-2 text-slate-600 dark:text-slate-400">
                            <FolderIcon className="w-3 h-3" />
                            <span>WorkDir:</span>
                          </div>
                          <span className="font-mono text-slate-900 dark:text-white truncate">
                            {container.working_dir}
                          </span>
                        </div>
                      )}

                      {/* Resource Limits */}
                      {container.resource_limits && (
                        <>
                          {container.resource_limits.memory && (
                            <div className="flex items-center justify-between py-1">
                              <div className="flex items-center space-x-2 text-slate-600 dark:text-slate-400">
                                <CpuChipIcon className="w-3 h-3" />
                                <span>Memory:</span>
                              </div>
                              <span className="font-medium text-slate-900 dark:text-white">
                                {formatMemory(container.resource_limits.memory)}
                              </span>
                            </div>
                          )}
                          {container.resource_limits.cpu_shares && (
                            <div className="flex items-center justify-between py-1">
                              <div className="flex items-center space-x-2 text-slate-600 dark:text-slate-400">
                                <CpuChipIcon className="w-3 h-3" />
                                <span>CPU:</span>
                              </div>
                              <span className="font-medium text-slate-900 dark:text-white">
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
                        <div className="flex items-center space-x-2 text-slate-700 dark:text-slate-300 font-medium">
                          <GlobeAltIcon className="w-4 h-4" />
                          <span>Networks</span>
                        </div>
                        {container.networks.map((network, netIndex) => (
                          <div key={netIndex} className="pl-6 space-y-1">
                            <div className="flex items-center justify-between">
                              <span className="text-slate-600 dark:text-slate-400">
                                {network.name}
                              </span>
                              {network.ip_address && (
                                <span className="font-mono text-xs bg-slate-100 dark:bg-slate-700 px-2 py-1 rounded text-slate-900 dark:text-white">
                                  {network.ip_address}
                                </span>
                              )}
                            </div>
                            {network.aliases && network.aliases.length > 0 && (
                              <div className="text-xs text-slate-500 dark:text-slate-400">
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
                          <div className="flex items-center space-x-2 text-slate-600 dark:text-slate-400">
                            <ClockIcon className="w-3 h-3" />
                            <span>Created:</span>
                          </div>
                          <span className="font-mono text-xs text-slate-900 dark:text-white">
                            {new Date(container.created).toLocaleDateString()}{' '}
                            {new Date(container.created).toLocaleTimeString()}
                          </span>
                        </div>
                      )}

                      {container.started && (
                        <div className="flex items-center justify-between py-1">
                          <div className="flex items-center space-x-2 text-slate-600 dark:text-slate-400">
                            <ClockIcon className="w-3 h-3" />
                            <span>Started:</span>
                          </div>
                          <span className="font-mono text-xs text-slate-900 dark:text-white">
                            {new Date(container.started).toLocaleDateString()}{' '}
                            {new Date(container.started).toLocaleTimeString()}
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Mounts */}
                    {container.mounts && container.mounts.length > 0 && (
                      <div className="space-y-2">
                        <div className="flex items-center space-x-2 text-slate-700 dark:text-slate-300 font-medium">
                          <CircleStackIcon className="w-4 h-4" />
                          <span>Mounts</span>
                        </div>
                        <div className="pl-6 space-y-1 max-h-32 overflow-y-auto">
                          {container.mounts.map((mount, mountIndex) => (
                            <div key={mountIndex} className="space-y-1">
                              <div className="flex items-center space-x-2">
                                <span
                                  className={`px-1.5 py-0.5 text-xs rounded font-medium ${
                                    mount.type === 'volume'
                                      ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300'
                                      : mount.type === 'bind'
                                        ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300'
                                        : 'bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-300'
                                  }`}
                                >
                                  {mount.type}
                                </span>
                                <span
                                  className={`text-xs ${mount.rw ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}
                                >
                                  {mount.rw ? 'RW' : 'RO'}
                                </span>
                              </div>
                              <div className="text-xs font-mono text-slate-600 dark:text-slate-400 break-all">
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
                        <div className="flex items-center space-x-2 text-slate-700 dark:text-slate-300 font-medium">
                          <CommandLineIcon className="w-4 h-4" />
                          <span>Command</span>
                        </div>
                        <div className="font-mono text-xs bg-slate-100 dark:bg-slate-700 text-slate-900 dark:text-white p-2 rounded break-all">
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
