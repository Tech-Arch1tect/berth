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
  TagIcon,
  LinkIcon,
} from '@heroicons/react/24/outline';
import {
  CheckCircleIcon as CheckCircleIconSolid,
  XCircleIcon as XCircleIconSolid,
  ClockIcon as ClockIconSolid,
  ExclamationTriangleIcon as ExclamationTriangleIconSolid,
} from '@heroicons/react/24/solid';

interface EnhancedServiceCardProps {
  service: ComposeService;
  onQuickOperation: (operation: OperationRequest) => void;
  serverid: number;
  stackname: string;
  isOperationRunning: boolean;
  runningOperation?: string;
}

export const EnhancedServiceCard: React.FC<EnhancedServiceCardProps> = ({
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
          color: 'text-green-500',
          bg: 'bg-green-500/10 border-green-500/20',
          label: 'Running',
        };
      case 'stopped':
      case 'exited':
        return {
          icon: StopIcon,
          color: 'text-red-500',
          bg: 'bg-red-500/10 border-red-500/20',
          label:
            container.exit_code === 0 ? 'Exited' : `Error (${container.exit_code || 'Unknown'})`,
        };
      case 'paused':
        return {
          icon: ClockIconSolid,
          color: 'text-yellow-500',
          bg: 'bg-yellow-500/10 border-yellow-500/20',
          label: 'Paused',
        };
      case 'restarting':
        return {
          icon: ArrowPathIcon,
          color: 'text-blue-500',
          bg: 'bg-blue-500/10 border-blue-500/20',
          label: 'Restarting',
        };
      case 'not created':
        return {
          icon: XCircleIconSolid,
          color: 'text-slate-400',
          bg: 'bg-slate-500/10 border-slate-500/20',
          label: 'Not Created',
        };
      default:
        return {
          icon: ExclamationTriangleIconSolid,
          color: 'text-orange-500',
          bg: 'bg-orange-500/10 border-orange-500/20',
          label: state.charAt(0).toUpperCase() + state.slice(1),
        };
    }
  };

  const getHealthStatusInfo = (health?: Container['health']) => {
    if (!health) return null;

    switch (health.status?.toLowerCase()) {
      case 'healthy':
        return {
          icon: CheckCircleIconSolid,
          color: 'text-green-500',
          label: 'Healthy',
        };
      case 'unhealthy':
        return {
          icon: XCircleIconSolid,
          color: 'text-red-500',
          label: `Unhealthy (${health.failing_streak || 0} failures)`,
        };
      case 'starting':
        return {
          icon: ClockIconSolid,
          color: 'text-yellow-500',
          label: 'Starting',
        };
      default:
        return {
          icon: ExclamationTriangleIconSolid,
          color: 'text-orange-500',
          label: 'Unknown',
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
    <div className="bg-white/70 dark:bg-slate-800/70 backdrop-blur-sm rounded-xl border border-slate-200/50 dark:border-slate-700/50 overflow-hidden">
      {/* Service Header */}
      <div className="p-6 border-b border-slate-200/30 dark:border-slate-700/30">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-600 rounded-xl flex items-center justify-center">
                <ServerIcon className="w-5 h-5 text-white" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-slate-900 dark:text-white">
                  {service.name}
                </h3>
                {service.image && (
                  <p className="text-sm text-slate-600 dark:text-slate-400 font-mono">
                    {service.image}
                  </p>
                )}
              </div>
            </div>

            {/* Container Status Summary */}
            <div className="flex items-center space-x-3">
              <div className="flex items-center space-x-2 px-3 py-1.5 bg-slate-100 dark:bg-slate-700 rounded-lg">
                <ServerIcon className="w-4 h-4 text-slate-600 dark:text-slate-400" />
                <span className="text-sm font-medium text-slate-900 dark:text-white">
                  {runningContainers.length}/{totalContainers}
                </span>
                <span className="text-xs text-slate-600 dark:text-slate-400">running</span>
              </div>

              {service.restart && (
                <div className="flex items-center space-x-2 px-3 py-1.5 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
                  <ArrowPathIcon className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                  <span className="text-sm font-medium text-blue-700 dark:text-blue-300">
                    {service.restart}
                  </span>
                </div>
              )}

              {service.scale && service.scale > 1 && (
                <div className="flex items-center space-x-2 px-3 py-1.5 bg-purple-100 dark:bg-purple-900/30 rounded-lg">
                  <span className="text-sm font-medium text-purple-700 dark:text-purple-300">
                    ×{service.scale}
                  </span>
                </div>
              )}
            </div>
          </div>

          <div className="flex items-center space-x-3">
            <button
              onClick={() => setIsExpanded(!isExpanded)}
              className="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
            >
              {isExpanded ? (
                <ChevronUpIcon className="w-5 h-5 text-slate-600 dark:text-slate-400" />
              ) : (
                <ChevronDownIcon className="w-5 h-5 text-slate-600 dark:text-slate-400" />
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

        {/* Service Level Info */}
        {(service.depends_on || service.profiles || service.command || service.user) && (
          <div className="flex flex-wrap gap-3">
            {service.depends_on && service.depends_on.length > 0 && (
              <div className="flex items-center space-x-2 text-sm">
                <LinkIcon className="w-4 h-4 text-slate-500" />
                <span className="text-slate-600 dark:text-slate-400">
                  Depends on: {service.depends_on.join(', ')}
                </span>
              </div>
            )}

            {service.profiles && service.profiles.length > 0 && (
              <div className="flex items-center space-x-2 text-sm">
                <TagIcon className="w-4 h-4 text-slate-500" />
                <span className="text-slate-600 dark:text-slate-400">
                  Profiles: {service.profiles.join(', ')}
                </span>
              </div>
            )}

            {service.command && service.command.length > 0 && (
              <div className="flex items-center space-x-2 text-sm">
                <CommandLineIcon className="w-4 h-4 text-slate-500" />
                <span className="text-slate-600 dark:text-slate-400 font-mono text-xs">
                  {service.command.join(' ')}
                </span>
              </div>
            )}

            {service.user && (
              <div className="flex items-center space-x-2 text-sm">
                <UserIcon className="w-4 h-4 text-slate-500" />
                <span className="text-slate-600 dark:text-slate-400">{service.user}</span>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Containers */}
      <div className="p-6">
        <div className="space-y-4">
          {service.containers &&
            service.containers.map((container, index) => {
              const statusInfo = getContainerStatusInfo(container);
              const healthInfo = getHealthStatusInfo(container.health);
              const uptime = formatUptime(container.started);
              const StatusIcon = statusInfo.icon;

              return (
                <div
                  key={container.name || index}
                  className="bg-slate-50/80 dark:bg-slate-900/50 rounded-lg border border-slate-200/50 dark:border-slate-700/50 p-4"
                >
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center space-x-4">
                      <div className={`p-2 rounded-lg ${statusInfo.bg}`}>
                        <StatusIcon className={`w-4 h-4 ${statusInfo.color}`} />
                      </div>
                      <div>
                        <div className="flex items-center space-x-2">
                          <h4 className="font-medium text-slate-900 dark:text-white">
                            {container.name}
                          </h4>
                          <span
                            className={`px-2 py-1 text-xs font-medium rounded-full ${statusInfo.bg} ${statusInfo.color}`}
                          >
                            {statusInfo.label}
                          </span>
                          {healthInfo && (
                            <div className="flex items-center space-x-1">
                              <healthInfo.icon className={`w-3 h-3 ${healthInfo.color}`} />
                              <span className={`text-xs font-medium ${healthInfo.color}`}>
                                {healthInfo.label}
                              </span>
                            </div>
                          )}
                        </div>
                        <p className="text-sm text-slate-600 dark:text-slate-400 font-mono">
                          {container.image}
                        </p>
                      </div>
                    </div>

                    {uptime && (
                      <div className="flex items-center space-x-2 text-sm text-slate-600 dark:text-slate-400">
                        <ClockIcon className="w-4 h-4" />
                        <span>{uptime}</span>
                      </div>
                    )}
                  </div>

                  {isExpanded && (
                    <div className="mt-4 space-y-4">
                      {/* Resource Information */}
                      {container.resource_limits && (
                        <div className="bg-white/60 dark:bg-slate-800/60 rounded-lg p-4 border border-slate-200/30 dark:border-slate-700/30">
                          <h5 className="text-sm font-semibold text-slate-900 dark:text-white mb-3 flex items-center">
                            <CpuChipIcon className="w-4 h-4 mr-2 text-purple-500" />
                            Resource Limits
                          </h5>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            {container.resource_limits.memory && (
                              <div className="flex items-center justify-between p-2 bg-slate-50 dark:bg-slate-900/50 rounded">
                                <span className="text-sm text-slate-600 dark:text-slate-400">
                                  Memory:
                                </span>
                                <span className="font-medium text-slate-900 dark:text-white">
                                  {formatMemory(container.resource_limits.memory)}
                                </span>
                              </div>
                            )}
                            {container.resource_limits.cpu_shares && (
                              <div className="flex items-center justify-between p-2 bg-slate-50 dark:bg-slate-900/50 rounded">
                                <span className="text-sm text-slate-600 dark:text-slate-400">
                                  CPU Shares:
                                </span>
                                <span className="font-medium text-slate-900 dark:text-white">
                                  {container.resource_limits.cpu_shares}
                                </span>
                              </div>
                            )}
                          </div>
                        </div>
                      )}

                      {/* Container Configuration */}
                      <div className="bg-white/60 dark:bg-slate-800/60 rounded-lg p-4 border border-slate-200/30 dark:border-slate-700/30">
                        <h5 className="text-sm font-semibold text-slate-900 dark:text-white mb-3 flex items-center">
                          <ServerIcon className="w-4 h-4 mr-2 text-blue-500" />
                          Configuration
                        </h5>
                        <div className="space-y-3">
                          {/* Restart Policy */}
                          {container.restart_policy && (
                            <div className="flex items-center justify-between p-2 bg-slate-50 dark:bg-slate-900/50 rounded">
                              <div className="flex items-center space-x-2">
                                <ArrowPathIcon className="w-3 h-3 text-green-500" />
                                <span className="text-sm text-slate-600 dark:text-slate-400">
                                  Restart Policy:
                                </span>
                              </div>
                              <span className="font-medium text-slate-900 dark:text-white">
                                {container.restart_policy.name}
                                {container.restart_policy.maximum_retry_count > 0 &&
                                  ` (max: ${container.restart_policy.maximum_retry_count})`}
                              </span>
                            </div>
                          )}

                          {/* Working Directory */}
                          {container.working_dir && (
                            <div className="flex items-center justify-between p-2 bg-slate-50 dark:bg-slate-900/50 rounded">
                              <div className="flex items-center space-x-2">
                                <FolderIcon className="w-3 h-3 text-orange-500" />
                                <span className="text-sm text-slate-600 dark:text-slate-400">
                                  Working Directory:
                                </span>
                              </div>
                              <span className="font-mono text-sm text-slate-900 dark:text-white">
                                {container.working_dir}
                              </span>
                            </div>
                          )}

                          {/* User */}
                          {container.user && (
                            <div className="flex items-center justify-between p-2 bg-slate-50 dark:bg-slate-900/50 rounded">
                              <div className="flex items-center space-x-2">
                                <UserIcon className="w-3 h-3 text-indigo-500" />
                                <span className="text-sm text-slate-600 dark:text-slate-400">
                                  User:
                                </span>
                              </div>
                              <span className="font-mono text-sm text-slate-900 dark:text-white">
                                {container.user}
                              </span>
                            </div>
                          )}

                          {/* Command */}
                          {container.command && container.command.length > 0 && (
                            <div className="p-2 bg-slate-50 dark:bg-slate-900/50 rounded">
                              <div className="flex items-center space-x-2 mb-2">
                                <CommandLineIcon className="w-3 h-3 text-emerald-500" />
                                <span className="text-sm text-slate-600 dark:text-slate-400">
                                  Command:
                                </span>
                              </div>
                              <div className="font-mono text-xs text-slate-900 dark:text-white bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded">
                                {container.command.join(' ')}
                              </div>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Network Information */}
                      {container.ports && container.ports.length > 0 && (
                        <div className="bg-white/60 dark:bg-slate-800/60 rounded-lg p-4 border border-slate-200/30 dark:border-slate-700/30">
                          <h5 className="text-sm font-semibold text-slate-900 dark:text-white mb-3 flex items-center">
                            <LinkIcon className="w-4 h-4 mr-2 text-blue-500" />
                            Network Ports
                          </h5>
                          <div className="flex flex-wrap gap-2">
                            {container.ports.map((port, portIndex) => (
                              <div
                                key={portIndex}
                                className="flex items-center space-x-2 px-3 py-1.5 bg-blue-50 dark:bg-blue-900/20 border border-blue-200/50 dark:border-blue-800/50 rounded-lg"
                              >
                                <div className="w-2 h-2 bg-blue-500 rounded-full" />
                                <span className="font-mono text-sm text-blue-700 dark:text-blue-300">
                                  {port.public ? `${port.public}:${port.private}` : port.private}/
                                  {port.type}
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Timeline */}
                      <div className="bg-white/60 dark:bg-slate-800/60 rounded-lg p-4 border border-slate-200/30 dark:border-slate-700/30">
                        <h5 className="text-sm font-semibold text-slate-900 dark:text-white mb-3 flex items-center">
                          <ClockIcon className="w-4 h-4 mr-2 text-slate-500" />
                          Timeline
                        </h5>
                        <div className="space-y-2">
                          {container.created && (
                            <div className="flex items-center justify-between p-2 bg-slate-50 dark:bg-slate-900/50 rounded text-sm">
                              <span className="text-slate-600 dark:text-slate-400">Created:</span>
                              <span className="font-mono text-slate-900 dark:text-white">
                                {new Date(container.created).toLocaleString()}
                              </span>
                            </div>
                          )}
                          {container.started && (
                            <div className="flex items-center justify-between p-2 bg-slate-50 dark:bg-slate-900/50 rounded text-sm">
                              <span className="text-slate-600 dark:text-slate-400">Started:</span>
                              <div className="text-right">
                                <div className="font-mono text-slate-900 dark:text-white">
                                  {new Date(container.started).toLocaleString()}
                                </div>
                                {uptime && (
                                  <div className="text-xs text-green-600 dark:text-green-400">
                                    {uptime} ago
                                  </div>
                                )}
                              </div>
                            </div>
                          )}
                          {container.finished && (
                            <div className="flex items-center justify-between p-2 bg-slate-50 dark:bg-slate-900/50 rounded text-sm">
                              <span className="text-slate-600 dark:text-slate-400">Finished:</span>
                              <span className="font-mono text-slate-900 dark:text-white">
                                {new Date(container.finished).toLocaleString()}
                              </span>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
        </div>
      </div>
    </div>
  );
};
