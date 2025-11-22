import React, { useState, useMemo, useEffect } from 'react';
import { Head } from '@inertiajs/react';
import {
  MagnifyingGlassIcon,
  ExclamationCircleIcon,
  ServerStackIcon,
  Squares2X2Icon,
  ListBulletIcon,
} from '@heroicons/react/24/outline';
import { StackCard } from '../../components/dashboard/StackCard';
import { ServerNavigation } from '../../components/layout/ServerNavigation';
import { EmptyState } from '../../components/common/EmptyState';
import { LoadingSpinner } from '../../components/common/LoadingSpinner';
import { Breadcrumb } from '../../components/common/Breadcrumb';
import { StacksFilterBar, SortOption } from '../../components/common/StacksFilterBar';
import { Server } from '../../types/server';
import { useServerStacks } from '../../hooks/useServerStacks';
import { cn } from '../../utils/cn';
import { theme } from '../../theme';
import { StorageManager } from '../../utils/storage';

interface ServerStacksProps {
  title: string;
  server: Server;
  serverid: number;
}

export default function ServerStacks({ title, server, serverid }: ServerStacksProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [healthFilter, setHealthFilter] = useState<'all' | 'healthy' | 'unhealthy'>('all');
  const [layoutMode, setLayoutMode] = useState<'compact' | 'normal'>('normal');
  const [sortBy, setSortBy] = useState<SortOption>('name-asc');
  const [negativeFilters, setNegativeFilters] = useState<string[]>([]);
  const [showExclusionFilter, setShowExclusionFilter] = useState(false);

  const {
    data: stacks = [],
    isLoading: loading,
    error,
    refetch,
    isFetching,
  } = useServerStacks({ serverid });

  // Load preferences from storage on mount
  useEffect(() => {
    const savedLayout = StorageManager.stacksLayout.get();
    const savedSort = StorageManager.stacksSort.get();
    setLayoutMode(savedLayout);
    setSortBy(savedSort);
  }, []);

  // Handle layout toggle
  const toggleLayout = () => {
    const newLayout = layoutMode === 'compact' ? 'normal' : 'compact';
    setLayoutMode(newLayout);
    StorageManager.stacksLayout.set(newLayout);
  };

  const handleSortChange = (newSort: SortOption) => {
    setSortBy(newSort);
    StorageManager.stacksSort.set(newSort);
  };

  const filteredAndSortedStacks = useMemo(() => {
    const filtered = stacks.filter((stack) => {
      const matchesSearch =
        stack.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        stack.compose_file.toLowerCase().includes(searchTerm.toLowerCase()) ||
        stack.path.toLowerCase().includes(searchTerm.toLowerCase());

      const matchesHealth =
        healthFilter === 'all' ||
        (healthFilter === 'healthy' && stack.is_healthy) ||
        (healthFilter === 'unhealthy' && !stack.is_healthy);

      const matchesNegativeFilters = negativeFilters.every((filter) => {
        const lowerFilter = filter.toLowerCase();
        return !(
          stack.name.toLowerCase().includes(lowerFilter) ||
          stack.compose_file.toLowerCase().includes(lowerFilter) ||
          stack.path.toLowerCase().includes(lowerFilter)
        );
      });

      return matchesSearch && matchesHealth && matchesNegativeFilters;
    });

    const sorted = [...filtered].sort((a, b) => {
      switch (sortBy) {
        case 'name-asc':
          return a.name.localeCompare(b.name);
        case 'name-desc':
          return b.name.localeCompare(a.name);
        case 'health-asc':
          return (a.is_healthy ? 0 : 1) - (b.is_healthy ? 0 : 1);
        case 'health-desc':
          return (b.is_healthy ? 0 : 1) - (a.is_healthy ? 0 : 1);
        case 'containers-asc':
          return a.running_containers - b.running_containers;
        case 'containers-desc':
          return b.running_containers - a.running_containers;
        default:
          return 0;
      }
    });

    return sorted;
  }, [stacks, searchTerm, healthFilter, sortBy, negativeFilters]);
  return (
    <>
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
              onClick={toggleLayout}
              className={cn(
                'inline-flex items-center px-3 py-2 rounded-md text-sm leading-4 font-medium',
                theme.buttons.secondary
              )}
              title={layoutMode === 'compact' ? 'Switch to normal view' : 'Switch to compact view'}
            >
              {layoutMode === 'compact' ? (
                <>
                  <Squares2X2Icon className="-ml-0.5 mr-2 h-4 w-4" />
                  Normal View
                </>
              ) : (
                <>
                  <ListBulletIcon className="-ml-0.5 mr-2 h-4 w-4" />
                  Compact View
                </>
              )}
            </button>
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
          <StacksFilterBar
            searchTerm={searchTerm}
            onSearchChange={setSearchTerm}
            sortBy={sortBy}
            onSortChange={handleSortChange}
            healthFilter={healthFilter}
            onHealthFilterChange={setHealthFilter}
            negativeFilters={negativeFilters}
            onNegativeFiltersChange={setNegativeFilters}
            showExclusionFilter={showExclusionFilter}
            onToggleExclusionFilter={() => setShowExclusionFilter(!showExclusionFilter)}
            filteredCount={filteredAndSortedStacks.length}
            totalCount={stacks.length}
            searchPlaceholder="Search stacks..."
            rounded="lg"
          />

          {filteredAndSortedStacks.length === 0 ? (
            <EmptyState
              icon={MagnifyingGlassIcon}
              title="No stacks found"
              description="Try adjusting your search or filter criteria."
            />
          ) : (
            <div
              className={cn(
                'grid gap-6',
                layoutMode === 'compact'
                  ? 'md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4'
                  : 'md:grid-cols-2 lg:grid-cols-3'
              )}
            >
              {filteredAndSortedStacks.map((stack, index) => (
                <StackCard
                  key={`${stack.name}-${index}`}
                  stack={stack}
                  compact={layoutMode === 'compact'}
                />
              ))}
            </div>
          )}
        </>
      )}
    </>
  );
}
