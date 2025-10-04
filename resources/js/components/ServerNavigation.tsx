import React from 'react';
import { Link, usePage } from '@inertiajs/react';
import { CircleStackIcon, WrenchScrewdriverIcon, KeyIcon } from '@heroicons/react/24/outline';
import { useMaintenancePermissions } from '../hooks/useMaintenancePermissions';
import { useRegistryPermissions } from '../hooks/useRegistryPermissions';

interface ServerNavigationProps {
  serverId: number;
  serverName: string;
  className?: string;
}

export const ServerNavigation: React.FC<ServerNavigationProps> = ({
  serverId,
  serverName,
  className = '',
}) => {
  const { url } = usePage();
  const { data: maintenancePerms } = useMaintenancePermissions({
    serverid: serverId,
  });
  const { data: registryPerms } = useRegistryPermissions({
    serverId: serverId,
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
    <nav className={`flex space-x-1 ${className}`}>
      {navItems.map((item) => {
        const Icon = item.icon;
        const isActive = url === item.href;

        return (
          <Link
            key={item.name}
            href={item.href}
            className={`flex items-center space-x-2 px-4 py-2 rounded-xl text-sm font-medium transition-all duration-200 ${
              isActive
                ? 'bg-gradient-to-r from-blue-500/10 to-purple-500/10 text-blue-600 dark:text-blue-400 shadow-sm border border-blue-200/20 dark:border-blue-800/20'
                : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100/50 dark:hover:bg-slate-800/50 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <Icon className="w-4 h-4" />
            <span>{item.name}</span>
            {isActive && <div className="w-2 h-2 bg-blue-600 dark:bg-blue-400 rounded-full" />}
          </Link>
        );
      })}
    </nav>
  );
};
