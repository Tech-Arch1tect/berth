import { Link, useLocation } from '@tanstack/react-router';
import { CircleStackIcon, WrenchScrewdriverIcon, KeyIcon } from '@heroicons/react/24/outline';
import { useMaintenancePermissions } from '../../features/maintenance/hooks/useMaintenancePermissions';
import { useRegistryPermissions } from '../../features/registries/hooks/useRegistryPermissions';
import { theme } from '../theme';
import { cn } from '../utils/cn';

interface ServerNavigationProps {
  serverId: number;
  serverName: string;
  className?: string;
}

export const ServerNavigation = ({ serverId, className }: ServerNavigationProps) => {
  const { pathname } = useLocation();
  const { data: maintenancePerms } = useMaintenancePermissions({
    serverid: serverId,
  });
  const { data: registryPerms } = useRegistryPermissions({
    serverId,
  });

  const serverIdStr = String(serverId);
  const navItems = [
    {
      name: 'Stacks',
      to: '/servers/$serverid/stacks' as const,
      href: `/servers/${serverIdStr}/stacks`,
      icon: CircleStackIcon,
      show: true,
    },
    {
      name: 'Registries',
      to: '/servers/$serverid/registries' as const,
      href: `/servers/${serverIdStr}/registries`,
      icon: KeyIcon,
      show: registryPerms?.canManage === true,
    },
    {
      name: 'Maintenance',
      to: '/servers/$serverid/maintenance' as const,
      href: `/servers/${serverIdStr}/maintenance`,
      icon: WrenchScrewdriverIcon,
      show: maintenancePerms?.maintenance?.read === true,
    },
  ].filter((item) => item.show);

  return (
    <nav className={cn(theme.tabs.container, className)}>
      {navItems.map((item) => {
        const Icon = item.icon;
        const isActive = pathname === item.href;
        return (
          <Link
            key={item.name}
            to={item.to}
            params={{ serverid: serverIdStr }}
            className={cn(theme.tabs.trigger, isActive ? theme.tabs.active : theme.tabs.inactive)}
          >
            <div className="flex items-center gap-2">
              <Icon className="h-4 w-4" />
              <span>{item.name}</span>
            </div>
            {isActive && (
              <span
                className={cn(
                  theme.badges.dot.base,
                  theme.badges.dot.success,
                  'absolute right-2 top-2'
                )}
              />
            )}
          </Link>
        );
      })}
    </nav>
  );
};
