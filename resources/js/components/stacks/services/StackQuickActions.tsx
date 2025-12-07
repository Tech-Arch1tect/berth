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
import { ComposeService } from '../../../types/stack';
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

  return (
    <>
      {actions
        .filter((action) => action.visible)
        .map((action) => {
          const Icon = iconMap[action.command];
          return (
            <button
              key={action.command}
              type="button"
              onClick={() => handleAction(action.command)}
              disabled={isDisabled}
              className={cn(
                'p-2 rounded-md transition-colors relative',
                isDisabled && 'opacity-50 cursor-not-allowed',
                action.command === 'up' &&
                  'hover:bg-teal-100 text-teal-700 dark:hover:bg-teal-900/30 dark:text-teal-400',
                action.command === 'start' &&
                  'hover:bg-emerald-100 text-emerald-700 dark:hover:bg-emerald-900/30 dark:text-emerald-400',
                action.command === 'stop' &&
                  'hover:bg-rose-100 text-rose-700 dark:hover:bg-rose-900/30 dark:text-rose-400',
                action.command === 'restart' &&
                  'hover:bg-blue-100 text-blue-700 dark:hover:bg-blue-900/30 dark:text-blue-400',
                action.command === 'pull' &&
                  'hover:bg-indigo-100 text-indigo-700 dark:hover:bg-indigo-900/30 dark:text-indigo-400',
                action.command === 'down' &&
                  'hover:bg-amber-100 text-amber-700 dark:hover:bg-amber-900/30 dark:text-amber-400'
              )}
              title={`${action.title}${isBusy(action.command) ? ' (running…)' : ''}`}
            >
              {isBusy(action.command) ? (
                <span className={cn(theme.effects.spinnerSm, 'border-current')} />
              ) : (
                <Icon className="w-4 h-4" />
              )}
            </button>
          );
        })}
    </>
  );
};

export default StackQuickActions;
