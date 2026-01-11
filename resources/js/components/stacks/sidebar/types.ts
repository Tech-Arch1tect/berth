export type SidebarSelection =
  | { type: 'service'; serviceName: string }
  | { type: 'network'; networkName: string }
  | { type: 'volume'; volumeName: string }
  | { type: 'environment' }
  | { type: 'overview' }
  | { type: 'logs' }
  | { type: 'files' }
  | { type: 'stats' }
  | { type: 'security' };

export const isSameSelection = (
  a: SidebarSelection | null,
  b: SidebarSelection | null
): boolean => {
  if (a === null || b === null) return a === b;
  if (a.type !== b.type) return false;

  switch (a.type) {
    case 'service':
      return b.type === 'service' && a.serviceName === b.serviceName;
    case 'network':
      return b.type === 'network' && a.networkName === b.networkName;
    case 'volume':
      return b.type === 'volume' && a.volumeName === b.volumeName;
    default:
      return true;
  }
};
