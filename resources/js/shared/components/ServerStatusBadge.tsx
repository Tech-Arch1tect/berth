import React from 'react';
import { cn } from '../utils/cn';
import {
  ServerStatus,
  SERVER_STATUS_BADGE,
  SERVER_STATUS_DOT,
  SERVER_STATUS_LABEL,
  SERVER_STATUS_PULSE,
} from '../utils/serverStatus';

interface ServerStatusDotProps {
  status: ServerStatus;
  className?: string;
}

export const ServerStatusDot: React.FC<ServerStatusDotProps> = ({ status, className }) => (
  <span
    className={cn(
      'w-2 h-2 rounded-full flex-shrink-0',
      SERVER_STATUS_DOT[status],
      SERVER_STATUS_PULSE[status] && 'animate-pulse',
      className
    )}
  />
);

interface ServerStatusBadgeProps {
  status: ServerStatus;
  className?: string;
}

export const ServerStatusBadge: React.FC<ServerStatusBadgeProps> = ({ status, className }) => (
  <span
    className={cn(
      'inline-flex items-center gap-1.5 px-2 py-0.5 text-xs font-medium rounded-full',
      SERVER_STATUS_BADGE[status],
      className
    )}
  >
    <ServerStatusDot status={status} />
    {SERVER_STATUS_LABEL[status]}
  </span>
);
