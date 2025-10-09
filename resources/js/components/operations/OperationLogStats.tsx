import { theme } from '../../theme';
import { cn } from '../../utils/cn';
import { OperationLogStatsSummary } from '../../types/operations';

interface OperationLogStatsProps {
  stats: OperationLogStatsSummary;
}

const statDefinitions = [
  {
    key: 'total_operations' as const,
    label: 'Total Operations',
    accent: theme.text.strong,
    icon: '📊',
  },
  {
    key: 'incomplete_operations' as const,
    label: 'Incomplete',
    accent: theme.text.warning,
    icon: '⚠️',
  },
  {
    key: 'failed_operations' as const,
    label: 'Failed',
    accent: theme.text.danger,
    icon: '❌',
  },
  {
    key: 'successful_operations' as const,
    label: 'Successful',
    accent: theme.text.success,
    icon: '✅',
  },
  {
    key: 'recent_operations' as const,
    label: 'Last 24h',
    accent: theme.text.info,
    icon: '🕐',
  },
];

export default function OperationLogStats({ stats }: OperationLogStatsProps) {
  return (
    <div className="mt-8 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-5">
      {statDefinitions.map((definition) => (
        <div key={definition.key} className={theme.containers.inset}>
          <div className="flex items-center gap-4">
            <div className="text-2xl" aria-hidden>
              {definition.icon}
            </div>
            <dl className="min-w-0 flex-1">
              <dt className={cn('truncate text-sm font-medium', theme.text.subtle)}>
                {definition.label}
              </dt>
              <dd className={cn('text-lg font-semibold', definition.accent)}>
                {stats[definition.key].toLocaleString()}
              </dd>
            </dl>
          </div>
        </div>
      ))}
    </div>
  );
}
