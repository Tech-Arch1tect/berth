import type { FC } from 'react';
import { KeyIcon } from '@heroicons/react/24/outline';
import { cn } from '../../../utils/cn';
import { theme } from '../../../theme';

interface RegistryCredential {
  id: number;
  registry_url: string;
  stack_pattern: string;
}

interface RegistriesSidebarProps {
  credentials: RegistryCredential[];
}

export const RegistriesSidebar: FC<RegistriesSidebarProps> = ({ credentials }) => {
  const credentialsByRegistry = credentials.reduce(
    (acc, cred) => {
      acc[cred.registry_url] = (acc[cred.registry_url] || 0) + 1;
      return acc;
    },
    {} as Record<string, number>
  );

  return (
    <div className="space-y-6">
      {/* Summary Section */}
      <div>
        <h3 className={cn('text-sm font-semibold mb-3', theme.text.strong)}>Summary</h3>
        <div className="space-y-2">
          <div
            className={cn(
              'flex items-center justify-between py-2 px-3 rounded-lg',
              theme.surface.subtle
            )}
          >
            <span className={cn('text-sm', theme.text.standard)}>Total Credentials</span>
            <span className={cn('text-sm font-semibold', theme.text.strong)}>
              {credentials.length}
            </span>
          </div>
        </div>
      </div>

      {/* By Registry Section */}
      {Object.keys(credentialsByRegistry).length > 0 && (
        <div>
          <h3 className={cn('text-sm font-semibold mb-3', theme.text.strong)}>By Registry</h3>
          <div className="space-y-2">
            {Object.entries(credentialsByRegistry)
              .sort((a, b) => b[1] - a[1])
              .map(([registry, count]) => (
                <div
                  key={registry}
                  className={cn(
                    'flex items-center justify-between py-2 px-3 rounded-lg',
                    theme.surface.subtle
                  )}
                >
                  <div className="flex items-center space-x-2 min-w-0">
                    <KeyIcon className={cn('w-4 h-4 flex-shrink-0', theme.text.info)} />
                    <span className={cn('text-sm truncate', theme.text.standard)} title={registry}>
                      {registry}
                    </span>
                  </div>
                  <span className={cn('text-sm font-semibold ml-2', theme.text.strong)}>
                    {count}
                  </span>
                </div>
              ))}
          </div>
        </div>
      )}
    </div>
  );
};
