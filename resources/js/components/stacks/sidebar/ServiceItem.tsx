import React from 'react';
import { cn } from '../../../utils/cn';
import type { ComposeService } from '../../../api/generated/models';
import { getServiceHealthStatus } from '../../../utils/statusHelpers';
import { InformationCircleIcon } from '@heroicons/react/24/outline';

interface ServiceItemProps {
  service: ComposeService;
  isSelected: boolean;
  onSelect: () => void;
}

const getServiceDisplayStatus = (
  healthInfo: ReturnType<typeof getServiceHealthStatus>
): 'running' | 'partial' | 'stopped' | 'unhealthy' | 'unknown' => {
  switch (healthInfo.status) {
    case 'error':
      return 'unhealthy';
    case 'no-containers':
    case 'not-created':
      return 'unknown';
    default:
      return healthInfo.status as 'running' | 'partial' | 'stopped';
  }
};

const statusColors: Record<string, string> = {
  running: 'bg-emerald-500',
  partial: 'bg-amber-500',
  stopped: 'bg-zinc-400 dark:bg-zinc-500',
  unhealthy: 'bg-red-500',
  unknown: 'bg-zinc-300 dark:bg-zinc-600',
};

export const ServiceItem: React.FC<ServiceItemProps> = ({ service, isSelected, onSelect }) => {
  const status = getServiceHealthStatus(service);
  const displayStatus = getServiceDisplayStatus(status);
  const containerCount = service.containers?.length || 0;
  const statusColor = statusColors[displayStatus];

  const showReason = status.status !== 'running' && status.status !== 'no-containers';

  return (
    <button
      onClick={onSelect}
      className={cn(
        'w-full flex items-center gap-2 px-3 py-1.5 text-left',
        'hover:bg-zinc-100 dark:hover:bg-zinc-800',
        'transition-colors',
        isSelected && 'bg-teal-50 dark:bg-teal-900/30 text-teal-700 dark:text-teal-300'
      )}
      title={showReason ? `${status.label}: ${status.reason}` : undefined}
    >
      <span className={cn('w-2 h-2 rounded-full flex-shrink-0', statusColor)} />
      <span className="flex-1 text-sm truncate">{service.name}</span>
      {showReason && <InformationCircleIcon className="w-3.5 h-3.5 text-amber-500 flex-shrink-0" />}
      {containerCount > 0 && (
        <span className="text-xs text-zinc-400 dark:text-zinc-500 tabular-nums">
          {containerCount}
        </span>
      )}
    </button>
  );
};
