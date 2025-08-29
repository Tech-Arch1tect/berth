import { ServerIcon, PlusIcon } from '@heroicons/react/24/outline';

export default function EmptyServerState() {
  return (
    <div className="text-center py-16">
      <div className="relative">
        {/* Background decoration */}
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="w-32 h-32 bg-gradient-to-r from-blue-100 to-purple-100 dark:from-blue-900/20 dark:to-purple-900/20 rounded-full opacity-50" />
        </div>

        {/* Icon */}
        <div className="relative">
          <div className="mx-auto w-16 h-16 bg-gradient-to-br from-slate-100 to-slate-200 dark:from-slate-800 dark:to-slate-700 rounded-2xl flex items-center justify-center mb-6 border border-slate-200/50 dark:border-slate-700/50">
            <ServerIcon className="w-8 h-8 text-slate-400 dark:text-slate-500" />
          </div>
        </div>
      </div>

      <div className="max-w-md mx-auto">
        <h3 className="text-xl font-semibold text-slate-900 dark:text-white mb-2">
          No servers configured
        </h3>
        <p className="text-slate-600 dark:text-slate-400 mb-6">
          Start your infrastructure management journey by adding your first Docker server.
        </p>

        <div className="inline-flex items-center space-x-2 px-4 py-2 bg-slate-100/70 dark:bg-slate-800/70 rounded-xl text-sm text-slate-600 dark:text-slate-400 border border-slate-200/50 dark:border-slate-700/50">
          <PlusIcon className="w-4 h-4" />
          <span>Contact your administrator to add servers</span>
        </div>
      </div>
    </div>
  );
}
