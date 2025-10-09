import { Link, usePage } from '@inertiajs/react';
import { CircleStackIcon, WrenchScrewdriverIcon, KeyIcon } from '@heroicons/react/24/outline';
import { useMaintenancePermissions } from '../hooks/useMaintenancePermissions';
import { useRegistryPermissions } from '../hooks/useRegistryPermissions';
import { theme } from '../theme';
import { cn } from '../utils/cn';

interface ServerNavigationProps {
  serverId: number;
  serverName: string;
  className?: string;
}

export const ServerNavigation = ({ serverId, className }: ServerNavigationProps) => {
  const { url } = usePage();
  const { data: maintenancePerms } = useMaintenancePermissions({
    serverid: serverId,
  });
  const { data: registryPerms } = useRegistryPermissions({
    serverId,
  });

  const navItems = [
    {
      name: 'Stacks',
      href: `/servers/${serverId}/stacks`,
      icon: CircleStackIcon,
      show: true,
    },
    {
      name: 'Registries',
      href: `/servers/${serverId}/registries`,
      icon: KeyIcon,
      show: registryPerms?.canManage === true,
    },
    {
      name: 'Maintenance',
      href: `/servers/${serverId}/maintenance`,
      icon: WrenchScrewdriverIcon,
      show: maintenancePerms?.maintenance?.read === true,
    },
  ].filter((item) => item.show);

  return (
    <nav className={cn(theme.tabs.container, className)}>
      {navItems.map((item) => {
        const Icon = item.icon;
        const isActive = url === item.href;
        return (
          <Link
            key={item.name}
            href={item.href}
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
