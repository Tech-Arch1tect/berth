import React from 'react';
import {
  MagnifyingGlassIcon,
  FunnelIcon,
  ArrowsUpDownIcon,
  MinusCircleIcon,
  ServerIcon,
} from '@heroicons/react/24/outline';
import { NegativeFilters } from './NegativeFilters';
import { cn } from '../../utils/cn';
import { theme } from '../../theme';
import { Server } from '../../types/server';

export type SortOption =
  | 'name-asc'
  | 'name-desc'
  | 'health-asc'
  | 'health-desc'
  | 'containers-asc'
  | 'containers-desc';

interface StacksFilterBarProps {
  searchTerm: string;
  onSearchChange: (value: string) => void;
  sortBy: SortOption;
  onSortChange: (value: SortOption) => void;
  healthFilter: 'all' | 'healthy' | 'unhealthy';
  onHealthFilterChange: (value: 'all' | 'healthy' | 'unhealthy') => void;
  serverFilter?: number | 'all';
  onServerFilterChange?: (value: number | 'all') => void;
  servers?: Server[];
  negativeFilters: string[];
  onNegativeFiltersChange: (filters: string[]) => void;
  showExclusionFilter: boolean;
  onToggleExclusionFilter: () => void;
  filteredCount: number;
  totalCount: number;
  searchPlaceholder?: string;
  rounded?: 'lg' | 'xl' | '2xl';
}

export const StacksFilterBar: React.FC<StacksFilterBarProps> = ({
  searchTerm,
  onSearchChange,
  sortBy,
  onSortChange,
  healthFilter,
  onHealthFilterChange,
  serverFilter,
  onServerFilterChange,
  servers,
  negativeFilters,
  onNegativeFiltersChange,
  showExclusionFilter,
  onToggleExclusionFilter,
  filteredCount,
  totalCount,
  searchPlaceholder = 'Search stacks...',
  rounded = 'lg',
}) => {
  const borderRadius =
    rounded === '2xl' ? 'rounded-2xl' : rounded === 'xl' ? 'rounded-xl' : 'rounded-lg';
  const inputRadius = rounded === '2xl' ? 'rounded-xl' : 'rounded-lg';

  return (
    <div
      className={cn(
        'space-y-4 mb-6 p-6',
        borderRadius,
        theme.surface.panel,
        theme.cards.translucent
      )}
    >
      <div className="relative">
        <MagnifyingGlassIcon className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400 dark:text-slate-400" />
        <input
          type="text"
          placeholder={searchPlaceholder}
          value={searchTerm}
          onChange={(e) => onSearchChange(e.target.value)}
          className={cn(
            'w-full pl-10 pr-4 py-2.5',
            inputRadius,
            'transition-all duration-200',
            theme.forms.input
          )}
        />
      </div>

      <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center">
        <div className="flex flex-wrap items-center gap-3 flex-1">
          <div className="relative flex-1 min-w-[180px]">
            <ArrowsUpDownIcon className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400 dark:text-slate-400" />
            <select
              value={sortBy}
              onChange={(e) => onSortChange(e.target.value as SortOption)}
              className={cn(
                'w-full pl-10 pr-8 py-2.5',
                inputRadius,
                'transition-all duration-200',
                theme.forms.select
              )}
            >
              <option value="name-asc">Name (A-Z)</option>
              <option value="name-desc">Name (Z-A)</option>
              <option value="health-asc">Health (Healthy First)</option>
              <option value="health-desc">Health (Unhealthy First)</option>
              <option value="containers-asc">Containers (Low-High)</option>
              <option value="containers-desc">Containers (High-Low)</option>
            </select>
          </div>

          <div className="relative flex-1 min-w-[160px]">
            <FunnelIcon className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400 dark:text-slate-400" />
            <select
              value={healthFilter}
              onChange={(e) =>
                onHealthFilterChange(e.target.value as 'all' | 'healthy' | 'unhealthy')
              }
              className={cn(
                'w-full pl-10 pr-8 py-2.5',
                inputRadius,
                'transition-all duration-200',
                theme.forms.select
              )}
            >
              <option value="all">All Health</option>
              <option value="healthy">Healthy Only</option>
              <option value="unhealthy">Unhealthy Only</option>
            </select>
          </div>

          {servers && onServerFilterChange && serverFilter !== undefined && (
            <div className="relative flex-1 min-w-[160px]">
              <ServerIcon className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400 dark:text-slate-400" />
              <select
                value={serverFilter}
                onChange={(e) =>
                  onServerFilterChange(e.target.value === 'all' ? 'all' : Number(e.target.value))
                }
                className={cn(
                  'w-full pl-10 pr-8 py-2.5',
                  inputRadius,
                  'transition-all duration-200',
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
          )}

          <button
            onClick={onToggleExclusionFilter}
            className={cn(
              'inline-flex items-center px-3 py-2.5',
              inputRadius,
              'transition-all duration-200 whitespace-nowrap',
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

        <span className={cn('text-sm whitespace-nowrap flex-shrink-0', theme.text.subtle)}>
          {filteredCount} of {totalCount}
        </span>
      </div>

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
  );
};
