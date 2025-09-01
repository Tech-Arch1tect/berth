import { Link } from '@inertiajs/react';
import { Server } from '../types/server';
import { ServerIcon, ChevronRightIcon, WifiIcon, NoSymbolIcon } from '@heroicons/react/24/outline';

interface ServerCardProps {
  server: Server;
}

export default function ServerCard({ server }: ServerCardProps) {
  const statusConfig = {
    online: {
      color: 'emerald',
      text: 'Online',
      icon: WifiIcon,
      pulse: true,
    },
    offline: {
      color: 'slate',
      text: 'Offline',
      icon: NoSymbolIcon,
      pulse: false,
    },
  };

  const status = server.is_active ? 'online' : 'offline';
  const config = statusConfig[status];

  return (
    <Link
      href={`/servers/${server.id}/stacks`}
      className="group relative block bg-white/70 dark:bg-slate-800/70 backdrop-blur-sm rounded-2xl border border-slate-200/50 dark:border-slate-700/50 p-6 hover:shadow-xl hover:shadow-slate-200/50 dark:hover:shadow-slate-900/20 hover:border-slate-300/50 dark:hover:border-slate-600/50 transition-all duration-300 cursor-pointer hover:scale-[1.02]"
    >
      {/* Status indicator */}
      <div className="absolute top-4 right-4">
        <div
          className={`flex items-center space-x-2 px-3 py-1.5 rounded-full text-xs font-medium ${
            status === 'online'
              ? 'bg-emerald-100/70 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300'
              : 'bg-slate-100/70 text-slate-700 dark:bg-slate-800/70 dark:text-slate-300'
          }`}
        >
          <div
            className={`w-2 h-2 rounded-full ${
              status === 'online'
                ? 'bg-emerald-500' + (config.pulse ? ' animate-pulse' : '')
                : 'bg-slate-400'
            }`}
          />
          <span>{config.text}</span>
        </div>
      </div>

      {/* Server info */}
      <div className="flex items-start space-x-4">
        <div className="flex-shrink-0">
          <div
            className={`w-12 h-12 rounded-2xl flex items-center justify-center ${
              status === 'online'
                ? 'bg-gradient-to-br from-blue-500 to-purple-600'
                : 'bg-gradient-to-br from-slate-400 to-slate-500'
            }`}
          >
            <ServerIcon className="w-6 h-6 text-white" />
          </div>
        </div>

        <div className="flex-1 min-w-0 pr-8">
          <h3 className="text-xl font-semibold text-slate-900 dark:text-white mb-2 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
            {server.name}
          </h3>

          <div className="space-y-2">
            <div className="flex items-center text-sm text-slate-600 dark:text-slate-400">
              <span className="font-mono bg-slate-100 dark:bg-slate-700 px-2 py-1 rounded-lg">
                https://{server.host}:{server.port}
              </span>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-sm text-slate-500 dark:text-slate-400">
                Docker Stack Management
              </span>
              <ChevronRightIcon className="w-5 h-5 text-slate-400 group-hover:text-blue-500 group-hover:translate-x-1 transition-all duration-200" />
            </div>
          </div>
        </div>
      </div>

      {/* Hover effect gradient */}
      <div className="absolute inset-0 rounded-2xl bg-gradient-to-r from-blue-500/5 to-purple-500/5 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none" />
    </Link>
  );
}
