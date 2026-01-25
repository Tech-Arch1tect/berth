import {
  ArrowDownCircleIcon,
  ArrowPathIcon,
  ArrowUpCircleIcon,
  CloudArrowDownIcon,
  PlayIcon,
  StopCircleIcon,
} from '@heroicons/react/24/outline';
import type { ComponentType, SVGProps } from 'react';
import { theme } from '../../../theme';
import type { ComposeService } from '../../../api/generated/models';
import { OperationRequest } from '../../../types/operations';
import { cn } from '../../../utils/cn';
import {
  getStackActionState,
  stackHasStoppedContainers,
  type ActionState,
} from '../../../utils/statusHelpers';

interface StackQuickActionsProps {
  services: ComposeService[];
  onQuickOperation: (operation: OperationRequest) => void;
  disabled?: boolean;
  isOperationRunning?: boolean;
  runningOperation?: string;
}

type ActionKey = 'up' | 'start' | 'stop' | 'restart' | 'pull' | 'down';

const iconMap: Record<ActionKey, ComponentType<SVGProps<SVGSVGElement>>> = {
  up: ArrowUpCircleIcon,
  start: PlayIcon,
  stop: StopCircleIcon,
  restart: ArrowPathIcon,
  pull: CloudArrowDownIcon,
  down: ArrowDownCircleIcon,
};

export const StackQuickActions = ({
  services,
  onQuickOperation,
  disabled = false,
  isOperationRunning = false,
  runningOperation,
}: StackQuickActionsProps) => {
  const stackState: ActionState = getStackActionState(services);
  const isBusy = (command: ActionKey) =>
    isOperationRunning && runningOperation === `stack:${command}`;
  const isDisabled = disabled || isOperationRunning;

  const handleAction = (command: ActionKey) => {
    onQuickOperation({ command, options: [], services: [] });
  };

  if (stackState === 'no-containers') {
    return <div className={cn('text-xs', theme.text.subtle)}>No containers</div>;
  }

  const actions: Array<{
    command: ActionKey;
    label: string;
    title: string;
    visible: boolean;
    className: string;
  }> = [
    {
      command: 'up' as const,
      label: 'Up',
      title: 'Deploy/Update stack (applies configuration changes)',
      visible: true,
      className: cn(theme.toolbar.button, theme.toolbar.buttonInfo),
    },
    {
      command: 'start' as const,
      label: 'Start',
      title: 'Start stack',
      visible:
        stackState === 'all-stopped' ||
        (stackState === 'mixed-running' && stackHasStoppedContainers(services)),
      className: cn(theme.toolbar.button, theme.toolbar.buttonSuccess),
    },
    {
      command: 'stop' as const,
      label: 'Stop',
      title: 'Stop stack',
      visible: stackState === 'all-running' || stackState === 'mixed-running',
      className: cn(theme.toolbar.button, theme.toolbar.buttonDanger),
    },
    {
      command: 'restart' as const,
      label: 'Restart',
      title: 'Restart stack',
      visible: stackState === 'all-running',
      className: cn(theme.toolbar.button, theme.toolbar.buttonInfo),
    },
    {
      command: 'pull' as const,
      label: 'Pull',
      title: 'Pull latest images',
      visible: stackState !== 'all-not-created',
      className: cn(theme.toolbar.button, theme.toolbar.buttonSecondary),
    },
    {
      command: 'down' as const,
      label: 'Down',
      title: 'Stop and remove stack',
      visible: stackState === 'all-running' || stackState === 'mixed-running',
      className: cn(theme.toolbar.button, theme.toolbar.buttonWarning),
    },
  ];

  const colorClasses: Record<ActionKey, string> = {
    up: 'bg-teal-100 text-teal-700 hover:bg-teal-200 dark:bg-teal-500/30 dark:text-teal-100 dark:hover:bg-teal-500/45',
    start:
      'bg-emerald-100 text-emerald-700 hover:bg-emerald-200 dark:bg-emerald-500/25 dark:text-emerald-100 dark:hover:bg-emerald-500/40',
    stop: 'bg-rose-100 text-rose-700 hover:bg-rose-200 dark:bg-rose-500/25 dark:text-rose-100 dark:hover:bg-rose-500/40',
    restart:
      'bg-blue-100 text-blue-700 hover:bg-blue-200 dark:bg-blue-500/30 dark:text-blue-100 dark:hover:bg-blue-500/45',
    pull: 'bg-indigo-100 text-indigo-700 hover:bg-indigo-200 dark:bg-indigo-500/25 dark:text-indigo-100 dark:hover:bg-indigo-500/40',
    down: 'bg-amber-100 text-amber-700 hover:bg-amber-200 dark:bg-amber-500/25 dark:text-amber-100 dark:hover:bg-amber-500/40',
  };

  const visibleActions = actions.filter((action) => action.visible);

  return (
    <div className="flex items-center">
      {visibleActions.map((action) => {
        const Icon = iconMap[action.command];
        const busy = isBusy(action.command);
        const label = busy ? `${action.label}…` : action.label;

        return (
          <button
            key={action.command}
            type="button"
            onClick={() => handleAction(action.command)}
            disabled={isDisabled}
            className={cn(
              'inline-flex items-center justify-center gap-1 px-2 py-1.5 text-xs font-medium transition-colors',
              'lg:min-w-[4.5rem] lg:px-2.5',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 focus-visible:z-10',
              'disabled:cursor-not-allowed disabled:opacity-50',
              colorClasses[action.command],
              isDisabled && 'cursor-not-allowed opacity-50'
            )}
            title={`${action.title}${busy ? ' (running…)' : ''}`}
          >
            {busy ? (
              <span className={cn(theme.effects.spinnerSm, 'border-current')} />
            ) : (
              <Icon className="w-3.5 h-3.5" />
            )}
            <span className="hidden lg:inline">{label}</span>
          </button>
        );
      })}
    </div>
  );
};

export default StackQuickActions;
