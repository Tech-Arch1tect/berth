import type { FC } from 'react';
import type { ComposeService, ImageUpdate } from '../../../../api/generated/models';
import { ChevronRightIcon, CubeIcon } from '@heroicons/react/24/outline';
import { UpdateAvailableBadge } from '../../../image-updates/components/UpdateAvailableBadge';
import { serviceUpdateCount } from '../../../image-updates/updateMatching';

interface ServicesListPanelProps {
  services: ComposeService[];
  imageUpdates?: ImageUpdate[];
  onSelect: (serviceName: string) => void;
}

export const ServicesListPanel: FC<ServicesListPanelProps> = ({
  services,
  imageUpdates,
  onSelect,
}) => {
  if (services.length === 0) {
    return (
      <div className="p-6 text-sm italic text-zinc-500 dark:text-zinc-400">
        No services defined.
      </div>
    );
  }

  return (
    <div className="space-y-2 p-4">
      {services.map((service) => (
        <button
          key={service.name}
          type="button"
          onClick={() => onSelect(service.name)}
          className="flex min-h-[56px] w-full items-center gap-3 rounded-xl border border-zinc-200 bg-white px-4 py-3 text-left transition-colors hover:border-teal-400 dark:border-zinc-800 dark:bg-zinc-900 dark:hover:border-teal-600"
        >
          <CubeIcon className="h-5 w-5 flex-shrink-0 text-zinc-400" />
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <span className="truncate font-medium text-zinc-900 dark:text-zinc-100">
                {service.name}
              </span>
              <UpdateAvailableBadge
                count={serviceUpdateCount(imageUpdates, service)}
                variant="compact"
              />
            </div>
            <div className="text-xs text-zinc-500 dark:text-zinc-400">
              {service.containers?.length ?? 0} container
              {(service.containers?.length ?? 0) === 1 ? '' : 's'}
            </div>
          </div>
          <ChevronRightIcon className="h-5 w-5 flex-shrink-0 text-zinc-400" />
        </button>
      ))}
    </div>
  );
};
