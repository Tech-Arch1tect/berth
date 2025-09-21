import { ExclamationTriangleIcon } from '@heroicons/react/24/outline';
import { HealthSummary } from './types/dashboard';

interface DashboardStatusAlertProps {
  healthSummary: HealthSummary;
}

export const DashboardStatusAlert: React.FC<DashboardStatusAlertProps> = ({ healthSummary }) => {
  if (healthSummary.serversWithErrors === 0 && healthSummary.serversLoading === 0) {
    return null;
  }

  return (
    <div className="mb-6 p-4 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800/50 rounded-xl">
      <div className="flex items-center space-x-3">
        <ExclamationTriangleIcon className="w-5 h-5 text-amber-600 dark:text-amber-400 flex-shrink-0" />
        <div>
          <p className="text-sm font-medium text-amber-800 dark:text-amber-200">
            {healthSummary.serversLoading > 0 && (
              <>
                Loading data from {healthSummary.serversLoading} server
                {healthSummary.serversLoading !== 1 ? 's' : ''}...
              </>
            )}
            {healthSummary.serversWithErrors > 0 && (
              <>
                {healthSummary.serversLoading > 0 ? ' ' : ''}
                Unable to connect to {healthSummary.serversWithErrors} server
                {healthSummary.serversWithErrors !== 1 ? 's' : ''}
              </>
            )}
          </p>
          <p className="text-xs text-amber-700 dark:text-amber-300 mt-1">
            Some statistics may be incomplete or outdated.
          </p>
        </div>
      </div>
    </div>
  );
};
