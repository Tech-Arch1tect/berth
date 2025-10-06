import React, { useState } from 'react';
import { ComposeService } from '../../types/stack';
import { ArrowLeftIcon, CheckIcon, PlusIcon, GlobeAltIcon } from '@heroicons/react/24/outline';

interface ServicePortsEditorProps {
  service: ComposeService;
  onUpdate: (serviceName: string, oldPort: string | undefined, newPort: string) => void;
  onBack: () => void;
}

export const ServicePortsEditor: React.FC<ServicePortsEditorProps> = ({
  service,
  onUpdate,
  onBack,
}) => {
  const [newPortMapping, setNewPortMapping] = useState('');
  const [selectedMapping, setSelectedMapping] = useState<string | null>(null);

  const currentPorts = service.containers?.[0]?.ports || [];

  const getPortString = (port: any): string => {
    if (port.public) {
      return `${port.public}:${port.private}/${port.type || 'tcp'}`;
    }
    return `${port.private}/${port.type || 'tcp'}`;
  };

  const handleAddPort = () => {
    if (!newPortMapping.trim()) return;
    onUpdate(service.name, undefined, newPortMapping.trim());
    setNewPortMapping('');
  };

  const isValidPortMapping = (mapping: string): boolean => {
    // Valid formats: "8080:80", "8080:80/tcp", "80/tcp"
    const pattern = /^(\d+:)?\d+(\/\w+)?$/;
    return pattern.test(mapping);
  };

  const commonPorts = [
    { port: '80', description: 'HTTP' },
    { port: '443', description: 'HTTPS' },
    { port: '3000', description: 'Development' },
    { port: '5432', description: 'PostgreSQL' },
    { port: '3306', description: 'MySQL' },
    { port: '6379', description: 'Redis' },
    { port: '27017', description: 'MongoDB' },
    { port: '8080', description: 'Alt HTTP' },
  ];

  return (
    <div className="p-8">
      <div className="max-w-3xl mx-auto">
        {/* Header */}
        <button
          onClick={onBack}
          className="flex items-center gap-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors mb-6"
        >
          <ArrowLeftIcon className="h-5 w-5" />
          Back
        </button>

        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <div className="rounded-lg bg-gradient-to-br from-blue-500 to-cyan-600 p-2 text-white">
              <GlobeAltIcon className="h-6 w-6" />
            </div>
            <h3 className="text-2xl font-bold text-gray-900 dark:text-white">Edit Ports</h3>
          </div>
          <p className="text-gray-600 dark:text-gray-400">
            Service: <span className="font-semibold">{service.name}</span>
          </p>
        </div>

        {/* Current Ports */}
        {currentPorts.length > 0 && (
          <div className="mb-8">
            <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">
              Current Port Mappings
            </h4>
            <div className="space-y-2">
              {currentPorts.map((port, index) => (
                <div
                  key={index}
                  className="flex items-center justify-between p-4 rounded-lg bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700"
                >
                  <div className="flex items-center gap-3">
                    <div className="flex items-center gap-2 font-mono text-sm">
                      {port.public && (
                        <>
                          <span className="px-2 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded">
                            {port.public}
                          </span>
                          <span className="text-gray-400">→</span>
                        </>
                      )}
                      <span className="px-2 py-1 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded">
                        {port.private}
                      </span>
                      <span className="text-xs text-gray-500 dark:text-gray-400">
                        {port.type || 'tcp'}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Add New Port */}
        <div className="p-6 rounded-xl bg-gradient-to-br from-blue-50 to-cyan-50 dark:from-blue-900/20 dark:to-cyan-900/20 border border-blue-200 dark:border-blue-800">
          <h4 className="text-sm font-semibold text-blue-900 dark:text-blue-300 mb-4">
            Add Port Mapping
          </h4>

          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Port Mapping
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={newPortMapping}
                onChange={(e) => setNewPortMapping(e.target.value)}
                placeholder="e.g., 8080:80 or 80/tcp"
                className={`flex-1 px-4 py-2 rounded-lg border ${
                  newPortMapping && !isValidPortMapping(newPortMapping)
                    ? 'border-red-300 dark:border-red-700'
                    : 'border-blue-300 dark:border-blue-700'
                } bg-white dark:bg-gray-900 text-gray-900 dark:text-white font-mono focus:ring-2 focus:ring-blue-500 focus:border-transparent`}
                onKeyPress={(e) => e.key === 'Enter' && handleAddPort()}
              />
              <button
                onClick={handleAddPort}
                disabled={!newPortMapping.trim() || !isValidPortMapping(newPortMapping)}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <PlusIcon className="h-5 w-5" />
              </button>
            </div>
            <p className="mt-2 text-xs text-gray-600 dark:text-gray-400">
              Format: <span className="font-mono">host_port:container_port/protocol</span>
              <br />
              Examples: <span className="font-mono">8080:80</span>,{' '}
              <span className="font-mono">3000:3000/tcp</span>
            </p>
          </div>

          {/* Common Ports Quick Select */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Quick Select
            </label>
            <div className="grid grid-cols-4 gap-2">
              {commonPorts.map(({ port, description }) => (
                <button
                  key={port}
                  onClick={() => setNewPortMapping(`${port}:${port}`)}
                  className="p-2 text-left rounded-lg bg-white dark:bg-gray-800 border border-blue-200 dark:border-blue-700 hover:border-blue-400 dark:hover:border-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/30 transition-colors"
                >
                  <div className="font-mono text-sm font-semibold text-gray-900 dark:text-white">
                    {port}
                  </div>
                  <div className="text-xs text-gray-500 dark:text-gray-400">{description}</div>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Help Section */}
        <div className="mt-6 p-4 rounded-lg bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700">
          <h5 className="text-sm font-semibold text-gray-900 dark:text-white mb-2">
            Port Mapping Guide
          </h5>
          <ul className="text-sm text-gray-600 dark:text-gray-400 space-y-1">
            <li>
              • <span className="font-mono">8080:80</span> - Map host port 8080 to container port 80
            </li>
            <li>
              • <span className="font-mono">80</span> - Expose container port 80 (random host port)
            </li>
            <li>
              • <span className="font-mono">443:443/tcp</span> - Explicit TCP protocol
            </li>
            <li>
              • <span className="font-mono">53:53/udp</span> - UDP protocol
            </li>
          </ul>
        </div>

        {/* Actions */}
        <div className="mt-8 flex items-center justify-end gap-3">
          <button
            onClick={onBack}
            className="px-6 py-2.5 text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
