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
import { EmptyState } from '../components/common/EmptyState';
import { LoadingSpinner } from '../components/common/LoadingSpinner';
import { Server } from '../types/server';
import { useAllStacks } from '../hooks/useAllStacks';
import { cn } from '../utils/cn';
import { theme } from '../theme';

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
            <div
              className={cn(
                'w-16 h-16 rounded-2xl flex items-center justify-center',
                theme.brand.accent
              )}
            >
              <CircleStackIcon className="w-8 h-8 text-white" />
            </div>
            <div>
              <div className="flex items-center space-x-3">
                <h1
                  className={cn(
                    'text-3xl font-bold bg-clip-text text-transparent',
                    theme.brand.titleGradient
                  )}
                >
                  {title}
                </h1>
                {isFetching && !isLoading && (
                  <div className={cn('flex items-center text-sm', theme.text.subtle)}>
                    <ArrowPathIcon className="animate-spin h-4 w-4 mr-2" />
                    Refreshing...
                  </div>
                )}
              </div>
              <p className={cn('mt-2', theme.text.muted)}>
                Browse and search all stacks across all servers
              </p>
            </div>
          </div>

          <button
            onClick={refetchAll}
            disabled={isFetching}
            className={cn(
              'inline-flex items-center px-4 py-2 rounded-xl transition-all duration-200',
              theme.buttons.secondary
            )}
          >
            <ArrowPathIcon className={`w-4 h-4 mr-2 ${isFetching ? 'animate-spin' : ''}`} />
            Refresh All
          </button>
        </div>
      </div>

      {hasError && errors.length > 0 && (
        <div className={cn('mb-6 rounded-xl p-4', theme.intent.danger.surface)}>
          <div className="flex items-start space-x-3">
            <ExclamationTriangleIcon
              className={cn('w-5 h-5 flex-shrink-0 mt-0.5', theme.intent.danger.icon)}
            />
            <div className="flex-1">
              <h3 className={cn('text-sm font-semibold mb-2', theme.intent.danger.textStrong)}>
                Failed to load stacks from some servers
              </h3>
              <ul className="space-y-1">
                {errors.map(({ server, error }) => (
                  <li key={server.id} className={cn('text-sm', theme.intent.danger.textMuted)}>
                    {server.name}: {error.message}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <div className={cn('rounded-2xl p-6', theme.cards.translucent)}>
          <div className="flex items-center justify-between">
            <div>
              <p className={cn('text-sm font-medium', theme.text.muted)}>Total Stacks</p>
              <p className={cn('text-2xl font-bold mt-1', theme.text.strong)}>{statistics.total}</p>
            </div>
            <div className="p-3 rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-200/20 dark:border-blue-800/20">
              <CircleStackIcon className="w-6 h-6" />
            </div>
          </div>
        </div>

        <div className={cn('rounded-2xl p-6', theme.cards.translucent)}>
          <div className="flex items-center justify-between">
            <div>
              <p className={cn('text-sm font-medium', theme.text.muted)}>Healthy</p>
              <p className={cn('text-2xl font-bold mt-1', theme.text.strong)}>
                {statistics.healthy}
              </p>
            </div>
            <div className="p-3 rounded-xl bg-green-500/10 text-green-600 dark:text-green-400 border border-green-200/20 dark:border-green-800/20">
              <CircleStackIcon className="w-6 h-6" />
            </div>
          </div>
        </div>

        <div className={cn('rounded-2xl p-6', theme.cards.translucent)}>
          <div className="flex items-center justify-between">
            <div>
              <p className={cn('text-sm font-medium', theme.text.muted)}>Unhealthy</p>
              <p className={cn('text-2xl font-bold mt-1', theme.text.strong)}>
                {statistics.unhealthy}
              </p>
            </div>
            <div className="p-3 rounded-xl bg-red-500/10 text-red-600 dark:text-red-400 border border-red-200/20 dark:border-red-800/20">
              <ExclamationTriangleIcon className="w-6 h-6" />
            </div>
          </div>
        </div>

        <div className={cn('rounded-2xl p-6', theme.cards.translucent)}>
          <div className="flex items-center justify-between">
            <div>
              <p className={cn('text-sm font-medium', theme.text.muted)}>Containers</p>
              <p className={cn('text-2xl font-bold mt-1', theme.text.strong)}>
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
        <LoadingSpinner size="lg" text="Loading stacks from all servers..." fullScreen />
      ) : (
        <>
          <div
            className={cn(
              'flex flex-col sm:flex-row gap-4 mb-6 p-4 rounded-2xl',
              theme.cards.translucent
            )}
          >
            <div className="relative flex-1">
              <MagnifyingGlassIcon className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Search stacks by name, server, compose file, or path..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className={cn(
                  'w-full pl-10 pr-4 py-2.5 rounded-xl transition-all duration-200',
                  theme.forms.input
                )}
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
                  className={cn(
                    'pl-10 pr-8 py-2.5 rounded-xl transition-all duration-200',
                    theme.forms.select
                  )}
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
                  className={cn(
                    'pl-10 pr-8 py-2.5 rounded-xl transition-all duration-200',
                    theme.forms.select
                  )}
                >
                  <option value="all">All Servers</option>
                  {servers.map((server) => (
                    <option key={server.id} value={server.id}>
                      {server.name}
                    </option>
                  ))}
                </select>
              </div>
              <span className={cn('text-sm whitespace-nowrap', theme.text.subtle)}>
                {filteredStacks.length} of {stacks.length}
              </span>
            </div>
          </div>

          {filteredStacks.length === 0 ? (
            <EmptyState
              icon={
                searchTerm || healthFilter !== 'all' || serverFilter !== 'all'
                  ? MagnifyingGlassIcon
                  : CircleStackIcon
              }
              title="No stacks found"
              description={
                searchTerm || healthFilter !== 'all' || serverFilter !== 'all'
                  ? 'Try adjusting your search or filter criteria.'
                  : 'There are no Docker Compose stacks configured on any server.'
              }
            />
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
