import React from 'react';
import { StackEnvironmentResponse } from '../../types/stack';
import EnvironmentVariableCard from './EnvironmentVariableCard';

interface EnvironmentVariableListProps {
  environmentData: StackEnvironmentResponse;
  isLoading?: boolean;
  error?: Error | null;
}

const EnvironmentVariableList: React.FC<EnvironmentVariableListProps> = ({
  environmentData,
  isLoading,
  error,
}) => {
  if (isLoading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map((i) => (
          <div
            key={i}
            className="border border-gray-200 dark:border-gray-700 rounded-lg animate-pulse"
          >
            <div className="px-6 py-4 bg-gray-50 dark:bg-gray-700">
              <div className="flex items-center space-x-3">
                <div className="w-6 h-6 bg-gray-200 dark:bg-gray-600 rounded"></div>
                <div>
                  <div className="w-24 h-4 bg-gray-200 dark:bg-gray-600 rounded mb-1"></div>
                  <div className="w-16 h-3 bg-gray-200 dark:bg-gray-600 rounded"></div>
                </div>
              </div>
            </div>
            <div className="px-6 py-4 space-y-3">
              <div className="w-full h-4 bg-gray-200 dark:bg-gray-600 rounded"></div>
              <div className="w-3/4 h-4 bg-gray-200 dark:bg-gray-600 rounded"></div>
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-12">
        <div className="inline-flex items-center justify-center w-16 h-16 bg-red-100 dark:bg-red-900/20 rounded-full mb-4">
          <svg
            className="w-8 h-8 text-red-400"
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
        <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
          Error loading environment variables
        </h3>
        <p className="text-gray-500 dark:text-gray-400 mb-4">
          {error.message || 'An unknown error occurred'}
        </p>
      </div>
    );
  }

  const serviceNames = Object.keys(environmentData);

  if (serviceNames.length === 0) {
    return (
      <div className="text-center py-12">
        <div className="inline-flex items-center justify-center w-16 h-16 bg-gray-100 dark:bg-gray-800 rounded-full mb-4">
          <svg
            className="w-8 h-8 text-gray-400 dark:text-gray-600"
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
        <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
          No environment variables found
        </h3>
        <p className="text-gray-500 dark:text-gray-400">
          This stack doesn't have any environment variables configured.
        </p>
      </div>
    );
  }

  const servicesWithVariables = serviceNames.filter(
    (serviceName) =>
      environmentData[serviceName] &&
      environmentData[serviceName].some((env) => env.variables.length > 0)
  );

  if (servicesWithVariables.length === 0) {
    return (
      <div className="text-center py-12">
        <div className="inline-flex items-center justify-center w-16 h-16 bg-gray-100 dark:bg-gray-800 rounded-full mb-4">
          <svg
            className="w-8 h-8 text-gray-400 dark:text-gray-600"
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
        <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
          No environment variables found
        </h3>
        <p className="text-gray-500 dark:text-gray-400">
          This stack doesn't have any environment variables configured.
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
