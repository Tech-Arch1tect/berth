import {
  ChartBarIcon,
  CheckCircleIcon,
  XCircleIcon,
  ShieldExclamationIcon,
  ExclamationTriangleIcon,
  InformationCircleIcon,
  FunnelIcon,
  UserIcon,
  ServerIcon,
  KeyIcon,
  DocumentTextIcon,
} from '@heroicons/react/24/outline';
import { cn } from '../../../utils/cn';
import { theme } from '../../../theme';
import type { GetApiV1AdminSecurityAuditLogsStats200Data } from '../../../api/generated/models';

interface SecurityAuditLogsSidebarProps {
  stats: GetApiV1AdminSecurityAuditLogsStats200Data | null;
  selectedCategory: string;
  selectedSeverity: string;
  selectedSuccess: string;
  startDate: string;
  endDate: string;
  onCategoryChange: (category: string) => void;
  onSeverityChange: (severity: string) => void;
  onSuccessChange: (success: string) => void;
  onStartDateChange: (date: string) => void;
  onEndDateChange: (date: string) => void;
  onClearFilters: () => void;
  hasActiveFilters: boolean;
}

interface QuickFilterProps {
  label: string;
  count?: number;
  icon: React.ElementType;
  isActive: boolean;
  variant: 'neutral' | 'success' | 'danger' | 'warning' | 'info' | 'critical';
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
  critical: {
    active: 'bg-rose-50 dark:bg-rose-900/20 border-rose-300 dark:border-rose-700',
    inactive: 'hover:bg-rose-50/50 dark:hover:bg-rose-900/10',
    icon: 'text-rose-500 dark:text-rose-400',
    count: 'bg-rose-100 dark:bg-rose-900/30 text-rose-700 dark:text-rose-300',
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

const categoryFilters = [
  { value: 'auth', label: 'Authentication', icon: KeyIcon },
  { value: 'user_mgmt', label: 'User Management', icon: UserIcon },
  { value: 'rbac', label: 'RBAC', icon: ShieldExclamationIcon },
  { value: 'server', label: 'Server', icon: ServerIcon },
  { value: 'file', label: 'File Operations', icon: DocumentTextIcon },
];

const severityFilters = [
  {
    value: 'critical',
    label: 'Critical',
    icon: ShieldExclamationIcon,
    variant: 'critical' as const,
  },
  { value: 'high', label: 'High', icon: ExclamationTriangleIcon, variant: 'danger' as const },
  { value: 'medium', label: 'Medium', icon: ExclamationTriangleIcon, variant: 'warning' as const },
  { value: 'low', label: 'Low', icon: InformationCircleIcon, variant: 'info' as const },
];

export const SecurityAuditLogsSidebar: React.FC<SecurityAuditLogsSidebarProps> = ({
  stats,
  selectedCategory,
  selectedSeverity,
  selectedSuccess,
  startDate,
  endDate,
  onCategoryChange,
  onSeverityChange,
  onSuccessChange,
  onStartDateChange,
  onEndDateChange,
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
              <span className={theme.text.subtle}>Total Events</span>
              <span className={cn('font-semibold tabular-nums', theme.text.strong)}>
                {stats.total_events.toLocaleString()}
              </span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-red-600 dark:text-red-400">Failed Events</span>
              <span className="font-semibold tabular-nums text-red-600 dark:text-red-400">
                {stats.failed_events.toLocaleString()}
              </span>
            </div>
            <div className="pt-2 border-t border-zinc-200 dark:border-zinc-700">
              <div className="flex items-center justify-between text-sm">
                <span className={theme.text.subtle}>Last 24h</span>
                <span className={cn('font-semibold tabular-nums', theme.text.strong)}>
                  {stats.events_last_24_hours.toLocaleString()}
                </span>
              </div>
              <div className="flex items-center justify-between text-sm mt-1">
                <span className={theme.text.subtle}>Last 7 days</span>
                <span className={cn('font-semibold tabular-nums', theme.text.strong)}>
                  {stats.events_last_7_days.toLocaleString()}
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
            label="All Events"
            count={stats?.total_events}
            icon={ChartBarIcon}
            isActive={selectedSuccess === 'all'}
            variant="neutral"
            onClick={() => onSuccessChange('all')}
          />
          <QuickFilter
            label="Successful"
            icon={CheckCircleIcon}
            isActive={selectedSuccess === 'true'}
            variant="success"
            onClick={() => onSuccessChange('true')}
          />
          <QuickFilter
            label="Failed"
            count={stats?.failed_events}
            icon={XCircleIcon}
            isActive={selectedSuccess === 'false'}
            variant="danger"
            onClick={() => onSuccessChange('false')}
          />
        </div>
      </div>

      {/* Severity Filters */}
      <div className="space-y-2">
        <h3 className={cn('text-xs font-semibold uppercase tracking-wider px-1', theme.text.muted)}>
          Severity
        </h3>
        <div className="space-y-1">
          <QuickFilter
            label="All Severities"
            icon={FunnelIcon}
            isActive={selectedSeverity === 'all'}
            variant="neutral"
            onClick={() => onSeverityChange('all')}
          />
          {severityFilters.map((sev) => (
            <QuickFilter
              key={sev.value}
              label={sev.label}
              count={stats?.events_by_severity?.[sev.value]}
              icon={sev.icon}
              isActive={selectedSeverity === sev.value}
              variant={sev.variant}
              onClick={() => onSeverityChange(sev.value)}
            />
          ))}
        </div>
      </div>

      {/* Category Filters */}
      <div className="space-y-2">
        <h3 className={cn('text-xs font-semibold uppercase tracking-wider px-1', theme.text.muted)}>
          Category
        </h3>
        <div className="space-y-1">
          <QuickFilter
            label="All Categories"
            icon={FunnelIcon}
            isActive={selectedCategory === 'all'}
            variant="neutral"
            onClick={() => onCategoryChange('all')}
          />
          {categoryFilters.map((cat) => (
            <QuickFilter
              key={cat.value}
              label={cat.label}
              count={stats?.events_by_category?.[cat.value]}
              icon={cat.icon}
              isActive={selectedCategory === cat.value}
              variant="neutral"
              onClick={() => onCategoryChange(cat.value)}
            />
          ))}
        </div>
      </div>

      {/* Date Range Filter */}
      <div className="space-y-2">
        <h3 className={cn('text-xs font-semibold uppercase tracking-wider px-1', theme.text.muted)}>
          Date Range
        </h3>
        <div className="space-y-3 px-1">
          <div>
            <label className={cn('block text-xs font-medium mb-1', theme.text.muted)}>
              Start Date
            </label>
            <input
              type="datetime-local"
              value={startDate}
              onChange={(e) => onStartDateChange(e.target.value)}
              className={cn(
                'w-full px-2 py-1.5 rounded-lg text-sm',
                'border border-zinc-300 dark:border-zinc-600',
                'bg-white dark:bg-zinc-800',
                'focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent',
                theme.text.standard
              )}
            />
          </div>
          <div>
            <label className={cn('block text-xs font-medium mb-1', theme.text.muted)}>
              End Date
            </label>
            <input
              type="datetime-local"
              value={endDate}
              onChange={(e) => onEndDateChange(e.target.value)}
              className={cn(
                'w-full px-2 py-1.5 rounded-lg text-sm',
                'border border-zinc-300 dark:border-zinc-600',
                'bg-white dark:bg-zinc-800',
                'focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent',
                theme.text.standard
              )}
            />
          </div>
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
