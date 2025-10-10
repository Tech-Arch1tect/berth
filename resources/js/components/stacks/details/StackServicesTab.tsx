import React from 'react';
import { cn } from '../../../utils/cn';
import { theme } from '../../../theme';
import { ComposeService } from '../../../types/stack';
import { OperationRequest } from '../../../types/operations';
import { CompactServiceCard } from '../services/CompactServiceCard';
import { EmptyState } from '../../common/EmptyState';
import {
  ChevronDownIcon,
  ChevronUpIcon,
  CircleStackIcon,
  PencilSquareIcon,
} from '@heroicons/react/24/outline';

interface StackServicesTabProps {
  services: ComposeService[];
  onQuickOperation: (operation: OperationRequest) => void;
  quickOperationState: {
    isRunning: boolean;
    operation?: string;
  };
  expandedServices: Set<string>;
  onToggleExpand: (serviceName: string) => void;
  onExpandAll: () => void;
  onCollapseAll: () => void;
  canManageStack: boolean;
  onEditCompose: () => void;
}

export const StackServicesTab: React.FC<StackServicesTabProps> = ({
  services,
  onQuickOperation,
  quickOperationState,
  expandedServices,
  onToggleExpand,
  onExpandAll,
  onCollapseAll,
  canManageStack,
  onEditCompose,
}) => {
  if (!services || services.length === 0) {
    return (
      <EmptyState
        icon={CircleStackIcon}
        title="No services found"
        description="This stack doesn't have any services defined yet."
        variant="info"
        size="md"
      />
    );
  }

  return (
    <div className="space-y-4">
      {/* Expand All / Collapse All Controls */}
      <div className={cn('flex items-center justify-between pb-4', theme.cards.sectionDivider)}>
        <div className="flex items-center space-x-2">
          <h3 className={cn('text-lg font-semibold', theme.text.strong)}>
            Services ({services.length})
          </h3>
        </div>
        <div className="flex items-center space-x-2">
          {canManageStack && (
            <button
              onClick={onEditCompose}
              className={cn(
                'inline-flex items-center px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors',
                theme.intent.info.surface,
                'hover:bg-blue-100 dark:hover:bg-blue-900/30',
                theme.intent.info.textStrong,
                theme.intent.info.border
              )}
              title="Edit compose configuration"
            >
              <PencilSquareIcon className="w-3 h-3 mr-1" />
              Edit Compose
            </button>
          )}
          <button onClick={onExpandAll} className={cn(theme.buttons.subtle, theme.buttons.sm)}>
            <ChevronDownIcon className="w-3 h-3 mr-1" />
            Expand All
          </button>
          <button onClick={onCollapseAll} className={cn(theme.buttons.subtle, theme.buttons.sm)}>
            <ChevronUpIcon className="w-3 h-3 mr-1" />
            Collapse All
          </button>
        </div>
      </div>

      {services.map((service) => (
        <CompactServiceCard
          key={service.name}
          service={service}
          onQuickOperation={onQuickOperation}
          isOperationRunning={quickOperationState.isRunning}
          runningOperation={quickOperationState.operation}
          isExpanded={expandedServices.has(service.name)}
          onToggleExpand={() => onToggleExpand(service.name)}
        />
      ))}
    </div>
  );
};
