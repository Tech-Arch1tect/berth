import React, { useState, useMemo } from 'react';
import { Head, Link } from '@inertiajs/react';
import {
  MagnifyingGlassIcon,
  FunnelIcon,
  HomeIcon,
  ChevronRightIcon,
} from '@heroicons/react/24/outline';
import Layout from '../../components/Layout';
import { StackCard } from '../../components/StackCard';
import { ServerNavigation } from '../../components/ServerNavigation';
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
      <nav className="flex mb-6" aria-label="Breadcrumb">
        <ol className="flex items-center space-x-4">
          <li>
            <Link
              href="/"
              className={cn(
                theme.text.subtle,
                'hover:text-slate-700 dark:hover:text-slate-300 transition-colors'
              )}
            >
              <HomeIcon className="h-5 w-5" />
            </Link>
          </li>
          <li>
            <div className="flex items-center">
              <ChevronRightIcon className={cn('h-5 w-5', theme.text.subtle)} />
              <Link
                href={`/servers/${serverid}/stacks`}
                className={cn(
                  'ml-4 text-sm font-medium transition-colors',
                  theme.text.muted,
                  'hover:text-slate-700 dark:hover:text-slate-300'
                )}
              >
                {server.name}
              </Link>
            </div>
          </li>
          <li>
            <div className="flex items-center">
              <ChevronRightIcon className={cn('h-5 w-5', theme.text.subtle)} />
              <span className={cn('ml-4 text-sm font-medium', theme.text.strong)}>
                Docker Stacks
              </span>
            </div>
          </li>
        </ol>
      </nav>

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
        <div className="text-center py-12">
          <div
            className={cn(
              'inline-flex items-center justify-center w-16 h-16 rounded-full mb-4 animate-spin',
              theme.surface.panel
            )}
          >
            <svg
              className={cn('w-8 h-8', theme.text.subtle)}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
              />
            </svg>
          </div>
          <h3 className={cn('text-lg font-medium mb-2', theme.text.strong)}>Loading stacks...</h3>
        </div>
      ) : error ? (
        <div className="text-center py-12">
          <div
            className={cn(
              'inline-flex items-center justify-center w-16 h-16 rounded-full mb-4',
              theme.intent.danger.surface
            )}
          >
            <svg
              className={cn('w-8 h-8', theme.intent.danger.icon)}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
          </div>
          <h3 className={cn('text-lg font-medium mb-2', theme.text.strong)}>
            Error loading stacks
          </h3>
          <p className={cn('mb-4', theme.text.muted)}>{error?.message}</p>
          <button
            onClick={() => refetch()}
            className={cn(
              'inline-flex items-center px-4 py-2 rounded-md text-sm font-medium',
              theme.buttons.primary
            )}
          >
            Try again
          </button>
        </div>
      ) : stacks.length === 0 ? (
        <div className="text-center py-12">
          <div
            className={cn(
              'inline-flex items-center justify-center w-16 h-16 rounded-full mb-4',
              theme.surface.panel
            )}
          >
            <svg
              className={cn('w-8 h-8', theme.text.subtle)}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"
              />
            </svg>
          </div>
          <h3 className={cn('text-lg font-medium mb-2', theme.text.strong)}>No stacks found</h3>
          <p className={theme.text.muted}>
            There are no Docker Compose stacks configured on this server.
          </p>
        </div>
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
            <div className="text-center py-12">
              <MagnifyingGlassIcon className={cn('mx-auto h-12 w-12', theme.text.subtle)} />
              <h3 className={cn('mt-2 text-sm font-medium', theme.text.strong)}>No stacks found</h3>
              <p className={cn('mt-1 text-sm', theme.text.muted)}>
                Try adjusting your search or filter criteria.
              </p>
            </div>
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
