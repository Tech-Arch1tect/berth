import {
  ChartBarIcon,
  ServerIcon,
  ShieldCheckIcon,
  ExclamationTriangleIcon,
  CheckCircleIcon,
} from '@heroicons/react/24/outline';
import { cn } from '../../utils/cn';
import { theme } from '../../theme';
import { HealthSummary, DashboardStat } from './types/dashboard';

interface DashboardStatsProps {
  healthSummary: HealthSummary;
  userRoles: string[];
}

const intentStyles: Record<
  DashboardStat['color'],
  { iconWrap: string; icon: string; accentText: string }
> = {
  info: {
    iconWrap: cn(
      'flex-shrink-0 rounded-xl border p-3',
      theme.intent.info.border,
      theme.intent.info.surface
    ),
    icon: theme.intent.info.textStrong,
    accentText: theme.intent.info.textMuted,
  },
  success: {
    iconWrap: cn(
      'flex-shrink-0 rounded-xl border p-3',
      theme.intent.success.border,
      theme.intent.success.surfaceSoft ?? theme.intent.success.surface
    ),
    icon: theme.intent.success.textStrong,
    accentText: theme.intent.success.textMuted,
  },
  warning: {
    iconWrap: cn(
      'flex-shrink-0 rounded-xl border p-3',
      theme.intent.warning.border,
      theme.intent.warning.surface
    ),
    icon: theme.intent.warning.textStrong,
    accentText: theme.intent.warning.textMuted,
  },
  danger: {
    iconWrap: cn(
      'flex-shrink-0 rounded-xl border p-3',
      theme.intent.danger.border,
      theme.intent.danger.surface
    ),
    icon: theme.intent.danger.textStrong,
    accentText: theme.intent.danger.textMuted,
  },
  neutral: {
    iconWrap: cn(
      'flex-shrink-0 rounded-xl border p-3',
      theme.intent.neutral.border,
      theme.intent.neutral.surface
    ),
    icon: theme.intent.neutral.textStrong,
    accentText: theme.intent.neutral.textMuted,
  },
};

const trendBorder: Record<DashboardStat['trend'], string> = {
  good: theme.intent.success.border,
  warning: theme.intent.warning.border,
  neutral: theme.intent.neutral.border,
};

export const DashboardStats = ({ healthSummary, userRoles }: DashboardStatsProps) => {
  const getAccessLevel = () => {
    const isAdmin = userRoles.includes('admin');
    if (isAdmin) return 'Full';
    if (userRoles.length === 0) return 'Limited';
    return userRoles.join(', ');
  };

  const stats: DashboardStat[] = [
    {
      name: 'Health Problems',
      value: healthSummary.unhealthyStacks.toString(),
      subtitle: healthSummary.unhealthyStacks > 0 ? 'stacks need attention' : 'all stacks healthy',
      icon: healthSummary.unhealthyStacks > 0 ? ExclamationTriangleIcon : CheckCircleIcon,
      color: healthSummary.unhealthyStacks > 0 ? 'danger' : 'success',
      trend: healthSummary.unhealthyStacks > 0 ? 'warning' : 'good',
    },
    {
      name: 'Stack Health',
      value: `${healthSummary.healthyStacks}/${healthSummary.totalStacks}`,
      subtitle: 'healthy stacks',
      icon: ChartBarIcon,
      color: healthSummary.healthyStacks === healthSummary.totalStacks ? 'success' : 'warning',
      trend: healthSummary.healthyStacks === healthSummary.totalStacks ? 'good' : 'warning',
    },
    {
      name: 'Server Status',
      value: `${healthSummary.serversOnline}/${healthSummary.totalActiveServers}`,
      subtitle:
        healthSummary.totalOfflineServers > 0
          ? `${healthSummary.totalOfflineServers} offline or unreachable`
          : healthSummary.serversLoading > 0
            ? 'checking connectivity...'
            : 'all reachable',
      icon: ServerIcon,
      color:
        healthSummary.totalOfflineServers > 0
          ? 'danger'
          : healthSummary.serversLoading > 0
            ? 'warning'
            : 'success',
      trend: healthSummary.totalOfflineServers > 0 ? 'warning' : 'good',
    },
    {
      name: 'Your Access',
      value: getAccessLevel(),
      subtitle: `${userRoles.length} role${userRoles.length !== 1 ? 's' : ''}`,
      icon: ShieldCheckIcon,
      color: 'info',
      trend: 'neutral',
    },
  ];

  return (
    <div className="mb-8 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
      {stats.map((stat) => {
        const Icon = stat.icon;
        const styles = intentStyles[stat.color];

        return (
          <div
            key={stat.name}
            className={cn(
              theme.cards.shell,
              theme.cards.translucent,
              theme.cards.padded,
              theme.cards.interactive,
              trendBorder[stat.trend]
            )}
          >
            <div className="flex items-center justify-between">
              <div className="min-w-0 flex-1">
                <p className={cn('text-sm font-medium', theme.text.muted)}>{stat.name}</p>
                <p className={cn('mt-1 text-2xl font-bold', theme.text.strong)}>{stat.value}</p>
                {stat.subtitle && (
                  <p className={cn('mt-1 text-xs', styles.accentText)}>{stat.subtitle}</p>
                )}
              </div>
              <div className={styles.iconWrap}>
                <Icon className={cn('h-6 w-6', styles.icon)} />
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
};
