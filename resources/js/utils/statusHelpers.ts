import { cn } from './cn';
import { theme } from '../theme';
import type { Container, ComposeService } from '../types/stack';
import type { ComponentType, SVGProps } from 'react';
import {
  CheckCircleIcon,
  XCircleIcon,
  StopIcon,
  PauseCircleIcon,
  ExclamationTriangleIcon,
  ClockIcon,
  ArrowPathIcon,
} from '@heroicons/react/24/solid';

export type ContainerState =
  | 'running'
  | 'exited'
  | 'stopped'
  | 'created'
  | 'paused'
  | 'restarting'
  | 'removing'
  | 'dead'
  | 'not created'
  | 'unknown';

export type ContainerDisplayStatus =
  | 'running'
  | 'stopped'
  | 'error'
  | 'paused'
  | 'restarting'
  | 'not-created'
  | 'unknown';

export interface ContainerStatusInfo {
  status: ContainerDisplayStatus;
  icon: ComponentType<SVGProps<SVGSVGElement>>;
  color: string;
  bg: string;
  label: string;
}

export const getContainerStatus = (container: Container): ContainerStatusInfo => {
  const state = container.state?.toLowerCase() || 'unknown';

  switch (state) {
    case 'running':
      return {
        status: 'running',
        icon: CheckCircleIcon,
        color: 'text-emerald-500',
        bg: 'bg-emerald-50 dark:bg-emerald-900/20',
        label: 'Running',
      };

    case 'stopped':
    case 'exited':
      if (container.exit_code === 0) {
        return {
          status: 'stopped',
          icon: StopIcon,
          color: 'text-zinc-500',
          bg: 'bg-zinc-50 dark:bg-zinc-800',
          label: 'Stopped',
        };
      }
      return {
        status: 'error',
        icon: XCircleIcon,
        color: 'text-red-500',
        bg: 'bg-red-50 dark:bg-red-900/20',
        label: `Error (${container.exit_code})`,
      };

    case 'paused':
      return {
        status: 'paused',
        icon: PauseCircleIcon,
        color: 'text-amber-500',
        bg: 'bg-amber-50 dark:bg-amber-900/20',
        label: 'Paused',
      };

    case 'restarting':
      return {
        status: 'restarting',
        icon: ArrowPathIcon,
        color: 'text-blue-500',
        bg: 'bg-blue-50 dark:bg-blue-900/20',
        label: 'Restarting',
      };

    case 'not created':
      return {
        status: 'not-created',
        icon: XCircleIcon,
        color: 'text-zinc-400',
        bg: 'bg-zinc-100 dark:bg-zinc-800',
        label: 'Not Created',
      };

    case 'created':
      return {
        status: 'stopped',
        icon: ClockIcon,
        color: 'text-zinc-500',
        bg: 'bg-zinc-50 dark:bg-zinc-800',
        label: 'Created',
      };

    case 'removing':
    case 'dead':
    default:
      return {
        status: 'unknown',
        icon: ExclamationTriangleIcon,
        color: 'text-zinc-400',
        bg: 'bg-zinc-50 dark:bg-zinc-800',
        label: state.charAt(0).toUpperCase() + state.slice(1),
      };
  }
};

export type ServiceDisplayStatus =
  | 'running'
  | 'stopped'
  | 'error'
  | 'partial'
  | 'not-created'
  | 'no-containers';

export interface ServiceStatusInfo {
  status: ServiceDisplayStatus;
  icon: ComponentType<SVGProps<SVGSVGElement>>;
  color: string;
  bg: string;
  label: string;
}

export interface ContainerCounts {
  total: number;
  running: number;
  stopped: number;
  error: number;
  notCreated: number;
  other: number;
}

export const getContainerCounts = (containers: Container[]): ContainerCounts => {
  const counts: ContainerCounts = {
    total: containers.length,
    running: 0,
    stopped: 0,
    error: 0,
    notCreated: 0,
    other: 0,
  };

  for (const container of containers) {
    const state = container.state?.toLowerCase() || 'unknown';

    switch (state) {
      case 'running':
        counts.running++;
        break;
      case 'stopped':
      case 'exited':
        if (container.exit_code === 0) {
          counts.stopped++;
        } else {
          counts.error++;
        }
        break;
      case 'not created':
        counts.notCreated++;
        break;
      default:
        counts.other++;
        break;
    }
  }

  return counts;
};

export const getServiceStatus = (service: ComposeService): ServiceStatusInfo => {
  const containers = service.containers || [];

  if (containers.length === 0) {
    return {
      status: 'no-containers',
      icon: XCircleIcon,
      color: 'text-zinc-400',
      bg: 'bg-zinc-100 dark:bg-zinc-800',
      label: 'No Containers',
    };
  }

  const counts = getContainerCounts(containers);

  if (counts.running === counts.total) {
    return {
      status: 'running',
      icon: CheckCircleIcon,
      color: 'text-emerald-500',
      bg: 'bg-emerald-100 dark:bg-emerald-900/30',
      label: 'Running',
    };
  }

  if (counts.notCreated === counts.total) {
    return {
      status: 'not-created',
      icon: XCircleIcon,
      color: 'text-zinc-400',
      bg: 'bg-zinc-100 dark:bg-zinc-800',
      label: 'Not Created',
    };
  }

  if (counts.error > 0) {
    return {
      status: 'error',
      icon: ExclamationTriangleIcon,
      color: 'text-red-500',
      bg: 'bg-red-100 dark:bg-red-900/30',
      label: 'Error',
    };
  }

  if (counts.running === 0 && counts.stopped > 0 && counts.notCreated === 0) {
    return {
      status: 'stopped',
      icon: StopIcon,
      color: 'text-zinc-500',
      bg: 'bg-zinc-100 dark:bg-zinc-800',
      label: 'Stopped',
    };
  }

  return {
    status: 'partial',
    icon: PauseCircleIcon,
    color: 'text-amber-500',
    bg: 'bg-amber-100 dark:bg-amber-900/30',
    label: 'Partial',
  };
};

export type ActionState =
  | 'no-containers'
  | 'all-running'
  | 'all-stopped'
  | 'all-not-created'
  | 'mixed-running'
  | 'mixed-not-created'
  | 'other';

export const getServiceActionState = (service: ComposeService): ActionState => {
  const containers = service.containers ?? [];

  if (containers.length === 0) {
    return 'no-containers';
  }

  const total = containers.length;
  const running = containers.filter((c) => c.state?.toLowerCase() === 'running').length;
  const stopped = containers.filter((c) =>
    ['stopped', 'exited'].includes(c.state?.toLowerCase() ?? '')
  ).length;
  const notCreated = containers.filter((c) => c.state?.toLowerCase() === 'not created').length;

  if (running === total) return 'all-running';
  if (stopped === total) return 'all-stopped';
  if (notCreated === total) return 'all-not-created';
  if (running > 0) return 'mixed-running';
  if (notCreated > 0) return 'mixed-not-created';
  return 'other';
};

export const getStackActionState = (services: ComposeService[]): ActionState => {
  if (!services || services.length === 0) {
    return 'no-containers';
  }

  const allContainers = services.flatMap((service) => service.containers ?? []);

  if (allContainers.length === 0) {
    return 'no-containers';
  }

  const total = allContainers.length;
  const running = allContainers.filter((c) => c.state?.toLowerCase() === 'running').length;
  const stopped = allContainers.filter((c) =>
    ['stopped', 'exited'].includes(c.state?.toLowerCase() ?? '')
  ).length;
  const notCreated = allContainers.filter((c) => c.state?.toLowerCase() === 'not created').length;

  if (running === total) return 'all-running';
  if (stopped === total) return 'all-stopped';
  if (notCreated === total) return 'all-not-created';
  if (running > 0) return 'mixed-running';
  if (notCreated > 0) return 'mixed-not-created';
  return 'other';
};

export const hasStoppedContainers = (service: ComposeService): boolean => {
  return (
    service.containers?.some((c) => ['stopped', 'exited'].includes(c.state?.toLowerCase() ?? '')) ??
    false
  );
};

export const hasCreatedContainers = (service: ComposeService): boolean => {
  return service.containers?.some((c) => c.state?.toLowerCase() !== 'not created') ?? false;
};

export const stackHasStoppedContainers = (services: ComposeService[]): boolean => {
  return services.some((service) => hasStoppedContainers(service));
};

export type ResourceStatus = 'active' | 'unused' | 'dangling';

export interface StatusBadgeInfo {
  className: string;
  label: string;
}

export const getContainerStatusBadge = (status: string): StatusBadgeInfo => {
  const statusMap: Record<string, StatusBadgeInfo> = {
    running: {
      className: cn(theme.badges.tag.base, theme.badges.tag.success),
      label: 'Running',
    },
    exited: {
      className: cn(theme.badges.tag.base, theme.badges.tag.danger),
      label: 'Exited',
    },
    created: {
      className: cn(theme.badges.tag.base, theme.badges.tag.info),
      label: 'Created',
    },
    paused: {
      className: cn(theme.badges.tag.base, theme.badges.tag.warning),
      label: 'Paused',
    },
    restarting: {
      className: cn(theme.badges.tag.base, theme.badges.tag.info),
      label: 'Restarting',
    },
    removing: {
      className: cn(theme.badges.tag.base, theme.badges.tag.warning),
      label: 'Removing',
    },
    dead: {
      className: cn(theme.badges.tag.base, theme.badges.tag.neutral),
      label: 'Dead',
    },
  };

  const statusInfo = statusMap[status.toLowerCase()] || {
    className: cn(theme.badges.tag.base, theme.badges.tag.neutral),
    label: status,
  };

  return statusInfo;
};

export const getResourceStatusBadge = (
  status: string,
  isUnused?: boolean,
  isDangling?: boolean
): StatusBadgeInfo => {
  if (isDangling) {
    return {
      className: cn(theme.badges.tag.base, theme.badges.tag.warning),
      label: 'Dangling',
    };
  }
  if (isUnused) {
    return {
      className: cn(theme.badges.tag.base, theme.badges.tag.danger),
      label: 'Unused',
    };
  }
  return {
    className: cn(theme.badges.tag.base, theme.badges.tag.success),
    label: 'Active',
  };
};
