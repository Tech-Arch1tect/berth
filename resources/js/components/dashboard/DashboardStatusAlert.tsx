import { ExclamationTriangleIcon } from '@heroicons/react/24/outline';
import { cn } from '../../utils/cn';
import { theme } from '../../theme';
import { HealthSummary } from './types/dashboard';

interface DashboardStatusAlertProps {
  healthSummary: HealthSummary;
}

export const DashboardStatusAlert = ({ healthSummary }: DashboardStatusAlertProps) => {
  if (healthSummary.serversWithErrors === 0 && healthSummary.serversLoading === 0) {
    return null;
  }

  return (
    <div
      className={cn(
        'mb-6 rounded-xl border p-4',
        theme.intent.warning.border,
        theme.intent.warning.surface
      )}
    >
      <div className="flex items-center gap-3">
        <ExclamationTriangleIcon
          className={cn('h-5 w-5 flex-shrink-0', theme.intent.warning.textStrong)}
        />
        <div>
          <p className={cn('text-sm font-medium', theme.intent.warning.textStrong)}>
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
          <p className={cn('mt-1 text-xs', theme.intent.warning.textMuted)}>
            Some statistics may be incomplete or outdated.
          </p>
        </div>
      </div>
    </div>
  );
};
