import React from 'react';
import { cn } from '../../../shared/utils/cn';
import { theme } from '../../../shared/theme';
import { formatBytes } from '../../../shared/utils/formatters';
import {
  TrashIcon,
  InformationCircleIcon,
  CheckCircleIcon,
  ArrowPathIcon,
  DocumentDuplicateIcon,
  CircleStackIcon,
  FolderIcon,
  GlobeAltIcon,
  CubeIcon,
  WrenchIcon,
} from '@heroicons/react/24/outline';
import type { MaintenanceInfo } from '../../../api/generated/models';
import {
  PRUNE_TYPES,
  allModeLabels,
  pruneDescription,
  pruneTypeLabels,
  removalRows,
  supportsAllMode,
  type PruneType,
} from '../pruneModes';

interface MaintenanceActionsTabProps {
  maintenanceInfo: MaintenanceInfo | undefined;
  selectedPruneType: PruneType;
  pruneAll: boolean;
  isPruning: boolean;
  isFetching: boolean;
  onPruneTypeChange: (type: PruneType) => void;
  onPruneAllChange: (pruneAll: boolean) => void;
  onStartPrune: () => void;
  onRefresh: () => void;
}

const pruneIcons: Record<PruneType, React.ComponentType<{ className?: string }>> = {
  images: DocumentDuplicateIcon,
  containers: CircleStackIcon,
  volumes: FolderIcon,
  networks: GlobeAltIcon,
  'build-cache': CubeIcon,
  system: WrenchIcon,
};

const pruneTaglines: Record<PruneType, string> = {
  images: 'Images no container uses',
  containers: 'Containers that are not running',
  volumes: 'Volumes no container mounts',
  networks: 'Networks with nothing attached',
  'build-cache': 'Cached build layers',
  system: 'Everything except volumes',
};

export const MaintenanceActionsTab: React.FC<MaintenanceActionsTabProps> = ({
  maintenanceInfo,
  selectedPruneType,
  pruneAll,
  isPruning,
  isFetching,
  onPruneTypeChange,
  onPruneAllChange,
  onStartPrune,
  onRefresh,
}) => {
  const selectedRows = removalRows(maintenanceInfo, selectedPruneType, pruneAll);
  const nothingToRemove = maintenanceInfo !== undefined && selectedRows.length === 0;
  const showKind = selectedPruneType === 'system';
  const showNotShared = selectedRows.some((row) => row.uniqueSize !== undefined);

  return (
    <div
      className={cn(
        theme.containers.panel,
        'p-6 rounded-lg shadow-sm border',
        theme.cards.sectionDivider
      )}
    >
      <h3 className={cn('text-lg font-medium mb-6 flex items-center', theme.text.strong)}>
        <TrashIcon className={cn('h-5 w-5 mr-2', theme.text.danger)} />
        Docker Cleanup
      </h3>

      <div className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
        {PRUNE_TYPES.map((type) => {
          const Icon = pruneIcons[type];
          const isSelected = selectedPruneType === type;
          const rows = removalRows(maintenanceInfo, type, isSelected && pruneAll);

          return (
            <button
              key={type}
              type="button"
              onClick={() => onPruneTypeChange(type)}
              aria-pressed={isSelected}
              className={cn(
                'w-full rounded-lg border-2 p-4 text-left transition-colors',
                isSelected
                  ? theme.selection.tile.selected
                  : cn(theme.selection.tile.unselected, theme.containers.panel)
              )}
            >
              <div className="flex items-start gap-3">
                <Icon
                  className={cn(
                    'mt-1 h-6 w-6 flex-shrink-0',
                    isSelected ? theme.text.info : theme.text.muted
                  )}
                />
                <div className="min-w-0 flex-1">
                  <h4
                    className={cn(
                      'font-medium',
                      isSelected ? theme.intent.info.textStrong : theme.text.strong
                    )}
                  >
                    {pruneTypeLabels[type]}
                  </h4>
                  <p className={cn('mt-1 text-sm', theme.text.muted)}>{pruneTaglines[type]}</p>
                  {maintenanceInfo && (
                    <p className={cn('mt-2 text-sm font-medium', theme.text.strong)}>
                      {rows.length === 0 ? (
                        <span className={theme.text.muted}>Nothing to remove</span>
                      ) : (
                        `${rows.length} to remove`
                      )}
                    </p>
                  )}
                </div>
                {isSelected && (
                  <CheckCircleIcon className={cn('h-5 w-5 flex-shrink-0', theme.text.info)} />
                )}
              </div>
            </button>
          );
        })}
      </div>

      {supportsAllMode(selectedPruneType) && (
        <div className={cn('mb-6 rounded-lg p-4', theme.surface.muted)}>
          <label htmlFor="prune-all" className="flex items-center gap-2">
            <input
              id="prune-all"
              type="checkbox"
              checked={pruneAll}
              onChange={(event) => onPruneAllChange(event.target.checked)}
              className="h-4 w-4 rounded border-zinc-300 text-blue-600 focus:ring-blue-500 dark:border-zinc-600"
              disabled={isPruning}
            />
            <span className={cn('text-sm', theme.text.strong)}>
              {allModeLabels[selectedPruneType]}
            </span>
          </label>
        </div>
      )}

      <div className={cn('mb-6 rounded-lg p-4', theme.intent.info.surface)}>
        <div className="flex items-start gap-3">
          <InformationCircleIcon className={cn('mt-0.5 h-5 w-5', theme.text.info)} />
          <div>
            <p className={cn('mb-1 text-sm font-medium', theme.intent.info.textStrong)}>
              {pruneTypeLabels[selectedPruneType]} cleanup
            </p>
            <p className={cn('text-sm', theme.intent.info.textMuted)}>
              {pruneDescription(selectedPruneType, pruneAll)}
            </p>
          </div>
        </div>
      </div>

      <div
        className={cn(
          'mb-6 overflow-hidden rounded-lg border',
          theme.cards.sectionDivider,
          theme.surface.muted
        )}
      >
        <div className={cn('border-b px-4 py-3', theme.cards.sectionDivider)}>
          <h4 className={cn('text-sm font-medium', theme.text.strong)}>
            {selectedRows.length === 0
              ? 'Nothing would be removed'
              : `These ${selectedRows.length} will be removed`}
          </h4>
        </div>
        {selectedRows.length > 0 && (
          <div className="max-h-80 overflow-y-auto">
            <table className="w-full text-sm">
              <thead className={cn('sticky top-0', theme.surface.muted)}>
                <tr className={cn('border-b text-left', theme.cards.sectionDivider)}>
                  {showKind && (
                    <th className={cn('px-4 py-2 font-medium', theme.text.muted)}>Kind</th>
                  )}
                  <th className={cn('px-4 py-2 font-medium', theme.text.muted)}>Name</th>
                  <th className={cn('px-4 py-2 text-right font-medium', theme.text.muted)}>Size</th>
                  {showNotShared && (
                    <th className={cn('px-4 py-2 text-right font-medium', theme.text.muted)}>
                      Not shared
                    </th>
                  )}
                </tr>
              </thead>
              <tbody>
                {selectedRows.map((row) => (
                  <tr
                    key={row.key}
                    className={cn('border-b last:border-0', theme.cards.sectionDivider)}
                  >
                    {showKind && (
                      <td className={cn('px-4 py-2 whitespace-nowrap', theme.text.muted)}>
                        {row.category}
                      </td>
                    )}
                    <td className="px-4 py-2">
                      <span className={cn('break-all', theme.text.strong)}>{row.name}</span>
                      {row.detail && (
                        <span className={cn('ml-2 font-mono text-xs', theme.text.muted)}>
                          {row.detail}
                        </span>
                      )}
                    </td>
                    <td className={cn('px-4 py-2 text-right whitespace-nowrap', theme.text.muted)}>
                      {row.size === undefined ? 'n/a' : formatBytes(row.size)}
                    </td>
                    {showNotShared && (
                      <td
                        className={cn('px-4 py-2 text-right whitespace-nowrap', theme.text.muted)}
                      >
                        {row.uniqueSize === undefined ? '' : formatBytes(row.uniqueSize)}
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="flex flex-col gap-3 sm:flex-row">
        <button
          onClick={onStartPrune}
          disabled={isPruning || nothingToRemove}
          className="flex flex-1 items-center justify-center rounded-lg bg-red-600 px-6 py-3 text-white transition-colors hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isPruning ? (
            <>
              <div className="mr-3 h-5 w-5 animate-spin rounded-full border-b-2 border-white"></div>
              Cleaning...
            </>
          ) : (
            <>
              <TrashIcon className="mr-3 h-5 w-5" />
              Remove {selectedRows.length} {selectedRows.length === 1 ? 'item' : 'items'}
            </>
          )}
        </button>

        <button
          onClick={onRefresh}
          disabled={isFetching || isPruning}
          className="flex items-center justify-center rounded-lg bg-zinc-600 px-6 py-3 text-white transition-colors hover:bg-zinc-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <ArrowPathIcon className={cn('mr-2 h-5 w-5', isFetching && 'animate-spin')} />
          Recalculate
        </button>
      </div>
    </div>
  );
};
