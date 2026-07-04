import type { FC } from 'react';
import { ArrowUpCircleIcon, ExclamationTriangleIcon } from '@heroicons/react/24/outline';
import { formatDistanceToNow } from 'date-fns';
import { cn } from '../../../shared/utils/cn';
import { theme } from '../../../shared/theme';
import type { ImageUpdate } from '../../../api/generated/models';

interface ImageUpdateBannerProps {
  updates: ImageUpdate[];
  lastChecked: string | null;
  onViewDetails?: () => void;
  className?: string;
}

function describeServices(names: string[]): string {
  if (names.length === 1) return `Image update available for ${names[0]}`;
  if (names.length <= 3) {
    const last = names[names.length - 1];
    return `Image updates available for ${names.slice(0, -1).join(', ')} and ${last}`;
  }
  return `Image updates available for ${names.length} services`;
}

export const ImageUpdateBanner: FC<ImageUpdateBannerProps> = ({
  updates,
  lastChecked,
  onViewDetails,
  className,
}) => {
  const available = updates.filter((u) => !u.check_error && u.update_available);
  const failedChecks = updates.filter((u) => u.check_error).length;

  if (available.length === 0 && failedChecks === 0) return null;

  const serviceNames = [...new Set(available.map((u) => u.container_name))];
  const checkedAgo = lastChecked
    ? formatDistanceToNow(new Date(lastChecked), { addSuffix: true })
    : null;

  return (
    <div className={className}>
      {available.length > 0 && (
        <div
          className={cn(
            'flex flex-wrap items-center gap-x-3 gap-y-1 border-b px-4 py-2',
            theme.intent.info.border,
            theme.intent.info.surface
          )}
        >
          <ArrowUpCircleIcon
            className={cn('h-5 w-5 flex-shrink-0', theme.intent.info.textStrong)}
          />
          <p className={cn('min-w-0 flex-1 text-sm', theme.intent.info.textStrong)}>
            {describeServices(serviceNames)}
            {checkedAgo && (
              <span className={cn('ml-2 text-xs', theme.intent.info.textMuted)}>
                checked {checkedAgo}
              </span>
            )}
          </p>
          {onViewDetails && (
            <button
              type="button"
              onClick={onViewDetails}
              className={cn(
                'min-h-[36px] flex-shrink-0 rounded-lg px-3 text-xs font-semibold',
                theme.intent.info.textStrong,
                'hover:bg-black/5 dark:hover:bg-white/10'
              )}
            >
              View
            </button>
          )}
        </div>
      )}

      {failedChecks > 0 && (
        <div
          className={cn(
            'flex flex-wrap items-center gap-x-3 gap-y-1 border-b px-4 py-2',
            theme.intent.warning.border,
            theme.intent.warning.surface
          )}
        >
          <ExclamationTriangleIcon
            className={cn('h-5 w-5 flex-shrink-0', theme.intent.warning.textStrong)}
          />
          <p className={cn('min-w-0 flex-1 text-sm', theme.intent.warning.textStrong)}>
            {failedChecks} image update check{failedChecks !== 1 ? 's' : ''} failed
          </p>
          {onViewDetails && (
            <button
              type="button"
              onClick={onViewDetails}
              className={cn(
                'min-h-[36px] flex-shrink-0 rounded-lg px-3 text-xs font-semibold',
                theme.intent.warning.textStrong,
                'hover:bg-black/5 dark:hover:bg-white/10'
              )}
            >
              View
            </button>
          )}
        </div>
      )}
    </div>
  );
};
