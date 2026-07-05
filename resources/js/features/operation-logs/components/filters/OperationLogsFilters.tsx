import React from 'react';
import {
  ArrowPathIcon,
  ArrowUpTrayIcon,
  CalendarDaysIcon,
  ClockIcon,
  FunnelIcon,
  PlayIcon,
  StopIcon,
  XCircleIcon,
} from '@heroicons/react/24/outline';
import { cn } from '../../../../shared/utils/cn';
import { theme } from '../../../../shared/theme';

interface OperationLogsFiltersProps {
  selectedCommand: string;
  daysBack: number | null;
  onCommandChange: (command: string) => void;
  onDaysBackChange: (daysBack: number | null) => void;
  onClearFilters: () => void;
  hasActiveFilters: boolean;
}

interface FilterOptionProps {
  label: string;
  icon: React.ElementType;
  isActive: boolean;
  onClick: () => void;
}

const FilterOption: React.FC<FilterOptionProps> = ({ label, icon: Icon, isActive, onClick }) => (
  <button
    type="button"
    onClick={onClick}
    className={cn(
      'flex w-full min-h-[44px] items-center gap-3 rounded-lg border border-transparent px-3 py-2 transition-colors',
      isActive
        ? 'border-zinc-300 bg-zinc-100 dark:border-zinc-600 dark:bg-zinc-800'
        : 'hover:bg-zinc-50 dark:hover:bg-zinc-800/50'
    )}
  >
    <Icon className="h-4 w-4 flex-shrink-0 text-zinc-500 dark:text-zinc-400" />
    <span className={cn('flex-1 text-left text-sm', theme.text.standard)}>{label}</span>
  </button>
);

const timeScopes: { label: string; value: number | null }[] = [
  { label: 'All time', value: null },
  { label: 'Last 24 hours', value: 1 },
  { label: 'Last 7 days', value: 7 },
];

const commands = [
  { value: '', label: 'All commands', icon: FunnelIcon },
  { value: 'up', label: 'Up', icon: PlayIcon },
  { value: 'down', label: 'Down', icon: StopIcon },
  { value: 'restart', label: 'Restart', icon: ArrowPathIcon },
  { value: 'pull', label: 'Pull', icon: ArrowUpTrayIcon },
];

export const OperationLogsFilters: React.FC<OperationLogsFiltersProps> = ({
  selectedCommand,
  daysBack,
  onCommandChange,
  onDaysBackChange,
  onClearFilters,
  hasActiveFilters,
}) => (
  <div className="space-y-6 p-3">
    <div className="space-y-2">
      <h3 className={cn('px-1 text-xs font-semibold uppercase tracking-wider', theme.text.muted)}>
        Time
      </h3>
      <div className="space-y-1">
        {timeScopes.map((scope) => (
          <FilterOption
            key={scope.label}
            label={scope.label}
            icon={scope.value === null ? ClockIcon : CalendarDaysIcon}
            isActive={daysBack === scope.value}
            onClick={() => onDaysBackChange(scope.value)}
          />
        ))}
      </div>
    </div>

    <div className="space-y-2">
      <h3 className={cn('px-1 text-xs font-semibold uppercase tracking-wider', theme.text.muted)}>
        Command
      </h3>
      <div className="space-y-1">
        {commands.map((command) => (
          <FilterOption
            key={command.value}
            label={command.label}
            icon={command.icon}
            isActive={selectedCommand === command.value}
            onClick={() => onCommandChange(command.value)}
          />
        ))}
      </div>
    </div>

    {hasActiveFilters && (
      <button
        type="button"
        onClick={onClearFilters}
        className={cn(
          'flex w-full min-h-[44px] items-center justify-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium transition-colors',
          'border-zinc-300 hover:bg-zinc-100 dark:border-zinc-600 dark:hover:bg-zinc-800',
          theme.text.muted
        )}
      >
        <XCircleIcon className="h-4 w-4" />
        Clear all filters
      </button>
    )}
  </div>
);
