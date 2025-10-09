import { StackEnvironmentResponse } from '../../types/stack';
import EnvironmentVariableCard from './EnvironmentVariableCard';
import { EmptyState } from '../common/EmptyState';
import { LoadingSpinner } from '../common/LoadingSpinner';

interface EnvironmentVariableListProps {
  environmentData: StackEnvironmentResponse;
  isLoading?: boolean;
  error?: Error | null;
}

export const EnvironmentVariableList = ({
  environmentData,
  isLoading,
  error,
}: EnvironmentVariableListProps) => {
  if (isLoading) {
    return <LoadingSpinner text="Loading environment variables..." />;
  }

  if (error) {
    return (
      <EmptyState
        variant="error"
        title="Error loading environment variables"
        description={error?.message ?? 'An unknown error occurred'}
        icon={({ className }) => (
          <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
        )}
      />
    );
  }

  const serviceNames = Object.keys(environmentData ?? {});

  if (serviceNames.length === 0) {
    return (
      <EmptyState
        title="No environment variables found"
        description="This stack doesn't have any environment variables configured."
        icon={({ className }) => (
          <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4"
            />
          </svg>
        )}
      />
    );
  }

  const servicesWithVariables = serviceNames.filter((serviceName) =>
    environmentData[serviceName]?.some((env) => env.variables.length > 0)
  );

  if (servicesWithVariables.length === 0) {
    return (
      <EmptyState
        title="No environment variables found"
        description="This stack doesn't have any environment variables configured."
        icon={({ className }) => (
          <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4"
            />
          </svg>
        )}
      />
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
