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
  is_incomplete: boolean;
  formatted_date: string;
  message_count: number;
  partial_duration_ms: number | null;
}

interface PaginationInfo {
  current_page: number;
  page_size: number;
  total: number;
  total_pages: number;
  has_next: boolean;
  has_prev: boolean;
}

interface OperationLogTableProps {
  logs: OperationLog[];
  loading: boolean;
  pagination: PaginationInfo | null;
  currentPage: number;
  showUser?: boolean;
  onViewDetails: (logId: number) => void;
  onPageChange: (page: number) => void;
  getStatusBadge: (log: OperationLog) => JSX.Element;
  getOperationDuration: (log: OperationLog) => string;
}

export default function OperationLogTable({
  logs,
  loading,
  pagination,
  currentPage,
  showUser = true,
  onViewDetails,
  onPageChange,
  getStatusBadge,
  getOperationDuration,
}: OperationLogTableProps) {
  return (
    <>
      {/* Operation Logs Table */}
      <div className="mt-8 flex flex-col">
        <div className="-my-2 -mx-4 overflow-x-auto sm:-mx-6 lg:-mx-8">
          <div className="inline-block min-w-full py-2 align-middle md:px-6 lg:px-8">
            <div className="overflow-hidden shadow ring-1 ring-black dark:ring-white ring-opacity-5 dark:ring-opacity-10 md:rounded-lg">
              <table className="min-w-full divide-y divide-gray-300 dark:divide-gray-600">
                <thead className="bg-gray-50 dark:bg-gray-800">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                      Operation
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                      Stack
                    </th>
                    {showUser && (
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                        User/Server
                      </th>
                    )}
                    {!showUser && (
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                        Server
                      </th>
                    )}
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                      Duration
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                      Started
                    </th>
                    <th scope="col" className="relative px-6 py-3">
                      <span className="sr-only">Actions</span>
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white dark:bg-gray-900 divide-y divide-gray-200 dark:divide-gray-700">
                  {loading ? (
                    <tr>
                      <td colSpan={showUser ? 7 : 6} className="px-6 py-4 text-center">
                        <div className="text-sm text-gray-500 dark:text-gray-400">Loading...</div>
                      </td>
                    </tr>
                  ) : logs.length === 0 ? (
                    <tr>
                      <td colSpan={showUser ? 7 : 6} className="px-6 py-4 text-center">
                        <div className="text-sm text-gray-500 dark:text-gray-400">
                          No operation logs found.
                        </div>
                      </td>
                    </tr>
                  ) : (
                    logs.map((log) => (
                      <tr key={log.id}>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm font-medium text-gray-900 dark:text-white">
                            {log.command}
                          </div>
                          <div className="text-sm text-gray-500 dark:text-gray-400 font-mono">
                            {log.operation_id.slice(-8)}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm text-gray-900 dark:text-white">
                            {log.stack_name}
                          </div>
                        </td>
                        {showUser ? (
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm text-gray-900 dark:text-white">
                              {log.user_name}
                            </div>
                            <div className="text-sm text-gray-500 dark:text-gray-400">
                              {log.server_name}
                            </div>
                          </td>
                        ) : (
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm text-gray-900 dark:text-white">
                              {log.server_name}
                            </div>
                          </td>
                        )}
                        <td className="px-6 py-4 whitespace-nowrap">
                          {getStatusBadge(log)}
                          {log.exit_code !== null && (
                            <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                              Exit: {log.exit_code}
                            </div>
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                          {getOperationDuration(log)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                          {log.formatted_date}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                          <button
                            onClick={() => onViewDetails(log.id)}
                            className="text-indigo-600 dark:text-indigo-400 hover:text-indigo-900 dark:hover:text-indigo-300"
                          >
                            View Details
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>

      {/* Pagination */}
      {pagination && pagination.total_pages > 1 && (
        <div className="mt-4 flex items-center justify-between">
          <div className="text-sm text-gray-700 dark:text-gray-300">
            Showing {(pagination.current_page - 1) * pagination.page_size + 1} to{' '}
            {Math.min(pagination.current_page * pagination.page_size, pagination.total)} of{' '}
            {pagination.total} results
          </div>
          <div className="flex space-x-2">
            <button
              onClick={() => onPageChange(currentPage - 1)}
              disabled={!pagination.has_prev}
              className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Previous
            </button>
            <span className="px-3 py-2 text-sm text-gray-700 dark:text-gray-300">
              Page {pagination.current_page} of {pagination.total_pages}
            </span>
            <button
              onClick={() => onPageChange(currentPage + 1)}
              disabled={!pagination.has_next}
              className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </>
  );
}
