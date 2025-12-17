import {
  CircleStackIcon,
  ServerIcon,
  ExclamationTriangleIcon,
  CheckCircleIcon,
} from '@heroicons/react/24/outline';
import { cn } from '../../../utils/cn';
import { theme } from '../../../theme';

interface CompactStatisticsProps {
  statistics: {
    total: number;
    healthy: number;
    unhealthy: number;
    running: number;
    totalContainers: number;
  };
}

export const CompactStatistics: React.FC<CompactStatisticsProps> = ({ statistics }) => {
  const stats = [
    {
      label: 'Total',
      value: statistics.total,
      icon: CircleStackIcon,
      iconColor: theme.text.info,
      iconBg: theme.intent.info.surface,
    },
    {
      label: 'Healthy',
      value: statistics.healthy,
      icon: CheckCircleIcon,
      iconColor: theme.text.success,
      iconBg: theme.intent.success.surface,
    },
    {
      label: 'Unhealthy',
      value: statistics.unhealthy,
      icon: ExclamationTriangleIcon,
      iconColor: theme.text.danger,
      iconBg: theme.intent.danger.surface,
    },
    {
      label: 'Containers',
      value: `${statistics.running}/${statistics.totalContainers}`,
      icon: ServerIcon,
      iconColor: theme.text.info,
      iconBg: theme.intent.info.surface,
    },
  ];

  return (
    <div
      className={cn(
        'flex flex-wrap items-center gap-4 px-4 py-3 mb-4 rounded-xl',
        theme.surface.panel,
        'border border-zinc-200 dark:border-zinc-800'
      )}
    >
      {stats.map((stat, index) => {
        const Icon = stat.icon;
        return (
          <div key={index} className="flex items-center gap-2">
            <div className={cn('w-8 h-8 rounded-lg flex items-center justify-center', stat.iconBg)}>
              <Icon className={cn('w-4 h-4', stat.iconColor)} />
            </div>
            <div>
              <div className={cn('text-xs font-medium', theme.text.subtle)}>{stat.label}</div>
              <div className={cn('text-lg font-bold tabular-nums', theme.text.strong)}>
                {stat.value}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
};
