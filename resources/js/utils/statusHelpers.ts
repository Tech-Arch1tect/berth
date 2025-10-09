import { cn } from './cn';
import { theme } from '../theme';

export type ContainerStatus =
  | 'running'
  | 'exited'
  | 'created'
  | 'paused'
  | 'restarting'
  | 'removing'
  | 'dead';
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
      className: cn(
        theme.badges.tag.base,
        'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300'
      ),
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
