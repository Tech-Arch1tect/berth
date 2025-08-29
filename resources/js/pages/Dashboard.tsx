import Layout from '../components/Layout';
import FlashMessages from '../components/FlashMessages';
import ServerList from '../components/ServerList';
import { Head } from '@inertiajs/react';
import { Server } from '../types/server';
import { ServerIcon, ChartBarIcon, ClockIcon, ShieldCheckIcon } from '@heroicons/react/24/outline';

interface DashboardProps {
  title: string;
  servers: Server[];
  currentUser: {
    id: number;
    username: string;
    email: string;
  };
}

export default function Dashboard({ title, servers, currentUser }: DashboardProps) {
  const stats = [
    {
      name: 'Total Servers',
      value: servers.length.toString(),
      icon: ServerIcon,
      color: 'blue',
    },
    {
      name: 'Active Servers',
      value: servers.filter((server) => server.is_active).length.toString(),
      icon: ChartBarIcon,
      color: 'green',
    },
    {
      name: 'Last Updated',
      value: 'Just now',
      icon: ClockIcon,
      color: 'purple',
    },
    {
      name: 'Your Access',
      value: 'Full',
      icon: ShieldCheckIcon,
      color: 'emerald',
    },
  ];

  return (
    <Layout>
      <Head title={title} />

      {/* Header Section */}
      <div className="mb-8">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold bg-gradient-to-r from-slate-900 to-slate-600 dark:from-white dark:to-slate-300 bg-clip-text text-transparent">
              {title}
            </h1>
            <p className="mt-2 text-slate-600 dark:text-slate-400">
              Welcome back,{' '}
              <span className="font-semibold text-slate-900 dark:text-white">
                {currentUser.username}
              </span>
              ! Here's your infrastructure overview.
            </p>
          </div>
          <div className="flex items-center space-x-2 text-sm text-slate-500 dark:text-slate-400">
            <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
            <span>Live data</span>
          </div>
        </div>
      </div>

      <FlashMessages className="mb-8" />

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        {stats.map((stat) => {
          const Icon = stat.icon;
          const colorClasses = {
            blue: 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-200/20 dark:border-blue-800/20',
            green:
              'bg-green-500/10 text-green-600 dark:text-green-400 border-green-200/20 dark:border-green-800/20',
            purple:
              'bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-200/20 dark:border-purple-800/20',
            emerald:
              'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-200/20 dark:border-emerald-800/20',
          }[stat.color];

          return (
            <div
              key={stat.name}
              className="bg-white/70 dark:bg-slate-800/70 backdrop-blur-sm rounded-2xl border border-slate-200/50 dark:border-slate-700/50 p-6 hover:shadow-lg hover:shadow-slate-200/50 dark:hover:shadow-slate-900/20 transition-all duration-200"
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-slate-600 dark:text-slate-400">
                    {stat.name}
                  </p>
                  <p className="text-2xl font-bold text-slate-900 dark:text-white mt-1">
                    {stat.value}
                  </p>
                </div>
                <div className={`p-3 rounded-xl border ${colorClasses}`}>
                  <Icon className="w-6 h-6" />
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Servers Section */}
      <div className="bg-white/50 dark:bg-slate-800/50 backdrop-blur-sm rounded-2xl border border-slate-200/50 dark:border-slate-700/50 overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200/50 dark:border-slate-700/50">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="w-8 h-8 bg-gradient-to-r from-blue-500 to-purple-500 rounded-lg flex items-center justify-center">
                <ServerIcon className="w-5 h-5 text-white" />
              </div>
              <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Your Servers</h2>
            </div>
            <div className="flex items-center space-x-2 text-sm text-slate-500 dark:text-slate-400">
              <span>{servers.length} total</span>
            </div>
          </div>
        </div>

        <div className="p-6">
          <ServerList servers={servers} />
        </div>
      </div>
    </Layout>
  );
}
