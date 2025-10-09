import { ServerIcon } from '@heroicons/react/24/outline';
import ServerList from '../ServerList';
import { Server } from '../../types/server';
import { HealthSummary } from './types/dashboard';
import { theme } from '../../theme';
import { cn } from '../../utils/cn';

interface DashboardServerSectionProps {
  servers: Server[];
  healthSummary: HealthSummary;
}

export const DashboardServerSection = ({ servers, healthSummary }: DashboardServerSectionProps) => {
  return (
    <section className={theme.containers.subtle}>
      <header className="flex items-center justify-between border-b border-slate-200/60 pb-4 dark:border-slate-700/60">
        <div className="flex items-center gap-3">
          <div className={cn(theme.icon.squareMd, theme.brand.accent)}>
            <ServerIcon className="h-5 w-5" />
          </div>
          <div>
            <h2 className={cn('text-lg font-semibold', theme.text.strong)}>Your Servers</h2>
            <p className={cn('text-xs', theme.text.subtle)}>
              {healthSummary.totalStacks} stacks across {servers.length} servers
            </p>
          </div>
        </div>
        <div className="flex items-center gap-4 text-sm">
          <div className={cn('flex items-center gap-2', theme.text.subtle)}>
            <span className={cn(theme.badges.dot.base, theme.badges.dot.success)} />
            <span>{healthSummary.serversOnline} reachable</span>
          </div>
          {healthSummary.serversLoading > 0 && (
            <div className="flex items-center gap-2 text-amber-600 dark:text-amber-400">
              <span
                className={cn(theme.badges.dot.base, theme.badges.dot.warning, 'animate-pulse')}
              />
              <span>{healthSummary.serversLoading} checking</span>
            </div>
          )}
          {healthSummary.totalOfflineServers > 0 && (
            <div className="flex items-center gap-2 text-red-600 dark:text-red-400">
              <span className={cn(theme.badges.dot.base, theme.badges.dot.danger)} />
              <span>{healthSummary.totalOfflineServers} unreachable</span>
            </div>
          )}
        </div>
      </header>

      <div className="pt-6">
        <ServerList servers={servers} />
      </div>
    </section>
  );
};
