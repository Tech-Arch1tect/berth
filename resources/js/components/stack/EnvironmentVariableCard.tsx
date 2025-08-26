import React from 'react';
import { ServiceEnvironment } from '../../types/stack';

interface EnvironmentVariableCardProps {
  serviceName: string;
  serviceEnvironments: ServiceEnvironment[];
}

const EnvironmentVariableCard: React.FC<EnvironmentVariableCardProps> = ({
  serviceName,
  serviceEnvironments,
}) => {
  const allVariables = serviceEnvironments.flatMap((env) => env.variables);
  const composeVariables = allVariables.filter((v) => v.source === 'compose');
  const runtimeOnlyVariables = allVariables.filter(
    (v) => v.source === 'runtime' && !composeVariables.some((cv) => cv.key === v.key)
  );

  const getVariableStatusColor = (source: string) => {
    return source === 'compose'
      ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-400'
      : 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400';
  };

  const getVariableIcon = (isSensitive: boolean) => {
    if (isSensitive) {
      return (
        <svg
          className="w-4 h-4 text-amber-500 dark:text-amber-400"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
          />
        </svg>
      );
    }
    return null;
  };

  return (
    <div className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
      <div className="px-6 py-4 bg-gray-50 dark:bg-gray-700 border-b border-gray-200 dark:border-gray-600">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="flex-shrink-0">
              <svg
                className="w-6 h-6 text-purple-500 dark:text-purple-400"
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
            <div>
              <h3 className="text-lg font-medium text-gray-900 dark:text-white">{serviceName}</h3>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                {allVariables.length} variable{allVariables.length !== 1 ? 's' : ''}
              </p>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            {composeVariables.length > 0 && (
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-400">
                {composeVariables.length} Compose
              </span>
            )}
            {runtimeOnlyVariables.length > 0 && (
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400">
                {runtimeOnlyVariables.length} Runtime
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="px-6 py-4">
        <div className="space-y-4">
          {composeVariables.length > 0 && (
            <div>
              <h4 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-3">
                Compose Variables ({composeVariables.length})
              </h4>
              <div className="space-y-2">
                {composeVariables.map((variable, index) => (
                  <div key={index} className="bg-gray-50 dark:bg-gray-800 rounded-md p-3">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center space-x-2 min-w-0 flex-1">
                        {getVariableIcon(variable.is_sensitive)}
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center space-x-2 mb-1">
                            <span className="font-medium text-gray-900 dark:text-white font-mono">
                              {variable.key}
                            </span>
                            <span
                              className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${getVariableStatusColor(variable.source)}`}
                            >
                              {variable.source}
                            </span>
                            {variable.is_sensitive && (
                              <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-amber-100 text-amber-800 dark:bg-amber-900/20 dark:text-amber-400">
                                Sensitive
                              </span>
                            )}
                            {variable.is_from_container && (
                              <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400">
                                Active in Container
                              </span>
                            )}
                          </div>
                          <div className="text-sm text-gray-600 dark:text-gray-400 font-mono break-all">
                            {variable.is_sensitive ? '***' : variable.value || '(empty)'}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {runtimeOnlyVariables.length > 0 && (
            <div>
              <h4 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-3">
                Runtime Only Variables ({runtimeOnlyVariables.length})
              </h4>
              <div className="space-y-2">
                {runtimeOnlyVariables.map((variable, index) => (
                  <div key={index} className="bg-gray-50 dark:bg-gray-800 rounded-md p-3">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center space-x-2 min-w-0 flex-1">
                        {getVariableIcon(variable.is_sensitive)}
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center space-x-2 mb-1">
                            <span className="font-medium text-gray-900 dark:text-white font-mono">
                              {variable.key}
                            </span>
                            <span
                              className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${getVariableStatusColor(variable.source)}`}
                            >
                              {variable.source}
                            </span>
                            {variable.is_sensitive && (
                              <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-amber-100 text-amber-800 dark:bg-amber-900/20 dark:text-amber-400">
                                Sensitive
                              </span>
                            )}
                          </div>
                          <div className="text-sm text-gray-600 dark:text-gray-400 font-mono break-all">
                            {variable.is_sensitive ? '***' : variable.value || '(empty)'}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default EnvironmentVariableCard;
