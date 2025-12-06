import React, { useState } from 'react';
import { ServiceEnvironment } from '../../../types/stack';
import { Cog6ToothIcon, MagnifyingGlassIcon } from '@heroicons/react/24/outline';
import { cn } from '../../../utils/cn';
import { theme } from '../../../theme';

interface EnvironmentPanelProps {
  environment: Record<string, ServiceEnvironment[]>;
}

export const EnvironmentPanel: React.FC<EnvironmentPanelProps> = ({ environment }) => {
  const [searchQuery, setSearchQuery] = useState('');

  const serviceNames = Object.keys(environment);
  const totalVars = serviceNames.reduce(
    (sum, name) => sum + (environment[name]?.[0]?.variables?.length || 0),
    0
  );

  const filterVariables = (variables: ServiceEnvironment['variables']) => {
    if (!searchQuery) return variables;
    const query = searchQuery.toLowerCase();
    return variables.filter(
      (v) => v.key.toLowerCase().includes(query) || v.value.toLowerCase().includes(query)
    );
  };

  return (
    <div className="h-full overflow-auto p-6">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <div>
          <h2 className={cn('text-xl font-bold', theme.text.strong)}>Environment Variables</h2>
          <p className={cn('text-sm', theme.text.subtle)}>
            {totalVars} variables across {serviceNames.length} services
          </p>
        </div>

        {/* Search */}
        <div className="relative">
          <MagnifyingGlassIcon
            className={cn('w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2', theme.text.subtle)}
          />
          <input
            type="text"
            placeholder="Search variables..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className={cn(
              'w-full pl-10 pr-4 py-2 rounded-lg border',
              'border-zinc-200 dark:border-zinc-700',
              'bg-white dark:bg-zinc-800',
              theme.text.standard,
              'placeholder:text-zinc-400 dark:placeholder:text-zinc-500',
              'focus:outline-none focus:ring-2 focus:ring-teal-500'
            )}
          />
        </div>

        {/* Services */}
        {serviceNames.length > 0 ? (
          <div className="space-y-4">
            {serviceNames.map((serviceName) => {
              const serviceEnv = environment[serviceName]?.[0];
              if (!serviceEnv?.variables?.length) return null;

              const filteredVars = filterVariables(serviceEnv.variables);
              if (filteredVars.length === 0 && searchQuery) return null;

              return (
                <div
                  key={serviceName}
                  className={cn(
                    'rounded-lg border',
                    'border-zinc-200 dark:border-zinc-800',
                    'bg-white dark:bg-zinc-900'
                  )}
                >
                  <div
                    className={cn(
                      'px-4 py-3 border-b flex items-center justify-between',
                      'border-zinc-200 dark:border-zinc-800',
                      theme.surface.muted
                    )}
                  >
                    <div className="flex items-center gap-2">
                      <Cog6ToothIcon className={cn('w-4 h-4', theme.text.subtle)} />
                      <span className={cn('font-semibold', theme.text.strong)}>{serviceName}</span>
                    </div>
                    <span className={cn('text-xs', theme.text.muted)}>
                      {filteredVars.length} variable{filteredVars.length !== 1 ? 's' : ''}
                    </span>
                  </div>
                  <div className="divide-y divide-zinc-100 dark:divide-zinc-800">
                    {filteredVars.map((variable) => (
                      <div key={variable.key} className="px-4 py-2 flex items-start gap-4">
                        <span className={cn('font-mono text-sm flex-shrink-0', theme.text.strong)}>
                          {variable.key}
                        </span>
                        <span
                          className={cn('font-mono text-sm break-all flex-1', theme.text.muted)}
                        >
                          {variable.value || <span className="text-zinc-400 italic">(empty)</span>}
                        </span>
                        <span
                          className={cn(
                            'text-xs px-1.5 py-0.5 rounded flex-shrink-0',
                            variable.source === 'compose'
                              ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400'
                              : 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400'
                          )}
                        >
                          {variable.source}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center h-64 text-center">
            <Cog6ToothIcon className={cn('w-12 h-12 mb-4', theme.text.subtle)} />
            <p className={cn('text-lg font-medium', theme.text.muted)}>No environment variables</p>
            <p className={cn('text-sm', theme.text.subtle)}>
              No environment variables defined for this stack
            </p>
          </div>
        )}
      </div>
    </div>
  );
};
