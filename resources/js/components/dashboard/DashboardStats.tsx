import {
  ChartBarIcon,
  ServerIcon,
  ShieldCheckIcon,
  ExclamationTriangleIcon,
  CheckCircleIcon,
} from '@heroicons/react/24/outline';
import { HealthSummary, DashboardStat } from './types/dashboard';

interface DashboardStatsProps {
  healthSummary: HealthSummary;
  userRoles: string[];
}

export const DashboardStats: React.FC<DashboardStatsProps> = ({ healthSummary, userRoles }) => {
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
      color: healthSummary.unhealthyStacks > 0 ? 'red' : 'green',
      trend: healthSummary.unhealthyStacks > 0 ? 'warning' : 'good',
    },
    {
      name: 'Stack Health',
      value: `${healthSummary.healthyStacks}/${healthSummary.totalStacks}`,
      subtitle: 'healthy stacks',
      icon: ChartBarIcon,
      color: healthSummary.healthyStacks === healthSummary.totalStacks ? 'green' : 'amber',
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
          ? 'red'
          : healthSummary.serversLoading > 0
            ? 'amber'
            : 'green',
      trend: healthSummary.totalOfflineServers > 0 ? 'warning' : 'good',
    },
    {
      name: 'Your Access',
      value: getAccessLevel(),
      subtitle: `${userRoles.length} role${userRoles.length !== 1 ? 's' : ''}`,
      icon: ShieldCheckIcon,
      color: 'blue',
      trend: 'neutral',
    },
  ];

  const getColorClasses = (color: DashboardStat['color']) => {
    const colorMap = {
      blue: 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-200/20 dark:border-blue-800/20',
      green:
        'bg-green-500/10 text-green-600 dark:text-green-400 border-green-200/20 dark:border-green-800/20',
      amber:
        'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-200/20 dark:border-amber-800/20',
      red: 'bg-red-500/10 text-red-600 dark:text-red-400 border-red-200/20 dark:border-red-800/20',
      emerald:
        'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-200/20 dark:border-emerald-800/20',
    };
    return colorMap[color];
  };

  const getCardBorderClass = (trend: DashboardStat['trend']) => {
    switch (trend) {
      case 'warning':
        return 'border-amber-200/30 dark:border-amber-800/30';
      case 'good':
        return 'border-green-200/30 dark:border-green-800/30';
      default:
        return 'border-slate-200/50 dark:border-slate-700/50';
    }
  };

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
      {stats.map((stat) => {
        const Icon = stat.icon;
        const colorClasses = getColorClasses(stat.color);
        const cardBorderClass = getCardBorderClass(stat.trend);

        return (
          <div
            key={stat.name}
            className={`bg-white/70 dark:bg-slate-800/70 backdrop-blur-sm rounded-2xl border ${cardBorderClass} p-6 hover:shadow-lg hover:shadow-slate-200/50 dark:hover:shadow-slate-900/20 transition-all duration-200`}
          >
            <div className="flex items-center justify-between">
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-slate-600 dark:text-slate-400">
                  {stat.name}
                </p>
                <p className="text-2xl font-bold text-slate-900 dark:text-white mt-1">
                  {stat.value}
                </p>
                {stat.subtitle && (
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">{stat.subtitle}</p>
                )}
              </div>
              <div className={`p-3 rounded-xl border ${colorClasses} flex-shrink-0`}>
                <Icon className="w-6 h-6" />
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
};
