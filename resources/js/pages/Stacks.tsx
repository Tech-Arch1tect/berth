import { useState, useMemo, useCallback } from 'react';
import { Head } from '@inertiajs/react';
import { SortOption } from '../types/stack';
import { Server } from '../types/server';
import { useAllStacks } from '../hooks/useAllStacks';
import { StorageManager } from '../utils/storage';
import { PanelLayout } from '../components/common/PanelLayout';
import { StacksToolbar } from '../components/stacks/toolbar/StacksToolbar';
import { StacksSidebar } from '../components/stacks/sidebar/StacksSidebar';
import { StacksContent } from '../components/stacks/content/StacksContent';
import { StacksStatusBar } from '../components/stacks/statusbar/StacksStatusBar';

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
  const [lastUpdated, setLastUpdated] = useState<Date | null>(new Date());

  const { stacks, isLoading, isFetching, hasError, errors, refetchAll } = useAllStacks({
    servers,
  });

  const toggleLayout = useCallback(() => {
    const newLayout = layoutMode === 'compact' ? 'normal' : 'compact';
    setLayoutMode(newLayout);
    StorageManager.stacksLayout.set(newLayout);
  }, [layoutMode]);

  const handleSortChange = useCallback((newSort: SortOption) => {
    setSortBy(newSort);
    StorageManager.stacksSort.set(newSort);
  }, []);

  const handleRefresh = useCallback(() => {
    refetchAll();
    setLastUpdated(new Date());
  }, [refetchAll]);

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

  const serverStackCounts = useMemo(() => {
    const counts = new Map<number, { total: number; healthy: number }>();
    servers.forEach((server) => {
      const serverStacks = stacks.filter((s) => s.server_id === server.id);
      counts.set(server.id, {
        total: serverStacks.length,
        healthy: serverStacks.filter((s) => s.is_healthy).length,
      });
    });
    return counts;
  }, [stacks, servers]);

  const hasActiveFilters = searchTerm !== '' || healthFilter !== 'all' || serverFilter !== 'all';

  const activeFilterCount =
    (searchTerm !== '' ? 1 : 0) +
    (healthFilter !== 'all' ? 1 : 0) +
    (serverFilter !== 'all' ? 1 : 0) +
    negativeFilters.length;

  return (
    <>
      <Head title={title} />

      <div className="h-full flex flex-col">
        <PanelLayout
          storageKey="stacks"
          sidebarTitle="Filters"
          toolbar={
            <StacksToolbar
              title={title}
              isRefreshing={isFetching}
              onRefresh={handleRefresh}
              layoutMode={layoutMode}
              onLayoutToggle={toggleLayout}
            />
          }
          sidebar={
            <StacksSidebar
              servers={servers}
              searchTerm={searchTerm}
              onSearchChange={setSearchTerm}
              serverFilter={serverFilter}
              onServerFilterChange={setServerFilter}
              healthFilter={healthFilter}
              onHealthFilterChange={setHealthFilter}
              sortBy={sortBy}
              onSortChange={handleSortChange}
              negativeFilters={negativeFilters}
              onNegativeFiltersChange={setNegativeFilters}
              showExclusionFilter={showExclusionFilter}
              onToggleExclusionFilter={() => setShowExclusionFilter(!showExclusionFilter)}
              serverStackCounts={serverStackCounts}
            />
          }
          content={
            <StacksContent
              stacks={filteredAndSortedStacks}
              statistics={statistics}
              layoutMode={layoutMode}
              isLoading={isLoading}
              hasError={hasError}
              errors={errors}
              hasActiveFilters={hasActiveFilters}
            />
          }
          statusBar={
            <StacksStatusBar
              filteredCount={filteredAndSortedStacks.length}
              totalCount={stacks.length}
              lastUpdated={lastUpdated}
              activeFilterCount={activeFilterCount}
            />
          }
        />
      </div>
    </>
  );
}
