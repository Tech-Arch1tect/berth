import {
  ArrowPathIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon,
  XCircleIcon,
} from '@heroicons/react/24/outline';
import { cn } from '../../../shared/utils/cn';

interface BackupStatusBadgeProps {
  status: string;
}

const PRESENTATION: Record<
  string,
  { label: string; className: string; icon: typeof CheckCircleIcon }
> = {
  completed: {
    label: 'Completed',
    className: 'text-emerald-700 dark:text-emerald-400',
    icon: CheckCircleIcon,
  },
  failed: {
    label: 'Failed',
    className: 'text-red-700 dark:text-red-400',
    icon: XCircleIcon,
  },
  interrupted: {
    label: 'Interrupted',
    className: 'text-amber-700 dark:text-amber-400',
    icon: ExclamationTriangleIcon,
  },
  running: {
    label: 'Running',
    className: 'text-sky-700 dark:text-sky-400',
    icon: ArrowPathIcon,
  },
};

export function BackupStatusBadge({ status }: BackupStatusBadgeProps) {
  const presentation = PRESENTATION[status] ?? {
    label: status,
    className: 'text-zinc-600 dark:text-zinc-400',
    icon: ExclamationTriangleIcon,
  };
  const Icon = presentation.icon;
  return (
    <span
      className={cn('inline-flex items-center gap-1 text-sm font-medium', presentation.className)}
    >
      <Icon className={cn('w-4 h-4', status === 'running' && 'animate-spin')} aria-hidden />
      {presentation.label}
    </span>
  );
}
