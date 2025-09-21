import { ServerIcon } from '@heroicons/react/24/outline';
import { Server } from '../../types/server';
import { HealthSummary } from './types/dashboard';
import ServerList from '../ServerList';

interface DashboardServerSectionProps {
  servers: Server[];
  healthSummary: HealthSummary;
}

export const DashboardServerSection: React.FC<DashboardServerSectionProps> = ({
  servers,
  healthSummary,
}) => {
  return (
    <div className="bg-white/50 dark:bg-slate-800/50 backdrop-blur-sm rounded-2xl border border-slate-200/50 dark:border-slate-700/50 overflow-hidden">
      <div className="px-6 py-4 border-b border-slate-200/50 dark:border-slate-700/50">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 bg-gradient-to-r from-blue-500 to-purple-500 rounded-lg flex items-center justify-center">
              <ServerIcon className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Your Servers</h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {healthSummary.totalStacks} stacks across {servers.length} servers
              </p>
            </div>
          </div>
          <div className="flex items-center space-x-4 text-sm">
            <div className="flex items-center space-x-2 text-slate-500 dark:text-slate-400">
              <div className="w-2 h-2 bg-green-500 rounded-full"></div>
              <span>{healthSummary.serversOnline} reachable</span>
            </div>
            {healthSummary.serversLoading > 0 && (
              <div className="flex items-center space-x-2 text-amber-600 dark:text-amber-400">
                <div className="w-2 h-2 bg-amber-500 rounded-full animate-pulse"></div>
                <span>{healthSummary.serversLoading} checking</span>
              </div>
            )}
            {healthSummary.totalOfflineServers > 0 && (
              <div className="flex items-center space-x-2 text-red-600 dark:text-red-400">
                <div className="w-2 h-2 bg-red-500 rounded-full"></div>
                <span>{healthSummary.totalOfflineServers} unreachable</span>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="p-6">
        <ServerList servers={servers} />
      </div>
    </div>
  );
};
