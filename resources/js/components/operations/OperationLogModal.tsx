import React from 'react';

interface OperationLog {
  id: number;
  user_id: number;
  server_id: number;
  stack_name: string;
  operation_id: string;
  command: string;
  options: string;
  services: string;
  start_time: string;
  end_time: string | null;
  success: boolean | null;
  exit_code: number | null;
  duration_ms: number | null;
  created_at: string;
  updated_at: string;
  user_name: string;
  server_name: string;
  trigger_source: string;
  is_incomplete: boolean;
  formatted_date: string;
  message_count: number;
  partial_duration_ms: number | null;
}

interface OperationLogMessage {
  id: number;
  operation_log_id: number;
  message_type: string;
  message_data: string;
  timestamp: string;
  sequence_number: number;
  created_at: string;
  updated_at: string;
}

interface OperationLogDetail {
  log: OperationLog;
  messages: OperationLogMessage[];
}

interface OperationLogModalProps {
  selectedLog: OperationLogDetail | null;
  showDetails: boolean;
  showUser?: boolean;
  onClose: () => void;
  getStatusBadge: (log: OperationLog) => React.ReactElement;
  getOperationDuration: (log: OperationLog) => string;
}

export default function OperationLogModal({
  selectedLog,
  showDetails,
  showUser = true,
  onClose,
  getStatusBadge,
  getOperationDuration,
}: OperationLogModalProps) {
  if (!showDetails || !selectedLog) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex items-center justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
        <div
          className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity"
          onClick={onClose}
        />

        <div className="inline-block align-bottom bg-white dark:bg-gray-800 rounded-lg px-4 pt-5 pb-4 text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-4xl sm:w-full sm:p-6">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg leading-6 font-medium text-gray-900 dark:text-white">
              Operation Details
            </h3>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
            >
              ✕
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-500 dark:text-gray-400">
                  Operation ID
                </label>
                <div className="mt-1 text-sm font-mono text-gray-900 dark:text-white">
                  {selectedLog.log.operation_id}
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-500 dark:text-gray-400">
                  Command
                </label>
                <div className="mt-1 text-sm text-gray-900 dark:text-white">
                  {selectedLog.log.command}
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-500 dark:text-gray-400">
                  Stack
                </label>
                <div className="mt-1 text-sm text-gray-900 dark:text-white">
                  {selectedLog.log.stack_name}
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-500 dark:text-gray-400">
                  Status
                </label>
                <div className="mt-1">{getStatusBadge(selectedLog.log)}</div>
              </div>
            </div>

            <div className="space-y-3">
              {showUser && (
                <div>
                  <label className="block text-sm font-medium text-gray-500 dark:text-gray-400">
                    User
                  </label>
                  <div className="mt-1 text-sm text-gray-900 dark:text-white">
                    {selectedLog.log.user_name}
                  </div>
                </div>
              )}
              <div>
                <label className="block text-sm font-medium text-gray-500 dark:text-gray-400">
                  Server
                </label>
                <div className="mt-1 text-sm text-gray-900 dark:text-white">
                  {selectedLog.log.server_name}
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-500 dark:text-gray-400">
                  Trigger Source
                </label>
                <div className="mt-1">
                  <span className="inline-flex items-center px-2 py-1 rounded-md text-xs font-medium bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200">
                    👤 Manual
                  </span>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-500 dark:text-gray-400">
                  Duration
                </label>
                <div className="mt-1 text-sm text-gray-900 dark:text-white">
                  {getOperationDuration(selectedLog.log)}
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-500 dark:text-gray-400">
                  Exit Code
                </label>
                <div className="mt-1 text-sm text-gray-900 dark:text-white">
                  {selectedLog.log.exit_code ?? 'N/A'}
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-500 dark:text-gray-400">
                  Started
                </label>
                <div className="mt-1 text-sm text-gray-900 dark:text-white">
                  {selectedLog.log.formatted_date}
                </div>
              </div>
            </div>
          </div>

          {selectedLog.log.options && (
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-500 dark:text-gray-400 mb-2">
                Options
              </label>
              <div className="bg-gray-50 dark:bg-gray-700 rounded-md p-3">
                <pre className="text-xs text-gray-700 dark:text-gray-300 whitespace-pre-wrap">
                  {(() => {
                    try {
                      const parsed = JSON.parse(selectedLog.log.options);
                      return JSON.stringify(parsed, null, 2);
                    } catch (e) {
                      return selectedLog.log.options;
                    }
                  })()}
                </pre>
              </div>
            </div>
          )}

          {selectedLog.log.services && (
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-500 dark:text-gray-400 mb-2">
                Services
              </label>
              <div className="bg-gray-50 dark:bg-gray-700 rounded-md p-3">
                <pre className="text-xs text-gray-700 dark:text-gray-300 whitespace-pre-wrap">
                  {(() => {
                    try {
                      const parsed = JSON.parse(selectedLog.log.services);
                      return JSON.stringify(parsed, null, 2);
                    } catch (e) {
                      return selectedLog.log.services;
                    }
                  })()}
                </pre>
              </div>
            </div>
          )}

          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-500 dark:text-gray-400 mb-2">
              Messages ({selectedLog.messages.length})
            </label>
            <div className="bg-black rounded-md p-4 max-h-96 overflow-y-auto">
              {selectedLog.messages.length === 0 ? (
                <div className="text-gray-400 text-sm">No messages recorded</div>
              ) : (
                <div className="space-y-1">
                  {selectedLog.messages.map((message) => (
                    <div key={message.id} className="text-sm">
                      <span className="text-gray-400 font-mono text-xs">
                        [{new Date(message.timestamp).toLocaleTimeString()}]
                      </span>
                      <span
                        className={`ml-2 ${
                          message.message_type === 'error'
                            ? 'text-red-400'
                            : message.message_type === 'stdout'
                              ? 'text-green-400'
                              : 'text-white'
                        }`}
                      >
                        {message.message_data}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="flex justify-end">
            <button
              onClick={onClose}
              className="bg-gray-600 py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
