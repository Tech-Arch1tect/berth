import React, { useState, useMemo } from 'react';
import { Head } from '@inertiajs/react';
import {
  MagnifyingGlassIcon,
  FunnelIcon,
  ArrowPathIcon,
  CircleStackIcon,
  ServerIcon,
  ExclamationTriangleIcon,
} from '@heroicons/react/24/outline';
import Layout from '../components/Layout';
import { StackCard } from '../components/StackCard';
import { Server } from '../types/server';
import { useAllStacks } from '../hooks/useAllStacks';

interface StacksProps {
  title: string;
  servers: Server[];
}

export default function Stacks({ title, servers }: StacksProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [healthFilter, setHealthFilter] = useState<'all' | 'healthy' | 'unhealthy'>('all');
  const [serverFilter, setServerFilter] = useState<number | 'all'>('all');

  const { stacks, isLoading, isFetching, hasError, errors, refetchAll } = useAllStacks({
    servers,
  });

  const filteredStacks = useMemo(() => {
    return stacks.filter((stack) => {
      const matchesSearch =
        stack.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        stack.server_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        stack.compose_file.toLowerCase().includes(searchTerm.toLowerCase()) ||
        stack.path.toLowerCase().includes(searchTerm.toLowerCase());

      const matchesHealth =
        healthFilter === 'all' ||
        (healthFilter === 'healthy' && stack.is_healthy) ||
        (healthFilter === 'unhealthy' && !stack.is_healthy);

      const matchesServer = serverFilter === 'all' || stack.server_id === serverFilter;

      return matchesSearch && matchesHealth && matchesServer;
    });
  }, [stacks, searchTerm, healthFilter, serverFilter]);

  const statistics = useMemo(() => {
    return {
      total: stacks.length,
      healthy: stacks.filter((s) => s.is_healthy).length,
      unhealthy: stacks.filter((s) => !s.is_healthy).length,
      running: stacks.reduce((acc, s) => acc + s.running_containers, 0),
      totalContainers: stacks.reduce((acc, s) => acc + s.total_containers, 0),
    };
  }, [stacks]);

  return (
    <Layout>
      <Head title={title} />

      <div className="mb-8">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
          <div className="flex items-center space-x-4">
            <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-purple-600 rounded-2xl flex items-center justify-center">
              <CircleStackIcon className="w-8 h-8 text-white" />
            </div>
            <div>
              <div className="flex items-center space-x-3">
                <h1 className="text-3xl font-bold bg-gradient-to-r from-slate-900 to-slate-600 dark:from-white dark:to-slate-300 bg-clip-text text-transparent">
                  {title}
                </h1>
                {isFetching && !isLoading && (
                  <div className="flex items-center text-sm text-slate-500 dark:text-slate-400">
                    <ArrowPathIcon className="animate-spin h-4 w-4 mr-2" />
                    Refreshing...
                  </div>
                )}
              </div>
              <p className="text-slate-600 dark:text-slate-400 mt-2">
                Browse and search all stacks across all servers
              </p>
            </div>
          </div>

          <button
            onClick={refetchAll}
            disabled={isFetching}
            className="inline-flex items-center px-4 py-2 bg-white/70 dark:bg-slate-800/70 backdrop-blur-sm border border-slate-200/50 dark:border-slate-700/50 rounded-xl text-slate-700 dark:text-slate-300 hover:bg-white dark:hover:bg-slate-800 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <ArrowPathIcon className={`w-4 h-4 mr-2 ${isFetching ? 'animate-spin' : ''}`} />
            Refresh All
          </button>
        </div>
      </div>

      {hasError && errors.length > 0 && (
        <div className="mb-6 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-4">
          <div className="flex items-start space-x-3">
            <ExclamationTriangleIcon className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <h3 className="text-sm font-semibold text-red-800 dark:text-red-400 mb-2">
                Failed to load stacks from some servers
              </h3>
              <ul className="space-y-1">
                {errors.map(({ server, error }) => (
                  <li key={server.id} className="text-sm text-red-700 dark:text-red-300">
                    {server.name}: {error.message}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <div className="bg-white/70 dark:bg-slate-800/70 backdrop-blur-sm rounded-2xl border border-slate-200/50 dark:border-slate-700/50 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-slate-600 dark:text-slate-400">Total Stacks</p>
              <p className="text-2xl font-bold text-slate-900 dark:text-white mt-1">
                {statistics.total}
              </p>
            </div>
            <div className="p-3 rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-200/20 dark:border-blue-800/20">
              <CircleStackIcon className="w-6 h-6" />
            </div>
          </div>
        </div>

        <div className="bg-white/70 dark:bg-slate-800/70 backdrop-blur-sm rounded-2xl border border-slate-200/50 dark:border-slate-700/50 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-slate-600 dark:text-slate-400">Healthy</p>
              <p className="text-2xl font-bold text-slate-900 dark:text-white mt-1">
                {statistics.healthy}
              </p>
            </div>
            <div className="p-3 rounded-xl bg-green-500/10 text-green-600 dark:text-green-400 border border-green-200/20 dark:border-green-800/20">
              <CircleStackIcon className="w-6 h-6" />
            </div>
          </div>
        </div>

        <div className="bg-white/70 dark:bg-slate-800/70 backdrop-blur-sm rounded-2xl border border-slate-200/50 dark:border-slate-700/50 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-slate-600 dark:text-slate-400">Unhealthy</p>
              <p className="text-2xl font-bold text-slate-900 dark:text-white mt-1">
                {statistics.unhealthy}
              </p>
            </div>
            <div className="p-3 rounded-xl bg-red-500/10 text-red-600 dark:text-red-400 border border-red-200/20 dark:border-red-800/20">
              <ExclamationTriangleIcon className="w-6 h-6" />
            </div>
          </div>
        </div>

        <div className="bg-white/70 dark:bg-slate-800/70 backdrop-blur-sm rounded-2xl border border-slate-200/50 dark:border-slate-700/50 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-slate-600 dark:text-slate-400">Containers</p>
              <p className="text-2xl font-bold text-slate-900 dark:text-white mt-1">
                {statistics.running}/{statistics.totalContainers}
              </p>
            </div>
            <div className="p-3 rounded-xl bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-200/20 dark:border-purple-800/20">
              <ServerIcon className="w-6 h-6" />
            </div>
          </div>
        </div>
      </div>

      {isLoading ? (
        <div className="text-center py-16">
          <div className="relative">
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="w-32 h-32 bg-gradient-to-r from-blue-100 to-purple-100 dark:from-blue-900/20 dark:to-purple-900/20 rounded-full opacity-50" />
            </div>
            <div className="relative">
              <div className="mx-auto w-16 h-16 bg-gradient-to-br from-slate-100 to-slate-200 dark:from-slate-800 dark:to-slate-700 rounded-2xl flex items-center justify-center mb-6 animate-spin">
                <ArrowPathIcon className="w-8 h-8 text-slate-400 dark:text-slate-500" />
              </div>
            </div>
          </div>
          <h3 className="text-xl font-semibold text-slate-900 dark:text-white mb-2">
            Loading stacks...
          </h3>
          <p className="text-slate-600 dark:text-slate-400">
            Please wait while we fetch stacks from all servers.
          </p>
        </div>
      ) : (
        <>
          <div className="flex flex-col sm:flex-row gap-4 mb-6 bg-white/50 dark:bg-slate-800/50 backdrop-blur-sm p-4 rounded-2xl border border-slate-200/50 dark:border-slate-700/50">
            <div className="relative flex-1">
              <MagnifyingGlassIcon className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Search stacks by name, server, compose file, or path..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 border border-slate-200 dark:border-slate-700 rounded-xl bg-white/70 dark:bg-slate-900/70 backdrop-blur-sm text-slate-900 dark:text-white placeholder-slate-500 dark:placeholder-slate-400 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all duration-200"
              />
            </div>
            <div className="flex items-center gap-3">
              <div className="relative">
                <FunnelIcon className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <select
                  value={healthFilter}
                  onChange={(e) =>
                    setHealthFilter(e.target.value as 'all' | 'healthy' | 'unhealthy')
                  }
                  className="pl-10 pr-8 py-2.5 border border-slate-200 dark:border-slate-700 rounded-xl bg-white/70 dark:bg-slate-900/70 backdrop-blur-sm text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all duration-200"
                >
                  <option value="all">All Health</option>
                  <option value="healthy">Healthy Only</option>
                  <option value="unhealthy">Unhealthy Only</option>
                </select>
              </div>
              <div className="relative">
                <ServerIcon className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <select
                  value={serverFilter}
                  onChange={(e) =>
                    setServerFilter(e.target.value === 'all' ? 'all' : Number(e.target.value))
                  }
                  className="pl-10 pr-8 py-2.5 border border-slate-200 dark:border-slate-700 rounded-xl bg-white/70 dark:bg-slate-900/70 backdrop-blur-sm text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all duration-200"
                >
                  <option value="all">All Servers</option>
                  {servers.map((server) => (
                    <option key={server.id} value={server.id}>
                      {server.name}
                    </option>
                  ))}
                </select>
              </div>
              <span className="text-sm text-slate-500 dark:text-slate-400 whitespace-nowrap">
                {filteredStacks.length} of {stacks.length}
              </span>
            </div>
          </div>

          {filteredStacks.length === 0 ? (
            <div className="text-center py-16">
              <div className="relative">
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="w-32 h-32 bg-gradient-to-r from-slate-100 to-slate-200 dark:from-slate-800 dark:to-slate-700 rounded-full opacity-50" />
                </div>
                <div className="relative">
                  <div className="mx-auto w-16 h-16 bg-gradient-to-br from-slate-100 to-slate-200 dark:from-slate-800 dark:to-slate-700 rounded-2xl flex items-center justify-center mb-6">
                    <MagnifyingGlassIcon className="w-8 h-8 text-slate-400 dark:text-slate-500" />
                  </div>
                </div>
              </div>
              <h3 className="text-xl font-semibold text-slate-900 dark:text-white mb-2">
                No stacks found
              </h3>
              <p className="text-slate-600 dark:text-slate-400">
                {searchTerm || healthFilter !== 'all' || serverFilter !== 'all'
                  ? 'Try adjusting your search or filter criteria.'
                  : 'There are no Docker Compose stacks configured on any server.'}
              </p>
            </div>
          ) : (
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {filteredStacks.map((stack) => (
                <StackCard key={`${stack.server_id}-${stack.name}`} stack={stack} />
              ))}
            </div>
          )}
        </>
      )}
    </Layout>
  );
}
