import {
  ChartBarIcon,
  ExclamationTriangleIcon,
  XCircleIcon,
  CheckCircleIcon,
  ClockIcon,
} from '@heroicons/react/24/outline';
import { theme } from '../../theme';
import { cn } from '../../utils/cn';
import { StatCard } from '../common/StatCard';
import { OperationLogStatsSummary } from '../../types/operations';

interface OperationLogStatsProps {
  stats: OperationLogStatsSummary;
}

const statDefinitions = [
  {
    key: 'total_operations' as const,
    label: 'Total Operations',
    icon: ChartBarIcon,
    iconColor: theme.text.strong,
    iconBg: cn(theme.intent.neutral.surface, theme.intent.neutral.border, 'border'),
  },
  {
    key: 'incomplete_operations' as const,
    label: 'Incomplete',
    icon: ExclamationTriangleIcon,
    iconColor: theme.intent.warning.textStrong,
    iconBg: cn(theme.intent.warning.surface, theme.intent.warning.border, 'border'),
  },
  {
    key: 'failed_operations' as const,
    label: 'Failed',
    icon: XCircleIcon,
    iconColor: theme.intent.danger.textStrong,
    iconBg: cn(theme.intent.danger.surface, theme.intent.danger.border, 'border'),
  },
  {
    key: 'successful_operations' as const,
    label: 'Successful',
    icon: CheckCircleIcon,
    iconColor: theme.intent.success.textStrong,
    iconBg: cn(
      theme.intent.success.surfaceSoft ?? theme.intent.success.surface,
      theme.intent.success.border,
      'border'
    ),
  },
  {
    key: 'recent_operations' as const,
    label: 'Last 24h',
    icon: ClockIcon,
    iconColor: theme.intent.info.textStrong,
    iconBg: cn(theme.intent.info.surface, theme.intent.info.border, 'border'),
  },
];

export default function OperationLogStats({ stats }: OperationLogStatsProps) {
  return (
    <div className="mt-8 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-5">
      {statDefinitions.map((definition) => (
        <StatCard
          key={definition.key}
          label={definition.label}
          value={stats[definition.key].toLocaleString()}
          icon={definition.icon}
          iconColor={definition.iconColor}
          iconBg={definition.iconBg}
        />
      ))}
    </div>
  );
}
