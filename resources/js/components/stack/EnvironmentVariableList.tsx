import { theme } from '../../theme';
import { StackEnvironmentResponse } from '../../types/stack';
import { cn } from '../../utils/cn';
import EnvironmentVariableCard from './EnvironmentVariableCard';

interface EnvironmentVariableListProps {
  environmentData: StackEnvironmentResponse;
  isLoading?: boolean;
  error?: Error | null;
}

const LoadingSkeleton = () => (
  <div className={cn(theme.containers.cardSoft, 'animate-pulse')}>
    <div className={cn(theme.containers.sectionHeader, 'mb-4')}>
      <div className="h-5 w-32 rounded bg-slate-200 dark:bg-slate-700" />
      <div className="h-5 w-16 rounded bg-slate-200 dark:bg-slate-700" />
    </div>
    <div className="space-y-3">
      <div className="h-3 w-full rounded bg-slate-200 dark:bg-slate-700" />
      <div className="h-3 w-3/4 rounded bg-slate-200 dark:bg-slate-700" />
      <div className="h-3 w-1/2 rounded bg-slate-200 dark:bg-slate-700" />
    </div>
  </div>
);

export const EnvironmentVariableList = ({
  environmentData,
  isLoading,
  error,
}: EnvironmentVariableListProps) => {
  if (isLoading) {
    return (
      <div className="space-y-4">
        {[0, 1, 2].map((index) => (
          <LoadingSkeleton key={index} />
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
        <h3 className={cn('text-lg font-medium', theme.text.strong)}>
          Error loading environment variables
        </h3>
        <p className={cn('mt-2 text-sm', theme.text.subtle)}>
          {error?.message ?? 'An unknown error occurred'}
        </p>
      </div>
    );
  }

  const serviceNames = Object.keys(environmentData ?? {});

  if (serviceNames.length === 0) {
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
              d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4"
            />
          </svg>
        </div>
        <h3 className={cn('text-lg font-medium', theme.text.strong)}>
          No environment variables found
        </h3>
        <p className={cn('mt-2 text-sm', theme.text.subtle)}>
          This stack doesn’t have any environment variables configured.
        </p>
      </div>
    );
  }

  const servicesWithVariables = serviceNames.filter((serviceName) =>
    environmentData[serviceName]?.some((env) => env.variables.length > 0)
  );

  if (servicesWithVariables.length === 0) {
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
              d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4"
            />
          </svg>
        </div>
        <h3 className={cn('text-lg font-medium', theme.text.strong)}>
          No environment variables found
        </h3>
        <p className={cn('mt-2 text-sm', theme.text.subtle)}>
          This stack doesn’t have any environment variables configured.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {servicesWithVariables.sort().map((serviceName) => (
        <EnvironmentVariableCard
          key={serviceName}
          serviceName={serviceName}
          serviceEnvironments={environmentData[serviceName]}
        />
      ))}
    </div>
  );
};

export default EnvironmentVariableList;
