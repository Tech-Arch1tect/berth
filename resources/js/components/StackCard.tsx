import React from 'react';
import { Link } from '@inertiajs/react';
import { Stack } from '../types/stack';

interface StackCardProps {
  stack: Stack;
}

export const StackCard: React.FC<StackCardProps> = ({ stack }) => {
  return (
    <Link
      href={`/servers/${stack.server_id}/stacks/${stack.name}`}
      className="block bg-white dark:bg-gray-800 overflow-hidden shadow-sm rounded-lg hover:shadow-md transition-shadow duration-200"
    >
      <div className="p-6">
        <div className="flex items-center justify-between">
          <div className="flex-1 min-w-0">
            <h3 className="text-lg font-medium text-gray-900 dark:text-white truncate">
              {stack.name}
            </h3>
            <p className="text-sm text-gray-600 dark:text-gray-400 truncate">{stack.server_name}</p>
            <div className="flex items-center justify-between mt-2">
              <p className="text-xs text-gray-500 dark:text-gray-500 truncate">
                {stack.compose_file}
              </p>
              <div className="flex items-center space-x-2 ml-2">
                <span className="text-xs text-gray-600 dark:text-gray-400">
                  {stack.running_containers}/{stack.total_containers} running
                </span>
                <span
                  className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                    stack.is_healthy
                      ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/20 dark:text-emerald-300'
                      : 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-300'
                  }`}
                >
                  {stack.is_healthy ? 'Healthy' : 'Unhealthy'}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Link>
  );
};
