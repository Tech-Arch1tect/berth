import {
  ChartBarIcon,
  ServerIcon,
  ShieldCheckIcon,
  ExclamationTriangleIcon,
  CheckCircleIcon,
} from '@heroicons/react/24/outline';
import { cn } from '../../utils/cn';
import { theme } from '../../theme';
import { StatCard } from '../common/StatCard';
import { HealthSummary, DashboardStat } from './types/dashboard';

interface DashboardStatsProps {
  healthSummary: HealthSummary;
  userRoles: string[];
}

const colorToIconStyles: Record<DashboardStat['color'], { iconColor: string; iconBg: string }> = {
  info: {
    iconColor: theme.intent.info.textStrong,
    iconBg: cn(theme.intent.info.surface, theme.intent.info.border, 'border'),
  },
  success: {
    iconColor: theme.intent.success.textStrong,
    iconBg: cn(
      theme.intent.success.surfaceSoft ?? theme.intent.success.surface,
      theme.intent.success.border,
      'border'
    ),
  },
  warning: {
    iconColor: theme.intent.warning.textStrong,
    iconBg: cn(theme.intent.warning.surface, theme.intent.warning.border, 'border'),
  },
  danger: {
    iconColor: theme.intent.danger.textStrong,
    iconBg: cn(theme.intent.danger.surface, theme.intent.danger.border, 'border'),
  },
  neutral: {
    iconColor: theme.intent.neutral.textStrong,
    iconBg: cn(theme.intent.neutral.surface, theme.intent.neutral.border, 'border'),
  },
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
    <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
      {stats.map((stat) => {
        const iconStyles = colorToIconStyles[stat.color];

        return (
          <StatCard
            key={stat.name}
            label={stat.name}
            value={stat.value}
            icon={stat.icon}
            iconColor={iconStyles.iconColor}
            iconBg={iconStyles.iconBg}
            subtext={stat.subtitle}
          />
        );
      })}
    </div>
  );
};
