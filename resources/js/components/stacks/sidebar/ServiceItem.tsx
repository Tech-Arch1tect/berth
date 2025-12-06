import React from 'react';
import { cn } from '../../../utils/cn';
import { ComposeService } from '../../../types/stack';

interface ServiceItemProps {
  service: ComposeService;
  isSelected: boolean;
  onSelect: () => void;
}

const getServiceStatus = (
  service: ComposeService
): 'running' | 'partial' | 'stopped' | 'unknown' => {
  if (!service.containers || service.containers.length === 0) {
    return 'stopped';
  }

  const runningCount = service.containers.filter((c) => c.state === 'running').length;
  const totalCount = service.containers.length;

  if (runningCount === totalCount) return 'running';
  if (runningCount > 0) return 'partial';
  return 'stopped';
};

const statusColors: Record<string, string> = {
  running: 'bg-emerald-500',
  partial: 'bg-amber-500',
  stopped: 'bg-zinc-400 dark:bg-zinc-500',
  unknown: 'bg-zinc-300 dark:bg-zinc-600',
};

export const ServiceItem: React.FC<ServiceItemProps> = ({ service, isSelected, onSelect }) => {
  const status = getServiceStatus(service);
  const containerCount = service.containers?.length || 0;

  return (
    <button
      onClick={onSelect}
      className={cn(
        'w-full flex items-center gap-2 px-3 py-1.5 text-left',
        'hover:bg-zinc-100 dark:hover:bg-zinc-800',
        'transition-colors',
        isSelected && 'bg-teal-50 dark:bg-teal-900/30 text-teal-700 dark:text-teal-300'
      )}
    >
      <span className={cn('w-2 h-2 rounded-full flex-shrink-0', statusColors[status])} />
      <span className="flex-1 text-sm truncate">{service.name}</span>
      {containerCount > 0 && (
        <span className="text-xs text-zinc-400 dark:text-zinc-500 tabular-nums">
          {containerCount}
        </span>
      )}
    </button>
  );
};
