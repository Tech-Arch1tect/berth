import React from 'react';
import {
  ChartBarIcon,
  CheckCircleIcon,
  XCircleIcon,
  ExclamationTriangleIcon,
  ClockIcon,
  FunnelIcon,
  ArrowPathIcon,
  PlayIcon,
  StopIcon,
  ArrowUpTrayIcon,
} from '@heroicons/react/24/outline';
import { cn } from '../../../utils/cn';
import { theme } from '../../../theme';
import type { OperationLogStatsData } from '../../../api/generated/models';

interface OperationLogsSidebarProps {
  stats: OperationLogStatsData | null;
  selectedStatus: string;
  selectedCommand: string;
  onStatusChange: (status: string) => void;
  onCommandChange: (command: string) => void;
  onClearFilters: () => void;
  hasActiveFilters: boolean;
}

interface QuickFilterProps {
  label: string;
  value: string;
  count?: number;
  icon: React.ElementType;
  isActive: boolean;
  variant: 'neutral' | 'success' | 'danger' | 'warning' | 'info';
  onClick: () => void;
}

const variantStyles = {
  neutral: {
    active: 'bg-zinc-100 dark:bg-zinc-800 border-zinc-300 dark:border-zinc-600',
    inactive: 'hover:bg-zinc-50 dark:hover:bg-zinc-800/50',
    icon: 'text-zinc-500 dark:text-zinc-400',
    count: 'bg-zinc-200 dark:bg-zinc-700 text-zinc-700 dark:text-zinc-300',
  },
  success: {
    active: 'bg-emerald-50 dark:bg-emerald-900/20 border-emerald-300 dark:border-emerald-700',
    inactive: 'hover:bg-emerald-50/50 dark:hover:bg-emerald-900/10',
    icon: 'text-emerald-500 dark:text-emerald-400',
    count: 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300',
  },
  danger: {
    active: 'bg-red-50 dark:bg-red-900/20 border-red-300 dark:border-red-700',
    inactive: 'hover:bg-red-50/50 dark:hover:bg-red-900/10',
    icon: 'text-red-500 dark:text-red-400',
    count: 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300',
  },
  warning: {
    active: 'bg-amber-50 dark:bg-amber-900/20 border-amber-300 dark:border-amber-700',
    inactive: 'hover:bg-amber-50/50 dark:hover:bg-amber-900/10',
    icon: 'text-amber-500 dark:text-amber-400',
    count: 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300',
  },
  info: {
    active: 'bg-blue-50 dark:bg-blue-900/20 border-blue-300 dark:border-blue-700',
    inactive: 'hover:bg-blue-50/50 dark:hover:bg-blue-900/10',
    icon: 'text-blue-500 dark:text-blue-400',
    count: 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300',
  },
};

const QuickFilter: React.FC<QuickFilterProps> = ({
  label,
  count,
  icon: Icon,
  isActive,
  variant,
  onClick,
}) => {
  const styles = variantStyles[variant];

  return (
    <button
      onClick={onClick}
      className={cn(
        'w-full flex items-center gap-3 px-3 py-2 rounded-lg border transition-colors',
        'border-transparent',
        isActive ? styles.active : styles.inactive
      )}
    >
      <Icon className={cn('h-4 w-4 flex-shrink-0', styles.icon)} />
      <span className={cn('flex-1 text-left text-sm', theme.text.standard)}>{label}</span>
      {count !== undefined && (
        <span
          className={cn('px-2 py-0.5 rounded-full text-xs font-medium tabular-nums', styles.count)}
        >
          {count}
        </span>
      )}
    </button>
  );
};

const commandFilters = [
  { value: 'up', label: 'Up', icon: PlayIcon },
  { value: 'down', label: 'Down', icon: StopIcon },
  { value: 'restart', label: 'Restart', icon: ArrowPathIcon },
  { value: 'pull', label: 'Pull', icon: ArrowUpTrayIcon },
];

export const OperationLogsSidebar: React.FC<OperationLogsSidebarProps> = ({
  stats,
  selectedStatus,
  selectedCommand,
  onStatusChange,
  onCommandChange,
  onClearFilters,
  hasActiveFilters,
}) => {
  return (
    <div className="p-3 space-y-6">
      {/* Stats Summary */}
      {stats && (
        <div className="space-y-2">
          <h3
            className={cn('text-xs font-semibold uppercase tracking-wider px-1', theme.text.muted)}
          >
            Summary
          </h3>
          <div
            className={cn(
              'rounded-lg border p-3 space-y-2',
              'border-zinc-200 dark:border-zinc-700',
              'bg-zinc-50 dark:bg-zinc-800/50'
            )}
          >
            <div className="flex items-center justify-between text-sm">
              <span className={theme.text.subtle}>Total</span>
              <span className={cn('font-semibold tabular-nums', theme.text.strong)}>
                {stats.total_operations.toLocaleString()}
              </span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-emerald-600 dark:text-emerald-400">Successful</span>
              <span className="font-semibold tabular-nums text-emerald-600 dark:text-emerald-400">
                {stats.successful_operations.toLocaleString()}
              </span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-red-600 dark:text-red-400">Failed</span>
              <span className="font-semibold tabular-nums text-red-600 dark:text-red-400">
                {stats.failed_operations.toLocaleString()}
              </span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-amber-600 dark:text-amber-400">Incomplete</span>
              <span className="font-semibold tabular-nums text-amber-600 dark:text-amber-400">
                {stats.incomplete_operations.toLocaleString()}
              </span>
            </div>
            <div className="pt-2 border-t border-zinc-200 dark:border-zinc-700">
              <div className="flex items-center justify-between text-sm">
                <span className={theme.text.subtle}>Last 24h</span>
                <span className={cn('font-semibold tabular-nums', theme.text.strong)}>
                  {stats.recent_operations.toLocaleString()}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Status Filters */}
      <div className="space-y-2">
        <h3 className={cn('text-xs font-semibold uppercase tracking-wider px-1', theme.text.muted)}>
          Status
        </h3>
        <div className="space-y-1">
          <QuickFilter
            label="All Operations"
            value=""
            count={stats?.total_operations}
            icon={ChartBarIcon}
            isActive={selectedStatus === ''}
            variant="neutral"
            onClick={() => onStatusChange('')}
          />
          <QuickFilter
            label="Successful"
            value="success"
            count={stats?.successful_operations}
            icon={CheckCircleIcon}
            isActive={selectedStatus === 'success'}
            variant="success"
            onClick={() => onStatusChange('success')}
          />
          <QuickFilter
            label="Failed"
            value="failed"
            count={stats?.failed_operations}
            icon={XCircleIcon}
            isActive={selectedStatus === 'failed'}
            variant="danger"
            onClick={() => onStatusChange('failed')}
          />
          <QuickFilter
            label="Incomplete"
            value="incomplete"
            count={stats?.incomplete_operations}
            icon={ExclamationTriangleIcon}
            isActive={selectedStatus === 'incomplete'}
            variant="warning"
            onClick={() => onStatusChange('incomplete')}
          />
          <QuickFilter
            label="Last 24 Hours"
            value="recent"
            count={stats?.recent_operations}
            icon={ClockIcon}
            isActive={selectedStatus === 'recent'}
            variant="info"
            onClick={() => onStatusChange('recent')}
          />
        </div>
      </div>

      {/* Command Filters */}
      <div className="space-y-2">
        <h3 className={cn('text-xs font-semibold uppercase tracking-wider px-1', theme.text.muted)}>
          Command
        </h3>
        <div className="space-y-1">
          <QuickFilter
            label="All Commands"
            value=""
            icon={FunnelIcon}
            isActive={selectedCommand === ''}
            variant="neutral"
            onClick={() => onCommandChange('')}
          />
          {commandFilters.map((cmd) => (
            <QuickFilter
              key={cmd.value}
              label={cmd.label}
              value={cmd.value}
              icon={cmd.icon}
              isActive={selectedCommand === cmd.value}
              variant="neutral"
              onClick={() => onCommandChange(cmd.value)}
            />
          ))}
        </div>
      </div>

      {/* Clear Filters */}
      {hasActiveFilters && (
        <button
          onClick={onClearFilters}
          className={cn(
            'w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg',
            'text-sm font-medium transition-colors',
            'border border-zinc-300 dark:border-zinc-600',
            'hover:bg-zinc-100 dark:hover:bg-zinc-800',
            theme.text.muted
          )}
        >
          <XCircleIcon className="h-4 w-4" />
          Clear All Filters
        </button>
      )}
    </div>
  );
};
