import React from 'react';
import { ImageConfig } from '../../types/stack';

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
    <div className="bg-slate-50 dark:bg-slate-800/50 rounded-lg p-4 space-y-3">
      <h4 className="text-sm font-medium text-slate-900 dark:text-white">Configuration</h4>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
        {config.user && (
          <div>
            <span className="text-slate-600 dark:text-slate-400">User: </span>
            <code className="font-mono text-slate-900 dark:text-white bg-white dark:bg-slate-700 px-1.5 py-0.5 rounded">
              {config.user}
            </code>
          </div>
        )}

        {config.working_dir && (
          <div>
            <span className="text-slate-600 dark:text-slate-400">Working Dir: </span>
            <code className="font-mono text-slate-900 dark:text-white bg-white dark:bg-slate-700 px-1.5 py-0.5 rounded">
              {config.working_dir}
            </code>
          </div>
        )}

        {exposedPorts.length > 0 && (
          <div className="md:col-span-2">
            <span className="text-slate-600 dark:text-slate-400">Exposed Ports: </span>
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
            <span className="text-slate-600 dark:text-slate-400">Entrypoint: </span>
            <code className="font-mono text-slate-900 dark:text-white bg-white dark:bg-slate-700 px-1.5 py-0.5 rounded block mt-1">
              {config.entrypoint.join(' ')}
            </code>
          </div>
        )}

        {config.cmd && config.cmd.length > 0 && (
          <div className="md:col-span-2">
            <span className="text-slate-600 dark:text-slate-400">Command: </span>
            <code className="font-mono text-slate-900 dark:text-white bg-white dark:bg-slate-700 px-1.5 py-0.5 rounded block mt-1">
              {config.cmd.join(' ')}
            </code>
          </div>
        )}
      </div>

      {config.labels && Object.keys(config.labels).length > 0 && (
        <div>
          <span className="text-slate-600 dark:text-slate-400 text-sm">
            Labels ({Object.keys(config.labels).length}):
          </span>
          <div className="mt-2 space-y-1 max-h-24 overflow-y-auto">
            {Object.entries(config.labels).map(([key, value]) => (
              <div key={key} className="text-xs">
                <code className="font-mono text-slate-700 dark:text-slate-300">
                  {key}=<span className="text-slate-500 dark:text-slate-400">{value}</span>
                </code>
              </div>
            ))}
          </div>
        </div>
      )}

      {config.env && config.env.length > 0 && (
        <div>
          <span className="text-slate-600 dark:text-slate-400 text-sm">
            Environment Variables ({config.env.length}):
          </span>
          <div className="mt-2 space-y-1 max-h-24 overflow-y-auto">
            {config.env.map((envVar, index) => (
              <div key={index} className="text-xs">
                <code className="font-mono text-slate-700 dark:text-slate-300">{envVar}</code>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
