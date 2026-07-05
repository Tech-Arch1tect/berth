import React from 'react';
import {
  DocumentTextIcon,
  ExclamationTriangleIcon,
  FunnelIcon,
  InformationCircleIcon,
  KeyIcon,
  ServerIcon,
  ShieldExclamationIcon,
  UserIcon,
  XCircleIcon,
} from '@heroicons/react/24/outline';
import { cn } from '../../../../../shared/utils/cn';
import { theme } from '../../../../../shared/theme';
import type { StatsResponseData } from '../../../../../api/generated/models';

interface SecurityAuditLogsFiltersProps {
  stats: StatsResponseData | null;
  selectedSeverity: string;
  selectedCategory: string;
  startDate: string;
  endDate: string;
  onSeverityChange: (severity: string) => void;
  onCategoryChange: (category: string) => void;
  onStartDateChange: (date: string) => void;
  onEndDateChange: (date: string) => void;
  onClearFilters: () => void;
  hasActiveFilters: boolean;
}

interface FilterOptionProps {
  label: string;
  icon: React.ElementType;
  isActive: boolean;
  count?: number;
  onClick: () => void;
}

const FilterOption: React.FC<FilterOptionProps> = ({
  label,
  icon: Icon,
  isActive,
  count,
  onClick,
}) => (
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
    {count !== undefined && (
      <span
        className={cn(
          'rounded-full bg-zinc-200 px-2 py-0.5 text-xs font-medium tabular-nums text-zinc-700 dark:bg-zinc-700 dark:text-zinc-300'
        )}
      >
        {count.toLocaleString()}
      </span>
    )}
  </button>
);

const severities = [
  { value: 'critical', label: 'Critical', icon: ShieldExclamationIcon },
  { value: 'high', label: 'High', icon: ExclamationTriangleIcon },
  { value: 'medium', label: 'Medium', icon: ExclamationTriangleIcon },
  { value: 'low', label: 'Low', icon: InformationCircleIcon },
];

const categories = [
  { value: 'auth', label: 'Authentication', icon: KeyIcon },
  { value: 'user_mgmt', label: 'User Management', icon: UserIcon },
  { value: 'rbac', label: 'RBAC', icon: ShieldExclamationIcon },
  { value: 'server', label: 'Server', icon: ServerIcon },
  { value: 'file', label: 'File Operations', icon: DocumentTextIcon },
];

function datetimeLocalValue(msAgo: number) {
  const date = new Date(Date.now() - msAgo);
  date.setSeconds(0, 0);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

const dateInputClasses = cn(
  'w-full min-h-[44px] rounded-lg px-2 py-1.5 text-sm',
  'border border-zinc-300 dark:border-zinc-600',
  'bg-white dark:bg-zinc-800',
  'focus:border-transparent focus:outline-none focus:ring-2 focus:ring-teal-500'
);

export const SecurityAuditLogsFilters: React.FC<SecurityAuditLogsFiltersProps> = ({
  stats,
  selectedSeverity,
  selectedCategory,
  startDate,
  endDate,
  onSeverityChange,
  onCategoryChange,
  onStartDateChange,
  onEndDateChange,
  onClearFilters,
  hasActiveFilters,
}) => {
  const applyPreset = (msAgo: number) => {
    onStartDateChange(datetimeLocalValue(msAgo));
    onEndDateChange('');
  };

  return (
    <div className="space-y-6 p-3">
      <div className="space-y-2">
        <h3 className={cn('px-1 text-xs font-semibold uppercase tracking-wider', theme.text.muted)}>
          Severity
        </h3>
        <div className="space-y-1">
          <FilterOption
            label="All severities"
            icon={FunnelIcon}
            isActive={selectedSeverity === 'all'}
            onClick={() => onSeverityChange('all')}
          />
          {severities.map((severity) => (
            <FilterOption
              key={severity.value}
              label={severity.label}
              icon={severity.icon}
              count={stats?.events_by_severity?.[severity.value]}
              isActive={selectedSeverity === severity.value}
              onClick={() => onSeverityChange(severity.value)}
            />
          ))}
        </div>
      </div>

      <div className="space-y-2">
        <h3 className={cn('px-1 text-xs font-semibold uppercase tracking-wider', theme.text.muted)}>
          Category
        </h3>
        <div className="space-y-1">
          <FilterOption
            label="All categories"
            icon={FunnelIcon}
            isActive={selectedCategory === 'all'}
            onClick={() => onCategoryChange('all')}
          />
          {categories.map((category) => (
            <FilterOption
              key={category.value}
              label={category.label}
              icon={category.icon}
              count={stats?.events_by_category?.[category.value]}
              isActive={selectedCategory === category.value}
              onClick={() => onCategoryChange(category.value)}
            />
          ))}
        </div>
      </div>

      <div className="space-y-2">
        <h3 className={cn('px-1 text-xs font-semibold uppercase tracking-wider', theme.text.muted)}>
          Date range
        </h3>
        <div className="space-y-3 px-1">
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => applyPreset(24 * 60 * 60 * 1000)}
              className={cn(
                'min-h-[44px] flex-1 rounded-lg border px-2 text-xs font-medium transition-colors',
                'border-zinc-300 hover:bg-zinc-100 dark:border-zinc-600 dark:hover:bg-zinc-800',
                theme.text.standard
              )}
            >
              Last 24 hours
              {stats && (
                <span className={cn('ml-1 tabular-nums', theme.text.subtle)}>
                  ({stats.events_last_24_hours.toLocaleString()})
                </span>
              )}
            </button>
            <button
              type="button"
              onClick={() => applyPreset(7 * 24 * 60 * 60 * 1000)}
              className={cn(
                'min-h-[44px] flex-1 rounded-lg border px-2 text-xs font-medium transition-colors',
                'border-zinc-300 hover:bg-zinc-100 dark:border-zinc-600 dark:hover:bg-zinc-800',
                theme.text.standard
              )}
            >
              Last 7 days
              {stats && (
                <span className={cn('ml-1 tabular-nums', theme.text.subtle)}>
                  ({stats.events_last_7_days.toLocaleString()})
                </span>
              )}
            </button>
          </div>
          <div>
            <label className={cn('mb-1 block text-xs font-medium', theme.text.muted)}>
              From
              <input
                type="datetime-local"
                value={startDate}
                onChange={(e) => onStartDateChange(e.target.value)}
                className={cn(dateInputClasses, 'mt-1', theme.text.standard)}
              />
            </label>
          </div>
          <div>
            <label className={cn('mb-1 block text-xs font-medium', theme.text.muted)}>
              To
              <input
                type="datetime-local"
                value={endDate}
                onChange={(e) => onEndDateChange(e.target.value)}
                className={cn(dateInputClasses, 'mt-1', theme.text.standard)}
              />
            </label>
          </div>
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
};
