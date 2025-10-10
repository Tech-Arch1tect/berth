import React, { useState, useMemo } from 'react';
import { Head, Link } from '@inertiajs/react';
import {
  MagnifyingGlassIcon,
  FunnelIcon,
  ExclamationCircleIcon,
  ServerStackIcon,
} from '@heroicons/react/24/outline';
import Layout from '../../components/Layout';
import { StackCard } from '../../components/StackCard';
import { ServerNavigation } from '../../components/ServerNavigation';
import { EmptyState } from '../../components/common/EmptyState';
import { LoadingSpinner } from '../../components/common/LoadingSpinner';
import { Breadcrumb } from '../../components/common/Breadcrumb';
import { Server } from '../../types/server';
import { useServerStacks } from '../../hooks/useServerStacks';
import { cn } from '../../utils/cn';
import { theme } from '../../theme';

interface ServerStacksProps {
  title: string;
  server: Server;
  serverid: number;
}

export default function ServerStacks({ title, server, serverid }: ServerStacksProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [healthFilter, setHealthFilter] = useState<'all' | 'healthy' | 'unhealthy'>('all');

  const {
    data: stacks = [],
    isLoading: loading,
    error,
    refetch,
    isFetching,
  } = useServerStacks({ serverid });

  const filteredStacks = useMemo(() => {
    return stacks.filter((stack) => {
      const matchesSearch =
        stack.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        stack.compose_file.toLowerCase().includes(searchTerm.toLowerCase()) ||
        stack.path.toLowerCase().includes(searchTerm.toLowerCase());

      const matchesHealth =
        healthFilter === 'all' ||
        (healthFilter === 'healthy' && stack.is_healthy) ||
        (healthFilter === 'unhealthy' && !stack.is_healthy);

      return matchesSearch && matchesHealth;
    });
  }, [stacks, searchTerm, healthFilter]);
  return (
    <Layout>
      <Head title={title} />

      {/* Breadcrumb */}
      <Breadcrumb
        items={[
          {
            label: server.name,
            href: `/servers/${serverid}/stacks`,
          },
          {
            label: 'Docker Stacks',
          },
        ]}
      />

      {/* Server Navigation */}
      <div className="mb-8">
        <ServerNavigation serverId={serverid} serverName={server.name} />
      </div>

      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center space-x-3">
              <h1 className={cn('text-3xl font-bold', theme.text.strong)}>
                {server.name} - Docker Stacks
              </h1>
              {isFetching && !loading && (
                <div className={cn('flex items-center text-sm', theme.text.subtle)}>
                  <svg
                    className="animate-spin -ml-1 mr-2 h-4 w-4"
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                  >
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    ></circle>
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    ></path>
                  </svg>
                  Refreshing...
                </div>
              )}
            </div>
            <p className={cn('mt-2', theme.text.muted)}>
              https://{server.host}:{server.port}
            </p>
          </div>
          <div className="flex items-center space-x-2">
            <button
              onClick={() => refetch()}
              disabled={isFetching}
              className={cn(
                'inline-flex items-center px-3 py-2 rounded-md text-sm leading-4 font-medium',
                theme.buttons.secondary
              )}
            >
              <svg
                className={`-ml-0.5 mr-2 h-4 w-4 ${isFetching ? 'animate-spin' : ''}`}
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                />
              </svg>
              Refresh
            </button>
            <span
              className={cn(
                theme.badges.status.base,
                server.is_active ? theme.badges.status.online : theme.badges.status.offline
              )}
            >
              {server.is_active ? 'Active' : 'Inactive'}
            </span>
          </div>
        </div>
      </div>

      {/* Stacks Content */}
      {loading ? (
        <LoadingSpinner size="lg" text="Loading stacks..." fullScreen />
      ) : error ? (
        <EmptyState
          icon={ExclamationCircleIcon}
          title="Error loading stacks"
          description={error?.message}
          variant="error"
          action={{
            label: 'Try again',
            onClick: () => refetch(),
          }}
        />
      ) : stacks.length === 0 ? (
        <EmptyState
          icon={ServerStackIcon}
          title="No stacks found"
          description="There are no Docker Compose stacks configured on this server."
        />
      ) : (
        <>
          {/* Search and Filter Controls */}
          <div
            className={cn(
              'flex flex-col sm:flex-row gap-4 mb-6 p-4 rounded-lg',
              theme.surface.panel
            )}
          >
            <div className="relative flex-1">
              <MagnifyingGlassIcon className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="Search stacks..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className={cn('w-full pl-10 pr-4 py-2 rounded-lg', theme.forms.input)}
              />
            </div>
            <div className="flex items-center gap-4">
              <div className="relative">
                <FunnelIcon className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                <select
                  value={healthFilter}
                  onChange={(e) =>
                    setHealthFilter(e.target.value as 'all' | 'healthy' | 'unhealthy')
                  }
                  className={cn('pl-10 pr-8 py-2 rounded-lg', theme.forms.select)}
                >
                  <option value="all">All Health</option>
                  <option value="healthy">Healthy Only</option>
                  <option value="unhealthy">Unhealthy Only</option>
                </select>
              </div>
              <span className={cn('text-sm whitespace-nowrap', theme.text.subtle)}>
                {filteredStacks.length} of {stacks.length}
              </span>
            </div>
          </div>

          {filteredStacks.length === 0 ? (
            <EmptyState
              icon={MagnifyingGlassIcon}
              title="No stacks found"
              description="Try adjusting your search or filter criteria."
            />
          ) : (
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {filteredStacks.map((stack, index) => (
                <StackCard key={`${stack.name}-${index}`} stack={stack} />
              ))}
            </div>
          )}
        </>
      )}
    </Layout>
  );
}
