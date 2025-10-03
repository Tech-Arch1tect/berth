import React from 'react';
import { Link } from '@inertiajs/react';
import { Stack } from '../types/stack';
import {
  ServerIcon,
  CircleStackIcon,
  CheckCircleIcon,
  XCircleIcon,
  FolderIcon,
} from '@heroicons/react/24/outline';

interface StackCardProps {
  stack: Stack;
}

export const StackCard: React.FC<StackCardProps> = ({ stack }) => {
  const healthPercentage =
    stack.total_containers > 0
      ? Math.round((stack.running_containers / stack.total_containers) * 100)
      : 0;

  return (
    <Link
      href={`/servers/${stack.server_id}/stacks/${stack.name}`}
      className="block bg-white/70 dark:bg-slate-800/70 backdrop-blur-sm border border-slate-200/50 dark:border-slate-700/50 rounded-2xl hover:shadow-lg hover:border-slate-300 dark:hover:border-slate-600 transition-all duration-200"
    >
      <div className="p-6">
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-600 rounded-xl flex items-center justify-center flex-shrink-0">
              <CircleStackIcon className="w-5 h-5 text-white" />
            </div>
            <div className="min-w-0">
              <h3 className="text-lg font-semibold text-slate-900 dark:text-white truncate">
                {stack.name}
              </h3>
              <div className="flex items-center space-x-2 mt-1">
                <ServerIcon className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400 flex-shrink-0" />
                <span className="text-sm text-slate-600 dark:text-slate-400 truncate">
                  {stack.server_name}
                </span>
              </div>
            </div>
          </div>
          <span
            className={`inline-flex items-center space-x-1 px-2.5 py-1 rounded-lg text-xs font-medium flex-shrink-0 ${
              stack.is_healthy
                ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300'
                : 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300'
            }`}
          >
            {stack.is_healthy ? (
              <CheckCircleIcon className="w-3.5 h-3.5" />
            ) : (
              <XCircleIcon className="w-3.5 h-3.5" />
            )}
            <span>{stack.is_healthy ? 'Healthy' : 'Unhealthy'}</span>
          </span>
        </div>

        <div className="flex items-center space-x-2 mb-3">
          <FolderIcon className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400 flex-shrink-0" />
          <p className="text-xs text-slate-500 dark:text-slate-400 truncate font-mono">
            {stack.compose_file}
          </p>
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-slate-600 dark:text-slate-400">Containers</span>
            <span className="font-medium text-slate-900 dark:text-white">
              {stack.running_containers}/{stack.total_containers}
            </span>
          </div>

          <div className="relative">
            <div className="h-2 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
              <div
                className={`h-full transition-all duration-300 ${
                  stack.is_healthy
                    ? 'bg-gradient-to-r from-emerald-500 to-green-500'
                    : 'bg-gradient-to-r from-red-500 to-orange-500'
                }`}
                style={{ width: `${healthPercentage}%` }}
              />
            </div>
          </div>

          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
            <span>Health: {healthPercentage}%</span>
            {!stack.is_healthy && (
              <span className="text-red-600 dark:text-red-400 font-medium">
                {stack.total_containers - stack.running_containers} down
              </span>
            )}
          </div>
        </div>
      </div>
    </Link>
  );
};
