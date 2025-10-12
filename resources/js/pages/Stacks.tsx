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
import Layout from '../components/layout/Layout';
import { StackCard } from '../components/dashboard/StackCard';
import { EmptyState } from '../components/common/EmptyState';
import { LoadingSpinner } from '../components/common/LoadingSpinner';
import { StatCard } from '../components/common/StatCard';
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
                    theme.brand.titleColor
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
        <StatCard
          label="Total Stacks"
          value={statistics.total}
          icon={CircleStackIcon}
          iconColor={theme.text.info}
          iconBg={theme.intent.info.surface}
          className="rounded-2xl"
        />
        <StatCard
          label="Healthy"
          value={statistics.healthy}
          icon={CircleStackIcon}
          iconColor={theme.text.success}
          iconBg={theme.intent.success.surface}
          className="rounded-2xl"
        />
        <StatCard
          label="Unhealthy"
          value={statistics.unhealthy}
          icon={ExclamationTriangleIcon}
          iconColor={theme.text.danger}
          iconBg={theme.intent.danger.surface}
          className="rounded-2xl"
        />
        <StatCard
          label="Containers"
          value={`${statistics.running}/${statistics.totalContainers}`}
          icon={ServerIcon}
          iconColor={theme.text.info}
          iconBg={theme.intent.info.surface}
          className="rounded-2xl"
        />
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
