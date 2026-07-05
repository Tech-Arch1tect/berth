import {
  CheckCircleIcon,
  ClockIcon,
  CpuChipIcon,
  ExclamationTriangleIcon,
  UserIcon,
  XCircleIcon,
} from '@heroicons/react/24/outline';
import { cn } from '../../../shared/utils/cn';
import type { OperationLogInfo } from '../../../api/generated/models';

const badgeBase = 'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium';

export const TriggerBadge: React.FC<{ triggerSource: string }> = ({ triggerSource }) => {
  if (triggerSource === 'scheduled' || triggerSource === 'cron') {
    return (
      <span
        className={cn(
          badgeBase,
          'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300'
        )}
      >
        <ClockIcon className="h-3 w-3" />
        Scheduled
      </span>
    );
  }

  if (triggerSource === 'api') {
    return (
      <span
        className={cn(
          badgeBase,
          'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300'
        )}
      >
        <CpuChipIcon className="h-3 w-3" />
        API
      </span>
    );
  }

  return (
    <span
      className={cn(badgeBase, 'bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400')}
    >
      <UserIcon className="h-3 w-3" />
      Manual
    </span>
  );
};

export const StatusBadge: React.FC<{ log: OperationLogInfo }> = ({ log }) => {
  if (log.is_incomplete) {
    return (
      <span
        className={cn(
          badgeBase,
          'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300'
        )}
      >
        <ExclamationTriangleIcon className="h-3 w-3" />
        Incomplete
      </span>
    );
  }
  if (log.success === true) {
    return (
      <span
        className={cn(
          badgeBase,
          'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300'
        )}
      >
        <CheckCircleIcon className="h-3 w-3" />
        Success
      </span>
    );
  }
  if (log.success === false) {
    return (
      <span
        className={cn(badgeBase, 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300')}
      >
        <XCircleIcon className="h-3 w-3" />
        Failed
      </span>
    );
  }
  return (
    <span
      className={cn(badgeBase, 'bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400')}
    >
      Unknown
    </span>
  );
};
