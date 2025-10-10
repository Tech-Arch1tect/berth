import React from 'react';
import { ImageConfig } from '../../../types/stack';
import { cn } from '../../../utils/cn';
import { theme } from '../../../theme';

interface ImageConfigDetailsProps {
  config: ImageConfig;
}

export const ImageConfigDetails: React.FC<ImageConfigDetailsProps> = ({ config }) => {
  const exposedPorts = config.exposed_ports ? Object.keys(config.exposed_ports) : [];
  const hasConfig =
    config.user ||
    config.working_dir ||
    exposedPorts.length > 0 ||
    (config.cmd && config.cmd.length > 0) ||
    (config.entrypoint && config.entrypoint.length > 0);

  if (!hasConfig) {
    return null;
  }

  return (
    <div className={cn('rounded-lg p-4 space-y-3', theme.surface.muted)}>
      <h4 className={cn('text-sm font-medium', theme.text.strong)}>Configuration</h4>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
        {config.user && (
          <div>
            <span className={theme.text.muted}>User: </span>
            <code className={cn('font-mono px-1.5 py-0.5 rounded', theme.surface.code)}>
              {config.user}
            </code>
          </div>
        )}

        {config.working_dir && (
          <div>
            <span className={theme.text.muted}>Working Dir: </span>
            <code className={cn('font-mono px-1.5 py-0.5 rounded', theme.surface.code)}>
              {config.working_dir}
            </code>
          </div>
        )}

        {exposedPorts.length > 0 && (
          <div className="md:col-span-2">
            <span className={theme.text.muted}>Exposed Ports: </span>
            <div className="flex flex-wrap gap-1 mt-1">
              {exposedPorts.map((port) => (
                <span
                  key={port}
                  className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-pink-100 text-pink-800 dark:bg-pink-900/30 dark:text-pink-300"
                >
                  {port}
                </span>
              ))}
            </div>
          </div>
        )}

        {config.entrypoint && config.entrypoint.length > 0 && (
          <div className="md:col-span-2">
            <span className={theme.text.muted}>Entrypoint: </span>
            <code className={cn('font-mono px-1.5 py-0.5 rounded block mt-1', theme.surface.code)}>
              {config.entrypoint.join(' ')}
            </code>
          </div>
        )}

        {config.cmd && config.cmd.length > 0 && (
          <div className="md:col-span-2">
            <span className={theme.text.muted}>Command: </span>
            <code className={cn('font-mono px-1.5 py-0.5 rounded block mt-1', theme.surface.code)}>
              {config.cmd.join(' ')}
            </code>
          </div>
        )}
      </div>

      {config.labels && Object.keys(config.labels).length > 0 && (
        <div>
          <span className={cn('text-sm', theme.text.muted)}>
            Labels ({Object.keys(config.labels).length}):
          </span>
          <div className="mt-2 space-y-1 max-h-24 overflow-y-auto">
            {Object.entries(config.labels).map(([key, value]) => (
              <div key={key} className="text-xs">
                <code className={cn('font-mono', theme.text.standard)}>
                  {key}=<span className={theme.text.subtle}>{value}</span>
                </code>
              </div>
            ))}
          </div>
        </div>
      )}

      {config.env && config.env.length > 0 && (
        <div>
          <span className={cn('text-sm', theme.text.muted)}>
            Environment Variables ({config.env.length}):
          </span>
          <div className="mt-2 space-y-1 max-h-24 overflow-y-auto">
            {config.env.map((envVar, index) => (
              <div key={index} className="text-xs">
                <code className={cn('font-mono', theme.text.standard)}>{envVar}</code>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
