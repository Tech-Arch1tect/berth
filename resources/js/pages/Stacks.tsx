import { useState, useMemo } from 'react';
import { Head } from '@inertiajs/react';
import {
  ArrowPathIcon,
  CircleStackIcon,
  ServerIcon,
  ExclamationTriangleIcon,
  Squares2X2Icon,
  ListBulletIcon,
  MagnifyingGlassIcon,
} from '@heroicons/react/24/outline';
import { StackCard } from '../components/dashboard/StackCard';
import { EmptyState } from '../components/common/EmptyState';
import { LoadingSpinner } from '../components/common/LoadingSpinner';
import { StatCard } from '../components/common/StatCard';
import { StacksFilterBar, SortOption } from '../components/common/StacksFilterBar';
import { Server } from '../types/server';
import { useAllStacks } from '../hooks/useAllStacks';
import { cn } from '../utils/cn';
import { theme } from '../theme';
import { StorageManager } from '../utils/storage';

interface StacksProps {
  title: string;
  servers: Server[];
}

export default function Stacks({ title, servers }: StacksProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [healthFilter, setHealthFilter] = useState<'all' | 'healthy' | 'unhealthy'>('all');
  const [serverFilter, setServerFilter] = useState<number | 'all'>('all');
  const [layoutMode, setLayoutMode] = useState<'compact' | 'normal'>(() =>
    StorageManager.stacksLayout.get()
  );
  const [sortBy, setSortBy] = useState<SortOption>(() => StorageManager.stacksSort.get());
  const [negativeFilters, setNegativeFilters] = useState<string[]>([]);
  const [showExclusionFilter, setShowExclusionFilter] = useState(false);

  const { stacks, isLoading, isFetching, hasError, errors, refetchAll } = useAllStacks({
    servers,
  });

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
        stack.server_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        stack.compose_file.toLowerCase().includes(searchTerm.toLowerCase()) ||
        stack.path.toLowerCase().includes(searchTerm.toLowerCase());

      const matchesHealth =
        healthFilter === 'all' ||
        (healthFilter === 'healthy' && stack.is_healthy) ||
        (healthFilter === 'unhealthy' && !stack.is_healthy);

      const matchesServer = serverFilter === 'all' || stack.server_id === serverFilter;

      const matchesNegativeFilters = negativeFilters.every((filter) => {
        const lowerFilter = filter.toLowerCase();
        return !(
          stack.name.toLowerCase().includes(lowerFilter) ||
          stack.server_name.toLowerCase().includes(lowerFilter) ||
          stack.compose_file.toLowerCase().includes(lowerFilter) ||
          stack.path.toLowerCase().includes(lowerFilter)
        );
      });

      return matchesSearch && matchesHealth && matchesServer && matchesNegativeFilters;
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
  }, [stacks, searchTerm, healthFilter, serverFilter, sortBy, negativeFilters]);

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
    <>
      <Head title={title} />

      <div className="mb-8">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
          <div className="flex items-center space-x-4">
            <div
              className={cn(
                'w-12 h-12 rounded-xl flex items-center justify-center',
                theme.brand.accent
              )}
            >
              <CircleStackIcon className="w-6 h-6 text-white" />
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

          <div className="flex items-center gap-2">
            <button
              onClick={toggleLayout}
              className={cn(
                'inline-flex items-center px-4 py-2 rounded-xl transition-all duration-200',
                theme.buttons.secondary
              )}
              title={layoutMode === 'compact' ? 'Switch to normal view' : 'Switch to compact view'}
            >
              {layoutMode === 'compact' ? (
                <>
                  <Squares2X2Icon className="w-4 h-4 mr-2" />
                  Normal View
                </>
              ) : (
                <>
                  <ListBulletIcon className="w-4 h-4 mr-2" />
                  Compact View
                </>
              )}
            </button>
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
          <StacksFilterBar
            searchTerm={searchTerm}
            onSearchChange={setSearchTerm}
            sortBy={sortBy}
            onSortChange={handleSortChange}
            healthFilter={healthFilter}
            onHealthFilterChange={setHealthFilter}
            serverFilter={serverFilter}
            onServerFilterChange={setServerFilter}
            servers={servers}
            negativeFilters={negativeFilters}
            onNegativeFiltersChange={setNegativeFilters}
            showExclusionFilter={showExclusionFilter}
            onToggleExclusionFilter={() => setShowExclusionFilter(!showExclusionFilter)}
            filteredCount={filteredAndSortedStacks.length}
            totalCount={stacks.length}
            searchPlaceholder="Search stacks by name, server, compose file, or path..."
            rounded="2xl"
          />

          {filteredAndSortedStacks.length === 0 ? (
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
            <div
              className={cn(
                'grid gap-6',
                layoutMode === 'compact'
                  ? 'md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4'
                  : 'md:grid-cols-2 lg:grid-cols-3'
              )}
            >
              {filteredAndSortedStacks.map((stack) => (
                <StackCard
                  key={`${stack.server_id}-${stack.name}`}
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
