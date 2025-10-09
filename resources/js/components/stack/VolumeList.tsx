import { theme } from '../../theme';
import { Volume } from '../../types/stack';
import { cn } from '../../utils/cn';
import VolumeCard from './VolumeCard';

interface VolumeListProps {
  volumes: Volume[];
  isLoading?: boolean;
  error?: Error | null;
}

const SkeletonCard = () => (
  <div className={cn(theme.containers.cardSoft, 'animate-pulse')}>
    <div className={cn(theme.containers.sectionHeader, 'mb-4')}>
      <div className="flex items-center gap-3">
        <div className="h-8 w-8 rounded-lg bg-slate-200 dark:bg-slate-700" />
        <div>
          <div className="mb-2 h-4 w-32 rounded bg-slate-200 dark:bg-slate-700" />
          <div className="h-3 w-20 rounded bg-slate-200 dark:bg-slate-700" />
        </div>
      </div>
      <div className="h-6 w-16 rounded-full bg-slate-200 dark:bg-slate-700" />
    </div>
    <div className="space-y-3">
      <div className="h-3 w-24 rounded bg-slate-200 dark:bg-slate-700" />
      <div className="h-3 w-full rounded bg-slate-200 dark:bg-slate-700" />
      <div className="h-3 w-3/5 rounded bg-slate-200 dark:bg-slate-700" />
    </div>
  </div>
);

export const VolumeList = ({ volumes, isLoading, error }: VolumeListProps) => {
  if (isLoading) {
    return (
      <div className="space-y-4">
        {[0, 1, 2].map((index) => (
          <SkeletonCard key={index} />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="py-12 text-center">
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-red-100 dark:bg-red-900/20">
          <svg
            className="h-8 w-8 text-red-400"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
        </div>
        <h3 className={cn('text-lg font-medium', theme.text.strong)}>Error loading volumes</h3>
        <p className={cn('mt-2 text-sm', theme.text.subtle)}>
          {error?.message ?? 'An unknown error occurred'}
        </p>
      </div>
    );
  }

  if (!volumes || volumes.length === 0) {
    return (
      <div className="py-12 text-center">
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-slate-100 dark:bg-slate-800">
          <svg
            className="h-8 w-8 text-slate-400 dark:text-slate-600"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M5 19a2 2 0 01-2-2V7a2 2 0 012-2h4l2 2h4a2 2 0 012 2v1M5 19h14a2 2 0 002-2v-5a2 2 0 00-2-2H9a2 2 0 00-2 2v5a2 2 0 01-2 2z"
            />
          </svg>
        </div>
        <h3 className={cn('text-lg font-medium', theme.text.strong)}>No volumes found</h3>
        <p className={cn('mt-2 text-sm', theme.text.subtle)}>
          This stack doesn’t have any volumes configured.
        </p>
      </div>
    );
  }

  const activeVolumes = volumes.filter((volume) => volume.exists);
  const declaredVolumes = volumes.filter((volume) => !volume.exists);

  return (
    <div className="space-y-6">
      {activeVolumes.length > 0 && (
        <section>
          <h2 className={cn('text-lg font-semibold', theme.text.strong)}>
            Active Volumes ({activeVolumes.length})
          </h2>
          <div className="mt-4 space-y-4">
            {activeVolumes.map((volume) => (
              <VolumeCard key={volume.name} volume={volume} />
            ))}
          </div>
        </section>
      )}

      {declaredVolumes.length > 0 && (
        <section>
          <h2 className={cn('text-lg font-semibold', theme.text.strong)}>
            Declared Volumes ({declaredVolumes.length})
          </h2>
          <div className="mt-4 space-y-4">
            {declaredVolumes.map((volume) => (
              <VolumeCard key={volume.name} volume={volume} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
};

export default VolumeList;
