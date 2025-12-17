import {
  ServerIcon,
  FunnelIcon,
  MinusCircleIcon,
  MagnifyingGlassIcon,
} from '@heroicons/react/24/outline';
import { SidebarSection } from './SidebarSection';
import { ServerListItem } from './ServerListItem';
import { NegativeFilters } from '../../common/NegativeFilters';
import { Server } from '../../../types/server';
import { SortOption } from '../../common/StacksFilterBar';
import { cn } from '../../../utils/cn';
import { theme } from '../../../theme';

interface StacksSidebarProps {
  servers: Server[];
  searchTerm: string;
  onSearchChange: (value: string) => void;
  serverFilter: number | 'all';
  onServerFilterChange: (value: number | 'all') => void;
  healthFilter: 'all' | 'healthy' | 'unhealthy';
  onHealthFilterChange: (value: 'all' | 'healthy' | 'unhealthy') => void;
  sortBy: SortOption;
  onSortChange: (value: SortOption) => void;
  negativeFilters: string[];
  onNegativeFiltersChange: (filters: string[]) => void;
  showExclusionFilter: boolean;
  onToggleExclusionFilter: () => void;
  serverStackCounts: Map<number, { total: number; healthy: number }>;
}

export const StacksSidebar: React.FC<StacksSidebarProps> = ({
  servers,
  searchTerm,
  onSearchChange,
  serverFilter,
  onServerFilterChange,
  healthFilter,
  onHealthFilterChange,
  sortBy,
  onSortChange,
  negativeFilters,
  onNegativeFiltersChange,
  showExclusionFilter,
  onToggleExclusionFilter,
  serverStackCounts,
}) => {
  const totalStacks = Array.from(serverStackCounts.values()).reduce(
    (sum, counts) => sum + counts.total,
    0
  );

  return (
    <div className="flex flex-col h-full">
      {/* Servers Section */}
      <SidebarSection
        title="Servers"
        icon={<ServerIcon className="w-4 h-4 text-zinc-400" />}
        defaultExpanded={true}
      >
        <div className="space-y-0.5">
          {/* All Servers Option */}
          <button
            onClick={() => onServerFilterChange('all')}
            className={cn(
              'w-full px-3 py-2 text-left transition-colors',
              'hover:bg-zinc-100 dark:hover:bg-zinc-800',
              serverFilter === 'all' && 'bg-teal-50 dark:bg-teal-950/30'
            )}
          >
            <div className="flex items-center justify-between gap-2">
              <div
                className={cn(
                  'text-sm font-medium',
                  serverFilter === 'all' ? 'text-teal-700 dark:text-teal-400' : theme.text.strong
                )}
              >
                All Servers
              </div>
              <span
                className={cn(
                  'px-2 py-0.5 rounded-md text-xs font-medium tabular-nums',
                  serverFilter === 'all'
                    ? 'bg-teal-100 text-teal-700 dark:bg-teal-900/50 dark:text-teal-300'
                    : 'bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300'
                )}
              >
                {totalStacks}
              </span>
            </div>
          </button>

          {/* Individual Servers */}
          {servers.map((server) => (
            <ServerListItem
              key={server.id}
              server={server}
              isActive={serverFilter === server.id}
              onClick={() => onServerFilterChange(server.id)}
              stackCount={serverStackCounts.get(server.id)}
            />
          ))}
        </div>
      </SidebarSection>

      {/* Filters Section */}
      <SidebarSection
        title="Filters"
        icon={<FunnelIcon className="w-4 h-4 text-zinc-400" />}
        defaultExpanded={true}
      >
        <div className="px-3 py-2 space-y-3">
          {/* Search Input */}
          <div className="relative">
            <label className={cn('block text-xs font-medium mb-1.5', theme.text.muted)}>
              Search
            </label>
            <div className="relative">
              <MagnifyingGlassIcon
                className={cn(
                  'absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 pointer-events-none',
                  theme.text.subtle
                )}
              />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => onSearchChange(e.target.value)}
                placeholder="Search stacks..."
                className={cn('w-full pl-9 pr-3 py-2 rounded-lg text-sm', theme.forms.input)}
              />
            </div>
          </div>

          {/* Health Filter */}
          <div className="relative">
            <label className={cn('block text-xs font-medium mb-1.5', theme.text.muted)}>
              Health Status
            </label>
            <select
              value={healthFilter}
              onChange={(e) =>
                onHealthFilterChange(e.target.value as 'all' | 'healthy' | 'unhealthy')
              }
              className={cn('w-full px-3 py-2 rounded-lg text-sm', theme.forms.select)}
            >
              <option value="all">All</option>
              <option value="healthy">Healthy Only</option>
              <option value="unhealthy">Unhealthy Only</option>
            </select>
          </div>

          {/* Sort By */}
          <div className="relative">
            <label className={cn('block text-xs font-medium mb-1.5', theme.text.muted)}>
              Sort By
            </label>
            <select
              value={sortBy}
              onChange={(e) => onSortChange(e.target.value as SortOption)}
              className={cn('w-full px-3 py-2 rounded-lg text-sm', theme.forms.select)}
            >
              <option value="name-asc">Name (A-Z)</option>
              <option value="name-desc">Name (Z-A)</option>
              <option value="health-asc">Health (Healthy First)</option>
              <option value="health-desc">Health (Unhealthy First)</option>
              <option value="containers-asc">Containers (Low-High)</option>
              <option value="containers-desc">Containers (High-Low)</option>
            </select>
          </div>

          {/* Negative Filters Toggle */}
          <div>
            <button
              onClick={onToggleExclusionFilter}
              className={cn(
                'w-full inline-flex items-center justify-center px-3 py-2 rounded-lg text-sm font-medium transition-all',
                showExclusionFilter || negativeFilters.length > 0
                  ? theme.buttons.primary
                  : theme.buttons.secondary
              )}
              title="Toggle exclusion filters"
            >
              <MinusCircleIcon className="h-4 w-4 mr-2" />
              Exclude
              {negativeFilters.length > 0 && (
                <span className="ml-2 px-1.5 py-0.5 rounded-full bg-white/20 text-xs font-medium">
                  {negativeFilters.length}
                </span>
              )}
            </button>
          </div>

          {/* Negative Filters Component */}
          {showExclusionFilter && (
            <div className="pt-2 border-t border-zinc-200 dark:border-zinc-800">
              <NegativeFilters
                filters={negativeFilters}
                onFiltersChange={onNegativeFiltersChange}
                isExpanded={showExclusionFilter}
                onToggle={onToggleExclusionFilter}
              />
            </div>
          )}
        </div>
      </SidebarSection>
    </div>
  );
};
