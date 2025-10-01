import React, { useState, useEffect } from 'react';
import { Head } from '@inertiajs/react';
import Layout from '../../components/Layout';
import FlashMessages from '../../components/FlashMessages';

interface SecurityAuditLog {
  id: number;
  event_type: string;
  event_category: string;
  severity: string;
  actor_user_id: number | null;
  actor_username: string;
  actor_ip: string;
  actor_user_agent: string;
  target_user_id: number | null;
  target_type: string;
  target_id: number | null;
  target_name: string;
  success: boolean;
  failure_reason: string;
  metadata: string;
  server_id: number | null;
  stack_name: string;
  session_id: string;
  created_at: string;
}

interface Stats {
  total_events: number;
  events_by_category: Record<string, number>;
  events_by_severity: Record<string, number>;
  failed_events: number;
  recent_event_types: Array<{ event_type: string; count: number }>;
  events_last_24_hours: number;
  events_last_7_days: number;
}

interface Props {
  title: string;
}

export default function SecurityAuditLogs({ title }: Props) {
  const [logs, setLogs] = useState<SecurityAuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<Stats | null>(null);
  const [selectedLog, setSelectedLog] = useState<SecurityAuditLog | null>(null);
  const [showDetails, setShowDetails] = useState(false);

  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [perPage, setPerPage] = useState(50);

  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [selectedSeverity, setSelectedSeverity] = useState('');
  const [selectedSuccess, setSelectedSuccess] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  const fetchLogs = async (page = 1) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        per_page: perPage.toString(),
        ...(searchTerm && { search: searchTerm }),
        ...(selectedCategory && { event_category: selectedCategory }),
        ...(selectedSeverity && { severity: selectedSeverity }),
        ...(selectedSuccess && { success: selectedSuccess }),
        ...(startDate && { start_date: new Date(startDate).toISOString() }),
        ...(endDate && { end_date: new Date(endDate).toISOString() }),
      });

      const response = await fetch(`/admin/api/security-audit-logs?${params}`);
      const data = await response.json();

      setLogs(data.logs || []);
      setTotal(data.total || 0);
      setTotalPages(data.total_pages || 1);
      setCurrentPage(data.page || 1);
    } catch (error) {
      console.error('Failed to fetch security logs:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchStats = async () => {
    try {
      const response = await fetch('/admin/api/security-audit-logs/stats');
      const data = await response.json();
      setStats(data);
    } catch (error) {
      console.error('Failed to fetch stats:', error);
    }
  };

  const fetchLogDetails = async (id: number) => {
    try {
      const response = await fetch(`/admin/api/security-audit-logs/${id}`);
      const data = await response.json();
      setSelectedLog(data);
      setShowDetails(true);
    } catch (error) {
      console.error('Failed to fetch log details:', error);
    }
  };

  useEffect(() => {
    fetchLogs(currentPage);
  }, [
    currentPage,
    perPage,
    searchTerm,
    selectedCategory,
    selectedSeverity,
    selectedSuccess,
    startDate,
    endDate,
  ]);

  useEffect(() => {
    fetchStats();
  }, []);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setCurrentPage(1);
    fetchLogs(1);
  };

  const handleReset = () => {
    setSearchTerm('');
    setSelectedCategory('');
    setSelectedSeverity('');
    setSelectedSuccess('');
    setStartDate('');
    setEndDate('');
    setCurrentPage(1);
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical':
        return 'text-red-800 bg-red-100 dark:text-red-200 dark:bg-red-900';
      case 'high':
        return 'text-orange-800 bg-orange-100 dark:text-orange-200 dark:bg-orange-900';
      case 'medium':
        return 'text-yellow-800 bg-yellow-100 dark:text-yellow-200 dark:bg-yellow-900';
      case 'low':
        return 'text-blue-800 bg-blue-100 dark:text-blue-200 dark:bg-blue-900';
      default:
        return 'text-gray-800 bg-gray-100 dark:text-gray-200 dark:bg-gray-700';
    }
  };

  const getCategoryColor = (category: string) => {
    switch (category) {
      case 'auth':
        return 'text-purple-800 bg-purple-100 dark:text-purple-200 dark:bg-purple-900';
      case 'user_mgmt':
        return 'text-indigo-800 bg-indigo-100 dark:text-indigo-200 dark:bg-indigo-900';
      case 'rbac':
        return 'text-pink-800 bg-pink-100 dark:text-pink-200 dark:bg-pink-900';
      case 'server':
        return 'text-green-800 bg-green-100 dark:text-green-200 dark:bg-green-900';
      case 'webhook':
        return 'text-cyan-800 bg-cyan-100 dark:text-cyan-200 dark:bg-cyan-900';
      case 'file':
        return 'text-amber-800 bg-amber-100 dark:text-amber-200 dark:bg-amber-900';
      default:
        return 'text-gray-800 bg-gray-100 dark:text-gray-200 dark:bg-gray-700';
    }
  };

  return (
    <Layout>
      <Head title={title} />
      <FlashMessages />

      <div className="container mx-auto px-4 py-6">
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Security Audit Logs</h1>
          <p className="mt-2 text-gray-600 dark:text-gray-400">
            Monitor and review security-relevant events
          </p>
        </div>

        {stats && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
            <div className="bg-white dark:bg-slate-800 p-4 rounded-lg shadow border border-gray-200 dark:border-slate-700">
              <div className="text-sm font-medium text-gray-600 dark:text-gray-400">
                Total Events
              </div>
              <div className="mt-1 text-2xl font-semibold text-gray-900 dark:text-white">
                {stats.total_events.toLocaleString()}
              </div>
            </div>
            <div className="bg-white dark:bg-slate-800 p-4 rounded-lg shadow border border-gray-200 dark:border-slate-700">
              <div className="text-sm font-medium text-gray-600 dark:text-gray-400">
                Failed Events
              </div>
              <div className="mt-1 text-2xl font-semibold text-red-600 dark:text-red-400">
                {stats.failed_events.toLocaleString()}
              </div>
            </div>
            <div className="bg-white dark:bg-slate-800 p-4 rounded-lg shadow border border-gray-200 dark:border-slate-700">
              <div className="text-sm font-medium text-gray-600 dark:text-gray-400">
                Last 24 Hours
              </div>
              <div className="mt-1 text-2xl font-semibold text-blue-600 dark:text-blue-400">
                {stats.events_last_24_hours.toLocaleString()}
              </div>
            </div>
            <div className="bg-white dark:bg-slate-800 p-4 rounded-lg shadow border border-gray-200 dark:border-slate-700">
              <div className="text-sm font-medium text-gray-600 dark:text-gray-400">
                Last 7 Days
              </div>
              <div className="mt-1 text-2xl font-semibold text-green-600 dark:text-green-400">
                {stats.events_last_7_days.toLocaleString()}
              </div>
            </div>
          </div>
        )}

        <div className="bg-white dark:bg-slate-800 rounded-lg shadow mb-6 border border-gray-200 dark:border-slate-700">
          <div className="p-4 border-b border-gray-200 dark:border-slate-700">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Filters</h2>
          </div>
          <div className="p-4">
            <form onSubmit={handleSearch} className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Search
                </label>
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Username, event type..."
                  className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-md bg-white dark:bg-slate-900 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Category
                </label>
                <select
                  value={selectedCategory}
                  onChange={(e) => setSelectedCategory(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-md bg-white dark:bg-slate-900 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">All Categories</option>
                  <option value="auth">Authentication</option>
                  <option value="user_mgmt">User Management</option>
                  <option value="rbac">RBAC</option>
                  <option value="server">Server</option>
                  <option value="webhook">Webhook</option>
                  <option value="file">File Operations</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Severity
                </label>
                <select
                  value={selectedSeverity}
                  onChange={(e) => setSelectedSeverity(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-md bg-white dark:bg-slate-900 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">All Severities</option>
                  <option value="critical">Critical</option>
                  <option value="high">High</option>
                  <option value="medium">Medium</option>
                  <option value="low">Low</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Status
                </label>
                <select
                  value={selectedSuccess}
                  onChange={(e) => setSelectedSuccess(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-md bg-white dark:bg-slate-900 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">All</option>
                  <option value="true">Success</option>
                  <option value="false">Failed</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Start Date
                </label>
                <input
                  type="datetime-local"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-md bg-white dark:bg-slate-900 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  End Date
                </label>
                <input
                  type="datetime-local"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-md bg-white dark:bg-slate-900 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </form>
            <div className="mt-4 flex gap-2">
              <button
                onClick={handleReset}
                className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-slate-700 border border-gray-300 dark:border-slate-600 rounded-md hover:bg-gray-50 dark:hover:bg-slate-600"
              >
                Reset Filters
              </button>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-800 rounded-lg shadow overflow-hidden border border-gray-200 dark:border-slate-700">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 dark:divide-slate-700">
              <thead className="bg-gray-50 dark:bg-slate-900">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Time
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Event
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Category
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Severity
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Actor
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Target
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    IP
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white dark:bg-slate-800 divide-y divide-gray-200 dark:divide-slate-700">
                {loading ? (
                  <tr>
                    <td
                      colSpan={9}
                      className="px-6 py-4 text-center text-gray-500 dark:text-gray-400"
                    >
                      Loading...
                    </td>
                  </tr>
                ) : logs.length === 0 ? (
                  <tr>
                    <td
                      colSpan={9}
                      className="px-6 py-4 text-center text-gray-500 dark:text-gray-400"
                    >
                      No logs found
                    </td>
                  </tr>
                ) : (
                  logs.map((log) => (
                    <tr key={log.id} className="hover:bg-gray-50 dark:hover:bg-slate-700">
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-300">
                        {new Date(log.created_at).toLocaleString()}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-300">
                        {log.event_type}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span
                          className={`px-2 py-1 text-xs font-medium rounded ${getCategoryColor(log.event_category)}`}
                        >
                          {log.event_category}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span
                          className={`px-2 py-1 text-xs font-medium rounded ${getSeverityColor(log.severity)}`}
                        >
                          {log.severity}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-300">
                        {log.actor_username || '-'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-300">
                        {log.target_name || '-'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {log.success ? (
                          <span className="px-2 py-1 text-xs font-medium text-green-800 bg-green-100 dark:text-green-200 dark:bg-green-900 rounded">
                            Success
                          </span>
                        ) : (
                          <span className="px-2 py-1 text-xs font-medium text-red-800 bg-red-100 dark:text-red-200 dark:bg-red-900 rounded">
                            Failed
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                        {log.actor_ip}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm">
                        <button
                          onClick={() => fetchLogDetails(log.id)}
                          className="text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300"
                        >
                          Details
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {totalPages > 1 && (
            <div className="px-6 py-4 bg-gray-50 dark:bg-slate-900 border-t border-gray-200 dark:border-slate-700 flex items-center justify-between">
              <div className="text-sm text-gray-700 dark:text-gray-300">
                Showing {(currentPage - 1) * perPage + 1} to{' '}
                {Math.min(currentPage * perPage, total)} of {total} results
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  className="px-3 py-1 text-sm border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-gray-700 dark:text-gray-300 rounded disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50 dark:hover:bg-slate-600"
                >
                  Previous
                </button>
                <span className="px-3 py-1 text-sm text-gray-700 dark:text-gray-300">
                  Page {currentPage} of {totalPages}
                </span>
                <button
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                  className="px-3 py-1 text-sm border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-gray-700 dark:text-gray-300 rounded disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50 dark:hover:bg-slate-600"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {showDetails && selectedLog && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-slate-800 rounded-lg max-w-3xl w-full max-h-[90vh] overflow-y-auto border border-gray-200 dark:border-slate-700">
            <div className="p-6 border-b border-gray-200 dark:border-slate-700 flex justify-between items-center">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Event Details</h3>
              <button
                onClick={() => setShowDetails(false)}
                className="text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            </div>
            <div className="p-6">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <div className="text-sm font-medium text-gray-500 dark:text-gray-400">
                    Event Type
                  </div>
                  <div className="mt-1 text-sm text-gray-900 dark:text-gray-300">
                    {selectedLog.event_type}
                  </div>
                </div>
                <div>
                  <div className="text-sm font-medium text-gray-500 dark:text-gray-400">
                    Category
                  </div>
                  <div className="mt-1">
                    <span
                      className={`px-2 py-1 text-xs font-medium rounded ${getCategoryColor(selectedLog.event_category)}`}
                    >
                      {selectedLog.event_category}
                    </span>
                  </div>
                </div>
                <div>
                  <div className="text-sm font-medium text-gray-500 dark:text-gray-400">
                    Severity
                  </div>
                  <div className="mt-1">
                    <span
                      className={`px-2 py-1 text-xs font-medium rounded ${getSeverityColor(selectedLog.severity)}`}
                    >
                      {selectedLog.severity}
                    </span>
                  </div>
                </div>
                <div>
                  <div className="text-sm font-medium text-gray-500 dark:text-gray-400">Status</div>
                  <div className="mt-1">
                    {selectedLog.success ? (
                      <span className="px-2 py-1 text-xs font-medium text-green-800 bg-green-100 dark:text-green-200 dark:bg-green-900 rounded">
                        Success
                      </span>
                    ) : (
                      <span className="px-2 py-1 text-xs font-medium text-red-800 bg-red-100 dark:text-red-200 dark:bg-red-900 rounded">
                        Failed
                      </span>
                    )}
                  </div>
                </div>
                <div>
                  <div className="text-sm font-medium text-gray-500 dark:text-gray-400">Actor</div>
                  <div className="mt-1 text-sm text-gray-900 dark:text-gray-300">
                    {selectedLog.actor_username || '-'}
                  </div>
                </div>
                <div>
                  <div className="text-sm font-medium text-gray-500 dark:text-gray-400">
                    Actor IP
                  </div>
                  <div className="mt-1 text-sm text-gray-900 dark:text-gray-300">
                    {selectedLog.actor_ip}
                  </div>
                </div>
                <div>
                  <div className="text-sm font-medium text-gray-500 dark:text-gray-400">Target</div>
                  <div className="mt-1 text-sm text-gray-900 dark:text-gray-300">
                    {selectedLog.target_name || '-'}
                  </div>
                </div>
                <div>
                  <div className="text-sm font-medium text-gray-500 dark:text-gray-400">
                    Target Type
                  </div>
                  <div className="mt-1 text-sm text-gray-900 dark:text-gray-300">
                    {selectedLog.target_type || '-'}
                  </div>
                </div>
                <div className="col-span-2">
                  <div className="text-sm font-medium text-gray-500 dark:text-gray-400">
                    Timestamp
                  </div>
                  <div className="mt-1 text-sm text-gray-900 dark:text-gray-300">
                    {new Date(selectedLog.created_at).toLocaleString()}
                  </div>
                </div>
                {selectedLog.failure_reason && (
                  <div className="col-span-2">
                    <div className="text-sm font-medium text-gray-500 dark:text-gray-400">
                      Failure Reason
                    </div>
                    <div className="mt-1 text-sm text-red-600 dark:text-red-400">
                      {selectedLog.failure_reason}
                    </div>
                  </div>
                )}
                {selectedLog.metadata && selectedLog.metadata !== '{}' && (
                  <div className="col-span-2">
                    <div className="text-sm font-medium text-gray-500 dark:text-gray-400">
                      Metadata
                    </div>
                    <pre className="mt-1 text-xs text-gray-900 dark:text-gray-300 bg-gray-50 dark:bg-slate-900 p-3 rounded overflow-x-auto">
                      {JSON.stringify(JSON.parse(selectedLog.metadata), null, 2)}
                    </pre>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </Layout>
  );
}
