import { Server } from '../types/server';

interface ServerCardProps {
  server: Server;
}

export default function ServerCard({ server }: ServerCardProps) {
  return (
    <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-4 hover:shadow-md transition-shadow">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <div className="flex-shrink-0">
            <div
              className={`h-3 w-3 rounded-full ${server.is_active ? 'bg-green-400' : 'bg-gray-400'}`}
            ></div>
          </div>
          <div>
            <h3 className="text-lg font-medium text-gray-900 dark:text-white">{server.name}</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {server.use_https ? 'https://' : 'http://'}
              {server.host}:{server.port}
            </p>
          </div>
        </div>
        <div className="flex items-center space-x-2">
          <span
            className={`px-2 py-1 text-xs font-medium rounded-full ${
              server.is_active
                ? 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400'
                : 'bg-gray-100 text-gray-800 dark:bg-gray-900/20 dark:text-gray-400'
            }`}
          >
            {server.is_active ? 'Active' : 'Inactive'}
          </span>
        </div>
      </div>
    </div>
  );
}
