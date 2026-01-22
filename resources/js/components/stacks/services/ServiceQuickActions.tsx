import {
  ArrowDownCircleIcon,
  ArrowPathIcon,
  ArrowUpCircleIcon,
  CloudArrowDownIcon,
  CommandLineIcon,
  PlayIcon,
  StopCircleIcon,
} from '@heroicons/react/24/outline';
import type { ComponentType, SVGProps } from 'react';
import { theme } from '../../../theme';
import type { GetApiV1ServersServeridStacksStackname200ServicesItem } from '../../../api/generated/models';
import { OperationRequest } from '../../../types/operations';
import { cn } from '../../../utils/cn';
import { useServerStack } from '../../../contexts/ServerStackContext';
import { useTerminalPanel } from '../../../contexts/TerminalPanelContext';
import {
  getServiceActionState,
  hasStoppedContainers,
  hasCreatedContainers,
  type ActionState,
} from '../../../utils/statusHelpers';

interface ServiceQuickActionsProps {
  service: GetApiV1ServersServeridStacksStackname200ServicesItem;
  onQuickOperation: (operation: OperationRequest) => void;
  disabled?: boolean;
  isOperationRunning?: boolean;
  runningOperation?: string;
}

type ActionKey = 'up' | 'start' | 'stop' | 'restart' | 'down' | 'pull';

const spinner = <span className={theme.effects.spinnerSm} />;

const iconMap: Record<ActionKey, ComponentType<SVGProps<SVGSVGElement>>> = {
  up: ArrowUpCircleIcon,
  start: PlayIcon,
  stop: StopCircleIcon,
  restart: ArrowPathIcon,
  down: ArrowDownCircleIcon,
  pull: CloudArrowDownIcon,
};

export const ServiceQuickActions = ({
  service,
  onQuickOperation,
  disabled = false,
  isOperationRunning = false,
  runningOperation,
}: ServiceQuickActionsProps) => {
  const { serverId, stackName } = useServerStack();
  const { openTerminal } = useTerminalPanel();

  const serviceState: ActionState = getServiceActionState(service);
  const busy = (command: ActionKey) =>
    isOperationRunning && runningOperation === `${command}:${service.name}`;
  const isDisabled = disabled || isOperationRunning;

  const handleOperation = (command: ActionKey) => {
    onQuickOperation({ command, options: [], services: [service.name] });
  };

  if (serviceState === 'no-containers') {
    return <div className={cn('text-xs', theme.text.subtle)}>No containers</div>;
  }

  const actionConfig: Array<{
    command: ActionKey;
    baseLabel: string;
    title: string;
    visible: boolean;
    colorClass: string;
  }> = [
    {
      command: 'up',
      baseLabel: 'Up',
      title: `Deploy/Update ${service.name}`,
      visible: true,
      colorClass:
        'bg-teal-100 text-teal-700 hover:bg-teal-200 dark:bg-teal-500/30 dark:text-teal-100 dark:hover:bg-teal-500/45',
    },
    {
      command: 'start',
      baseLabel: 'Start',
      title: `Start ${service.name}`,
      visible:
        serviceState === 'all-stopped' ||
        (serviceState === 'mixed-running' && hasStoppedContainers(service)),
      colorClass:
        'bg-emerald-100 text-emerald-700 hover:bg-emerald-200 dark:bg-emerald-500/25 dark:text-emerald-100 dark:hover:bg-emerald-500/40',
    },
    {
      command: 'stop',
      baseLabel: 'Stop',
      title: `Stop ${service.name}`,
      visible: serviceState === 'all-running' || serviceState === 'mixed-running',
      colorClass:
        'bg-rose-100 text-rose-700 hover:bg-rose-200 dark:bg-rose-500/25 dark:text-rose-100 dark:hover:bg-rose-500/40',
    },
    {
      command: 'restart',
      baseLabel: 'Restart',
      title: `Restart ${service.name}`,
      visible: serviceState === 'all-running',
      colorClass:
        'bg-blue-100 text-blue-700 hover:bg-blue-200 dark:bg-blue-500/30 dark:text-blue-100 dark:hover:bg-blue-500/45',
    },
    {
      command: 'pull',
      baseLabel: 'Pull',
      title: `Pull latest image for ${service.name}`,
      visible: true,
      colorClass:
        'bg-indigo-100 text-indigo-700 hover:bg-indigo-200 dark:bg-indigo-500/25 dark:text-indigo-100 dark:hover:bg-indigo-500/40',
    },
    {
      command: 'down',
      baseLabel: 'Down',
      title: `Stop and remove ${service.name}`,
      visible: serviceState !== 'all-not-created' && hasCreatedContainers(service),
      colorClass:
        'bg-amber-100 text-amber-700 hover:bg-amber-200 dark:bg-amber-500/25 dark:text-amber-100 dark:hover:bg-amber-500/40',
    },
  ];

  const canOpenTerminal = Boolean(
    serverId && stackName && (serviceState === 'all-running' || serviceState === 'mixed-running')
  );

  const visibleActions = actionConfig.filter((action) => action.visible);

  return (
    <div
      className={cn(
        'flex items-center rounded-lg overflow-hidden',
        'border border-zinc-200 dark:border-zinc-700'
      )}
    >
      <span
        className={cn(
          'text-xs font-semibold uppercase tracking-wide px-3 py-1.5',
          'bg-zinc-100 dark:bg-zinc-800',
          theme.text.muted
        )}
      >
        Service
      </span>
      <div className="w-px h-full bg-zinc-200 dark:bg-zinc-700" />
      <div className="flex items-center">
        {visibleActions.map((action) => {
          const Icon = iconMap[action.command];
          const label = busy(action.command) ? `${action.baseLabel}…` : action.baseLabel;

          return (
            <button
              key={action.command}
              type="button"
              onClick={() => handleOperation(action.command)}
              disabled={isDisabled}
              className={cn(
                'inline-flex items-center justify-center gap-1 px-2 py-1.5 text-xs font-medium transition-colors',
                'lg:min-w-[4.5rem] lg:px-2.5',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 focus-visible:z-10',
                'disabled:cursor-not-allowed disabled:opacity-50',
                action.colorClass,
                isDisabled && 'cursor-not-allowed opacity-50'
              )}
              title={action.title}
            >
              {busy(action.command) ? spinner : <Icon className="w-3.5 h-3.5" />}
              <span className="hidden lg:inline">{label}</span>
            </button>
          );
        })}

        {canOpenTerminal && (
          <button
            type="button"
            onClick={() =>
              serverId &&
              stackName &&
              openTerminal({
                serverid: serverId,
                stackname: stackName,
                serviceName: service.name,
                containerName: service.containers?.[0]?.name,
              })
            }
            disabled={isDisabled}
            className={cn(
              'inline-flex items-center justify-center gap-1 px-2 py-1.5 text-xs font-medium transition-colors',
              'lg:min-w-[4.5rem] lg:px-2.5',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 focus-visible:z-10',
              'disabled:cursor-not-allowed disabled:opacity-50',
              'bg-slate-100 text-slate-700 hover:bg-slate-200 dark:bg-slate-500/25 dark:text-slate-100 dark:hover:bg-slate-500/40',
              isDisabled && 'cursor-not-allowed opacity-50'
            )}
            title={`Open terminal for ${service.name}`}
          >
            <CommandLineIcon className="w-3.5 h-3.5" />
            <span className="hidden lg:inline">Terminal</span>
          </button>
        )}
      </div>
    </div>
  );
};

export default ServiceQuickActions;
