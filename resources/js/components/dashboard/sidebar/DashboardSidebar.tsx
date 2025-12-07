import React from 'react';
import { cn } from '../../../utils/cn';
import { Server } from '../../../types/server';
import { HealthSummary } from '../types/dashboard';
import { SECTION_IDS } from '../content/DashboardPage';
import {
  ViewColumnsIcon,
  ClockIcon,
  ExclamationTriangleIcon,
  ServerIcon,
} from '@heroicons/react/24/outline';

interface DashboardSidebarProps {
  servers: Server[];
  activeSection: string;
  healthSummary: HealthSummary;
  serverStats: Map<number, { total: number; healthy: number }>;
}

interface NavItemProps {
  label: string;
  icon: React.ReactNode;
  isActive: boolean;
  onClick: () => void;
  badge?: React.ReactNode;
}

const NavItem: React.FC<NavItemProps> = ({ label, icon, isActive, onClick, badge }) => (
  <button
    onClick={onClick}
    className={cn(
      'w-full flex items-center gap-2 px-3 py-1.5 text-left',
      'hover:bg-zinc-100 dark:hover:bg-zinc-800',
      'transition-colors',
      isActive && 'bg-teal-50 dark:bg-teal-900/30 text-teal-700 dark:text-teal-300'
    )}
  >
    <span className="w-4 h-4 flex-shrink-0 text-zinc-500 dark:text-zinc-400">{icon}</span>
    <span className="flex-1 text-sm">{label}</span>
    {badge}
  </button>
);

interface ServerItemProps {
  server: Server;
  isActive: boolean;
  onClick: () => void;
  stackCount?: number;
  healthyStacks?: number;
}

const ServerItem: React.FC<ServerItemProps> = ({
  server,
  isActive,
  onClick,
  stackCount,
  healthyStacks,
}) => {
  const isOnline = server.is_active;
  const statusColor = isOnline ? 'bg-emerald-500' : 'bg-zinc-400 dark:bg-zinc-500';

  return (
    <button
      onClick={onClick}
      className={cn(
        'w-full flex items-center gap-2 px-3 py-2 text-left',
        'hover:bg-zinc-100 dark:hover:bg-zinc-800',
        'transition-colors',
        isActive && 'bg-teal-50 dark:bg-teal-900/30 text-teal-700 dark:text-teal-300'
      )}
    >
      <span className={cn('w-2 h-2 rounded-full flex-shrink-0', statusColor)} />
      <div className="flex-1 min-w-0">
        <span className="text-sm font-medium truncate block">{server.name}</span>
        <span className="text-xs text-zinc-400 dark:text-zinc-500 truncate block">
          {server.host}:{server.port}
        </span>
      </div>
      {stackCount !== undefined && (
        <div className="text-xs text-zinc-400 dark:text-zinc-500 tabular-nums text-right">
          {healthyStacks !== undefined && healthyStacks !== stackCount ? (
            <>
              <span className="text-emerald-500">{healthyStacks}</span>
              <span>/</span>
            </>
          ) : null}
          <span>{stackCount}</span>
        </div>
      )}
    </button>
  );
};

const scrollToSection = (sectionId: string) => {
  const element = document.getElementById(sectionId);
  if (element) {
    element.scrollIntoView({ behavior: 'smooth', block: 'start' });

    element.classList.add('animate-highlight-flash');

    const handleAnimationEnd = () => {
      element.classList.remove('animate-highlight-flash');
      element.removeEventListener('animationend', handleAnimationEnd);
    };
    element.addEventListener('animationend', handleAnimationEnd);
  }
};

export const DashboardSidebar: React.FC<DashboardSidebarProps> = ({
  servers,
  activeSection,
  healthSummary,
  serverStats,
}) => {
  const onlineServers = servers.filter((s) => s.is_active);
  const offlineServers = servers.filter((s) => !s.is_active);

  return (
    <div className="py-1">
      {/* Navigation Section */}
      <div className="py-1 px-1">
        <NavItem
          label="Overview"
          icon={<ViewColumnsIcon className="w-4 h-4" />}
          isActive={activeSection === SECTION_IDS.overview}
          onClick={() => scrollToSection(SECTION_IDS.overview)}
        />
        <NavItem
          label="Alerts"
          icon={<ExclamationTriangleIcon className="w-4 h-4" />}
          isActive={activeSection === SECTION_IDS.alerts}
          onClick={() => scrollToSection(SECTION_IDS.alerts)}
          badge={
            healthSummary.unhealthyStacks > 0 ? (
              <span className="px-1.5 py-0.5 text-xs font-medium rounded bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400">
                {healthSummary.unhealthyStacks}
              </span>
            ) : null
          }
        />
        <NavItem
          label="Activity"
          icon={<ClockIcon className="w-4 h-4" />}
          isActive={activeSection === SECTION_IDS.activity}
          onClick={() => scrollToSection(SECTION_IDS.activity)}
        />
      </div>

      {/* Servers Section */}
      <div className="mt-2 pt-2 border-t border-zinc-200 dark:border-zinc-700">
        <div className="px-3 py-1.5 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ServerIcon className="w-4 h-4 text-zinc-400" />
            <span className="text-xs font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
              Servers
            </span>
          </div>
          <span className="text-xs text-zinc-400 dark:text-zinc-500">
            {onlineServers.length}/{servers.length}
          </span>
        </div>

        {/* Online Servers */}
        {onlineServers.length > 0 && (
          <div className="py-1">
            {onlineServers.map((server) => {
              const stats = serverStats.get(server.id);
              return (
                <ServerItem
                  key={server.id}
                  server={server}
                  isActive={activeSection === SECTION_IDS.server(server.id)}
                  onClick={() => scrollToSection(SECTION_IDS.server(server.id))}
                  stackCount={stats?.total}
                  healthyStacks={stats?.healthy}
                />
              );
            })}
          </div>
        )}

        {/* Offline Servers */}
        {offlineServers.length > 0 && (
          <div className="py-1">
            <div className="px-3 py-1 text-xs text-zinc-400 dark:text-zinc-500">
              Offline ({offlineServers.length})
            </div>
            {offlineServers.map((server) => (
              <ServerItem
                key={server.id}
                server={server}
                isActive={activeSection === SECTION_IDS.server(server.id)}
                onClick={() => scrollToSection(SECTION_IDS.server(server.id))}
              />
            ))}
          </div>
        )}

        {servers.length === 0 && (
          <div className="px-3 py-4 text-center">
            <p className="text-xs text-zinc-400 dark:text-zinc-500 italic">No servers configured</p>
          </div>
        )}
      </div>
    </div>
  );
};
