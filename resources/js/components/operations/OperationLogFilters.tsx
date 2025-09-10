import React from 'react';

interface OperationLogFiltersProps {
  searchTerm: string;
  selectedStatus: string;
  selectedCommand: string;
  uniqueCommands: string[];
  onSearchTermChange: (value: string) => void;
  onSelectedStatusChange: (value: string) => void;
  onSelectedCommandChange: (value: string) => void;
  onClearFilters: () => void;
}

export default function OperationLogFilters({
  searchTerm,
  selectedStatus,
  selectedCommand,
  uniqueCommands,
  onSearchTermChange,
  onSelectedStatusChange,
  onSelectedCommandChange,
  onClearFilters,
}: OperationLogFiltersProps) {
  return (
    <div className="mt-8 bg-white dark:bg-gray-800 shadow sm:rounded-lg">
      <div className="px-4 py-5 sm:p-6">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
          <div>
            <label
              htmlFor="search"
              className="block text-sm font-medium text-gray-700 dark:text-gray-300"
            >
              Search
            </label>
            <div className="mt-1">
              <input
                type="text"
                id="search"
                value={searchTerm}
                onChange={(e) => onSearchTermChange(e.target.value)}
                placeholder="Stack name, command, or operation ID..."
                className="shadow-sm focus:ring-indigo-500 focus:border-indigo-500 block w-full sm:text-sm border-gray-300 dark:border-gray-600 rounded-md dark:bg-gray-700 dark:text-white"
              />
            </div>
          </div>

          <div>
            <label
              htmlFor="status"
              className="block text-sm font-medium text-gray-700 dark:text-gray-300"
            >
              Status
            </label>
            <div className="mt-1">
              <select
                id="status"
                value={selectedStatus}
                onChange={(e) => onSelectedStatusChange(e.target.value)}
                className="shadow-sm focus:ring-indigo-500 focus:border-indigo-500 block w-full sm:text-sm border-gray-300 dark:border-gray-600 rounded-md dark:bg-gray-700 dark:text-white"
              >
                <option value="">All Statuses</option>
                <option value="incomplete">Incomplete</option>
                <option value="success">Success</option>
                <option value="failed">Failed</option>
                <option value="complete">Complete</option>
              </select>
            </div>
          </div>

          <div>
            <label
              htmlFor="command"
              className="block text-sm font-medium text-gray-700 dark:text-gray-300"
            >
              Command
            </label>
            <div className="mt-1">
              <select
                id="command"
                value={selectedCommand}
                onChange={(e) => onSelectedCommandChange(e.target.value)}
                className="shadow-sm focus:ring-indigo-500 focus:border-indigo-500 block w-full sm:text-sm border-gray-300 dark:border-gray-600 rounded-md dark:bg-gray-700 dark:text-white"
              >
                <option value="">All Commands</option>
                {uniqueCommands.map((command) => (
                  <option key={command} value={command}>
                    {command}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex items-end">
            <button
              onClick={onClearFilters}
              className="inline-flex items-center px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
            >
              Clear Filters
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
