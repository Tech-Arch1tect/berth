import React from 'react';
import { ComposeService } from '../../types/stack';
import { OperationRequest } from '../../types/operations';

interface ServiceQuickActionsProps {
  service: ComposeService;
  onQuickOperation: (operation: OperationRequest) => void;
  disabled?: boolean;
  isOperationRunning?: boolean;
  runningOperation?: string;
}

export const ServiceQuickActions: React.FC<ServiceQuickActionsProps> = ({
  service,
  onQuickOperation,
  disabled = false,
  isOperationRunning = false,
  runningOperation,
}) => {
  const getServiceState = () => {
    if (!service.containers || service.containers.length === 0) {
      return 'no-containers';
    }

    const runningCount = service.containers.filter((c) => c.state === 'running').length;
    const stoppedCount = service.containers.filter(
      (c) => c.state === 'stopped' || c.state === 'exited'
    ).length;
    const notCreatedCount = service.containers.filter((c) => c.state === 'not created').length;
    const totalCount = service.containers.length;

    if (runningCount === totalCount) {
      return 'all-running';
    } else if (stoppedCount === totalCount) {
      return 'all-stopped';
    } else if (notCreatedCount === totalCount) {
      return 'all-not-created';
    } else if (runningCount > 0) {
      return 'mixed-running';
    } else if (notCreatedCount > 0) {
      return 'mixed-not-created';
    } else {
      return 'other';
    }
  };

  const serviceState = getServiceState();

  const handleAction = (command: 'start' | 'stop' | 'restart' | 'up' | 'down' | 'pull') => {
    onQuickOperation({
      command,
      options: [],
      services: [service.name],
    });
  };

  const isButtonDisabled = disabled || isOperationRunning;
  const isThisOperationRunning = (command: string) =>
    isOperationRunning && runningOperation === `${command}:${service.name}`;

  if (serviceState === 'no-containers') {
    return (
      <div className="flex items-center justify-center text-xs text-gray-400">No containers</div>
    );
  }

  return (
    <div className="flex items-center space-x-1">
      {/* Up button - always available for applying configuration changes */}
      <button
        onClick={() => handleAction('up')}
        disabled={isButtonDisabled}
        className="inline-flex items-center px-2 py-1 text-xs font-medium rounded-md text-purple-700 bg-purple-100 hover:bg-purple-200 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed dark:bg-purple-900/20 dark:text-purple-400 dark:hover:bg-purple-900/30"
        title={`Deploy/Update ${service.name} (applies configuration changes)`}
      >
        {isThisOperationRunning('up') ? (
          <svg className="w-3 h-3 mr-1 animate-spin" fill="none" viewBox="0 0 24 24">
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            ></circle>
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
            ></path>
          </svg>
        ) : (
          <svg
            className="w-3 h-3 mr-1"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            strokeWidth={2}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 19V5m-7 7l7-7 7 7" />
          </svg>
        )}
        {isThisOperationRunning('up') ? 'Deploying...' : 'Up'}
      </button>

      {/* Start button - only for stopped containers (not 'not created') */}
      {(serviceState === 'all-stopped' ||
        (serviceState === 'mixed-running' &&
          service.containers.some((c) => c.state === 'stopped' || c.state === 'exited'))) && (
        <button
          onClick={() => handleAction('start')}
          disabled={isButtonDisabled}
          className="inline-flex items-center px-2 py-1 text-xs font-medium rounded-md text-green-700 bg-green-100 hover:bg-green-200 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed dark:bg-green-900/20 dark:text-green-400 dark:hover:bg-green-900/30"
          title={`Start ${service.name}`}
        >
          {isThisOperationRunning('start') ? (
            <svg className="w-3 h-3 mr-1 animate-spin" fill="none" viewBox="0 0 24 24">
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              ></circle>
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
              ></path>
            </svg>
          ) : (
            <svg className="w-3 h-3 mr-1" fill="currentColor" viewBox="0 0 24 24">
              <path d="M8 5v14l11-7z" />
            </svg>
          )}
          {isThisOperationRunning('start') ? 'Starting...' : 'Start'}
        </button>
      )}

      {(serviceState === 'all-running' || serviceState === 'mixed-running') && (
        <button
          onClick={() => handleAction('stop')}
          disabled={isButtonDisabled}
          className="inline-flex items-center px-2 py-1 text-xs font-medium rounded-md text-red-700 bg-red-100 hover:bg-red-200 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed dark:bg-red-900/20 dark:text-red-400 dark:hover:bg-red-900/30"
          title={`Stop ${service.name}`}
        >
          {isThisOperationRunning('stop') ? (
            <svg className="w-3 h-3 mr-1 animate-spin" fill="none" viewBox="0 0 24 24">
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              ></circle>
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
              ></path>
            </svg>
          ) : (
            <svg className="w-3 h-3 mr-1" fill="currentColor" viewBox="0 0 24 24">
              <path d="M6 6h12v12H6z" />
            </svg>
          )}
          {isThisOperationRunning('stop') ? 'Stopping...' : 'Stop'}
        </button>
      )}

      {serviceState === 'all-running' && (
        <button
          onClick={() => handleAction('restart')}
          disabled={isButtonDisabled}
          className="inline-flex items-center px-2 py-1 text-xs font-medium rounded-md text-blue-700 bg-blue-100 hover:bg-blue-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed dark:bg-blue-900/20 dark:text-blue-400 dark:hover:bg-blue-900/30"
          title={`Restart ${service.name}`}
        >
          {isThisOperationRunning('restart') ? (
            <svg className="w-3 h-3 mr-1 animate-spin" fill="none" viewBox="0 0 24 24">
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              ></circle>
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
              ></path>
            </svg>
          ) : (
            <svg className="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
              />
            </svg>
          )}
          {isThisOperationRunning('restart') ? 'Restarting...' : 'Restart'}
        </button>
      )}

      {/* Down button - available when containers exist (not all 'not created') */}
      {serviceState !== 'all-not-created' &&
        service.containers &&
        service.containers.some((c) => c.state !== 'not created') && (
          <button
            onClick={() => handleAction('down')}
            disabled={isButtonDisabled}
            className="inline-flex items-center px-2 py-1 text-xs font-medium rounded-md text-orange-700 bg-orange-100 hover:bg-orange-200 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed dark:bg-orange-900/20 dark:text-orange-400 dark:hover:bg-orange-900/30"
            title={`Stop and remove ${service.name} containers`}
          >
            {isThisOperationRunning('down') ? (
              <svg className="w-3 h-3 mr-1 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                ></circle>
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                ></path>
              </svg>
            ) : (
              <svg
                className="w-3 h-3 mr-1"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                strokeWidth={2}
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 5v14m7-7l-7 7-7-7" />
              </svg>
            )}
            {isThisOperationRunning('down') ? 'Removing...' : 'Down'}
          </button>
        )}

      {/* Pull button - always available for updating images */}
      <button
        onClick={() => handleAction('pull')}
        disabled={isButtonDisabled}
        className="inline-flex items-center px-2 py-1 text-xs font-medium rounded-md text-gray-700 bg-gray-100 hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed dark:bg-gray-900/20 dark:text-gray-400 dark:hover:bg-gray-900/30"
        title={`Pull latest images for ${service.name}`}
      >
        {isThisOperationRunning('pull') ? (
          <svg className="w-3 h-3 mr-1 animate-spin" fill="none" viewBox="0 0 24 24">
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            ></circle>
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
            ></path>
          </svg>
        ) : (
          <svg
            className="w-3 h-3 mr-1"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            strokeWidth={2}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M9 19l3 3m0 0l3-3m-3 3V10" />
          </svg>
        )}
        {isThisOperationRunning('pull') ? 'Pulling...' : 'Pull'}
      </button>
    </div>
  );
};
