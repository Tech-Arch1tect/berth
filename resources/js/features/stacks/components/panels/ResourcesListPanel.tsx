import type { FC, ReactNode } from 'react';
import type { Network, Volume } from '../../../../api/generated/models';
import {
  ChevronRightIcon,
  CircleStackIcon,
  Cog6ToothIcon,
  GlobeAltIcon,
} from '@heroicons/react/24/outline';

interface ResourcesListPanelProps {
  networks: Network[];
  volumes: Volume[];
  onSelectNetwork: (name: string) => void;
  onSelectVolume: (name: string) => void;
  onSelectEnvironment: () => void;
}

interface RowProps {
  icon: ReactNode;
  label: string;
  meta?: string;
  active?: boolean;
  onClick: () => void;
}

const Row: FC<RowProps> = ({ icon, label, meta, active, onClick }) => (
  <button
    type="button"
    onClick={onClick}
    className="flex min-h-[52px] w-full items-center gap-3 rounded-xl border border-zinc-200 bg-white px-4 py-3 text-left transition-colors hover:border-teal-400 dark:border-zinc-800 dark:bg-zinc-900 dark:hover:border-teal-600"
  >
    <span className="flex-shrink-0 text-zinc-400">{icon}</span>
    <div className="min-w-0 flex-1">
      <div className="truncate font-medium text-zinc-900 dark:text-zinc-100">{label}</div>
      {meta && <div className="text-xs text-zinc-500 dark:text-zinc-400">{meta}</div>}
    </div>
    {active === false && (
      <span className="flex-shrink-0 text-xs text-zinc-400 dark:text-zinc-500">inactive</span>
    )}
    <ChevronRightIcon className="h-5 w-5 flex-shrink-0 text-zinc-400" />
  </button>
);

const SectionHeading: FC<{ children: ReactNode }> = ({ children }) => (
  <div className="px-1 pb-1 pt-4 text-xs font-semibold uppercase tracking-wider text-zinc-400 dark:text-zinc-500">
    {children}
  </div>
);

export const ResourcesListPanel: FC<ResourcesListPanelProps> = ({
  networks,
  volumes,
  onSelectNetwork,
  onSelectVolume,
  onSelectEnvironment,
}) => {
  return (
    <div className="space-y-2 p-4">
      <SectionHeading>Networks</SectionHeading>
      {networks.length === 0 && (
        <div className="px-1 text-sm italic text-zinc-500 dark:text-zinc-400">
          No networks defined.
        </div>
      )}
      {networks.map((network) => (
        <Row
          key={network.name}
          icon={<GlobeAltIcon className="h-5 w-5" />}
          label={network.name}
          active={network.exists}
          onClick={() => onSelectNetwork(network.name)}
        />
      ))}

      <SectionHeading>Volumes</SectionHeading>
      {volumes.length === 0 && (
        <div className="px-1 text-sm italic text-zinc-500 dark:text-zinc-400">
          No volumes defined.
        </div>
      )}
      {volumes.map((volume) => (
        <Row
          key={volume.name}
          icon={<CircleStackIcon className="h-5 w-5" />}
          label={volume.name}
          active={volume.exists}
          onClick={() => onSelectVolume(volume.name)}
        />
      ))}

      <SectionHeading>Configuration</SectionHeading>
      <Row
        icon={<Cog6ToothIcon className="h-5 w-5" />}
        label="Environment Variables"
        onClick={onSelectEnvironment}
      />
    </div>
  );
};
