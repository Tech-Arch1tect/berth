import { useState, useMemo, useCallback } from 'react';
import { useParams } from '@tanstack/react-router';
import { ServerNavigation } from '../../../shared/layout/ServerNavigation';
import { Breadcrumb } from '../../../shared/components/Breadcrumb';
import { SortOption } from '../types';
import { useServerStacks } from '../hooks/useServerStacks';
import { useCanCreateStack } from '../hooks/useCanCreateStack';
import { StorageManager } from '../../../shared/utils/storage';
import { useDocumentTitle } from '../../../shared/hooks/useDocumentTitle';
import { useGetApiV1ServersServerid } from '../../../api/generated/servers/servers';
import { LoadingSpinner } from '../../../shared/components/LoadingSpinner';
import { FilterLayout } from '../../../shared/components/FilterLayout';
import { StacksToolbar } from '../components/toolbar/StacksToolbar';
import { StacksSidebar } from '../components/sidebar/StacksSidebar';
import { StacksContent } from '../components/content/StacksContent';
import { StacksStatusBar } from '../components/statusbar/StacksStatusBar';
import { CreateStackModal } from '../components/CreateStackModal';
import { StackService } from '../services/stackService';

export default function ServerStacks() {
  const params = useParams({ strict: false }) as { serverid?: string };
  const serverid = Number(params.serverid);
  const { data: serverResponse, isLoading: serverLoading } = useGetApiV1ServersServerid(serverid, {
    query: { enabled: Number.isFinite(serverid) && serverid > 0 },
  });
  const server = serverResponse?.data?.server;
  useDocumentTitle(server ? `${server.name} - Stacks` : 'Stacks');
  const [searchTerm, setSearchTerm] = useState('');
  const [healthFilter, setHealthFilter] = useState<'all' | 'healthy' | 'unhealthy'>('all');
  const [layoutMode, setLayoutMode] = useState<'compact' | 'normal'>(() =>
    StorageManager.stacksLayout.get()
  );
  const [sortBy, setSortBy] = useState<SortOption>(() => StorageManager.stacksSort.get());
  const [negativeFilters, setNegativeFilters] = useState<string[]>([]);
  const [showExclusionFilter, setShowExclusionFilter] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(new Date());
  const [showCreateModal, setShowCreateModal] = useState(false);

  const {
    data: stacks = [],
    isLoading: loading,
    error,
    refetch,
    isFetching,
  } = useServerStacks({ serverid });

  const { data: canCreateStack = false } = useCanCreateStack({ serverid });

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
    refetch();
    setLastUpdated(new Date());
  }, [refetch]);

  const handleCreateStack = useCallback(
    async (name: string) => {
      await StackService.createStack(serverid, name);
      refetch();
      setLastUpdated(new Date());
    },
    [serverid, refetch]
  );

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

  const statistics = useMemo(() => {
    return {
      total: stacks.length,
      healthy: stacks.filter((s) => s.is_healthy).length,
      unhealthy: stacks.filter((s) => !s.is_healthy).length,
      running: stacks.reduce((acc, s) => acc + s.running_containers, 0),
      totalContainers: stacks.reduce((acc, s) => acc + s.total_containers, 0),
    };
  }, [stacks]);

  const hasActiveFilters = searchTerm !== '' || healthFilter !== 'all';

  const activeFilterCount =
    (searchTerm !== '' ? 1 : 0) + (healthFilter !== 'all' ? 1 : 0) + negativeFilters.length;

  const hasError = !!error;
  const errors = error && server ? [{ server, error: error as Error }] : [];

  if (serverLoading || !server) {
    return <LoadingSpinner size="lg" text="Loading server..." fullScreen />;
  }

  return (
    <>
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

      <ServerNavigation serverId={serverid} serverName={server.name} />

      <div className="h-full flex flex-col">
        <FilterLayout
          activeFilterCount={activeFilterCount}
          toolbar={
            <StacksToolbar
              title={`${server.name} - Docker Stacks`}
              isRefreshing={isFetching}
              onRefresh={handleRefresh}
              layoutMode={layoutMode}
              onLayoutToggle={toggleLayout}
              onCreateStack={canCreateStack ? () => setShowCreateModal(true) : undefined}
            />
          }
          filters={
            <StacksSidebar
              searchTerm={searchTerm}
              onSearchChange={setSearchTerm}
              healthFilter={healthFilter}
              onHealthFilterChange={setHealthFilter}
              sortBy={sortBy}
              onSortChange={handleSortChange}
              negativeFilters={negativeFilters}
              onNegativeFiltersChange={setNegativeFilters}
              showExclusionFilter={showExclusionFilter}
              onToggleExclusionFilter={() => setShowExclusionFilter(!showExclusionFilter)}
              showServersSection={false}
            />
          }
          content={
            <StacksContent
              stacks={filteredAndSortedStacks}
              statistics={statistics}
              layoutMode={layoutMode}
              isLoading={loading}
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

      <CreateStackModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onConfirm={handleCreateStack}
      />
    </>
  );
}
