import {
  ArrowDownCircleIcon,
  ArrowPathIcon,
  ArrowUpCircleIcon,
  CloudArrowDownIcon,
  CommandLineIcon,
  PlayIcon,
  StopCircleIcon,
} from '@heroicons/react/24/outline';
import { useState } from 'react';
import type { ComponentType, SVGProps } from 'react';
import { theme } from '../../../theme';
import { ComposeService } from '../../../types/stack';
import { OperationRequest } from '../../../types/operations';
import { cn } from '../../../utils/cn';
import { TerminalModal } from '../../terminal/TerminalModal';

interface ServiceQuickActionsProps {
  service: ComposeService;
  onQuickOperation: (operation: OperationRequest) => void;
  serverid?: number;
  stackname?: string;
  disabled?: boolean;
  isOperationRunning?: boolean;
  runningOperation?: string;
}

type ServiceState =
  | 'no-containers'
  | 'all-running'
  | 'all-stopped'
  | 'all-not-created'
  | 'mixed-running'
  | 'mixed-not-created'
  | 'other';

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
  serverid,
  stackname,
  disabled = false,
  isOperationRunning = false,
  runningOperation,
}: ServiceQuickActionsProps) => {
  const [terminalOpen, setTerminalOpen] = useState(false);

  const determineState = (): ServiceState => {
    const containers = service.containers ?? [];
    if (containers.length === 0) return 'no-containers';

    const total = containers.length;
    const running = containers.filter((container) => container.state === 'running').length;
    const stopped = containers.filter((container) =>
      ['stopped', 'exited'].includes(container.state ?? '')
    ).length;
    const notCreated = containers.filter((container) => container.state === 'not created').length;

    if (running === total) return 'all-running';
    if (stopped === total) return 'all-stopped';
    if (notCreated === total) return 'all-not-created';
    if (running > 0) return 'mixed-running';
    if (notCreated > 0) return 'mixed-not-created';
    return 'other';
  };

  const serviceState = determineState();
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
    className: string;
  }> = [
    {
      command: 'up',
      baseLabel: 'Up',
      title: `Deploy/Update ${service.name}`,
      visible: true,
      className: cn(theme.toolbar.button, theme.toolbar.buttonInfo),
    },
    {
      command: 'start',
      baseLabel: 'Start',
      title: `Start ${service.name}`,
      visible:
        serviceState === 'all-stopped' ||
        (serviceState === 'mixed-running' &&
          service.containers?.some((container) =>
            ['stopped', 'exited'].includes(container.state ?? '')
          )),
      className: cn(theme.toolbar.button, theme.toolbar.buttonSuccess),
    },
    {
      command: 'stop',
      baseLabel: 'Stop',
      title: `Stop ${service.name}`,
      visible: serviceState === 'all-running' || serviceState === 'mixed-running',
      className: cn(theme.toolbar.button, theme.toolbar.buttonDanger),
    },
    {
      command: 'restart',
      baseLabel: 'Restart',
      title: `Restart ${service.name}`,
      visible: serviceState === 'all-running',
      className: cn(theme.toolbar.button, theme.toolbar.buttonInfo),
    },
    {
      command: 'down',
      baseLabel: 'Down',
      title: `Stop and remove ${service.name}`,
      visible:
        serviceState !== 'all-not-created' &&
        service.containers?.some((container) => container.state !== 'not created') === true,
      className: cn(theme.toolbar.button, theme.toolbar.buttonWarning),
    },
    {
      command: 'pull',
      baseLabel: 'Pull',
      title: `Pull latest image for ${service.name}`,
      visible: true,
      className: cn(theme.toolbar.button, theme.toolbar.buttonSecondary),
    },
  ];

  const canOpenTerminal = Boolean(
    serverid && stackname && (serviceState === 'all-running' || serviceState === 'mixed-running')
  );

  return (
    <div className={theme.toolbar.container}>
      {actionConfig
        .filter((action) => action.visible)
        .map((action) => {
          const Icon = iconMap[action.command];
          const label = busy(action.command) ? `${action.baseLabel}…` : action.baseLabel;

          return (
            <button
              key={action.command}
              type="button"
              onClick={() => handleOperation(action.command)}
              disabled={isDisabled}
              className={cn(
                action.className,
                'flex items-center gap-1',
                isDisabled && theme.toolbar.disabled
              )}
              title={action.title}
            >
              {busy(action.command) ? spinner : <Icon className={theme.toolbar.icon} />}
              <span>{label}</span>
            </button>
          );
        })}

      {canOpenTerminal && (
        <button
          type="button"
          onClick={() => setTerminalOpen(true)}
          disabled={isDisabled}
          className={cn(
            theme.toolbar.button,
            theme.toolbar.buttonSuccess,
            'flex items-center gap-1',
            isDisabled && theme.toolbar.disabled
          )}
          title={`Open terminal for ${service.name}`}
        >
          <CommandLineIcon className={theme.toolbar.icon} />
          <span>Terminal</span>
        </button>
      )}

      {terminalOpen && serverid && stackname && (
        <TerminalModal
          isOpen={terminalOpen}
          onClose={() => setTerminalOpen(false)}
          serverid={serverid}
          stackname={stackname}
          serviceName={service.name}
          containerName={service.containers?.[0]?.name}
        />
      )}
    </div>
  );
};

export default ServiceQuickActions;
