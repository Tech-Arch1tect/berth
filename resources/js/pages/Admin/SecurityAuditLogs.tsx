import React, { useState, useEffect } from 'react';
import { Head } from '@inertiajs/react';
import Layout from '../../components/layout/Layout';
import FlashMessages from '../../components/FlashMessages';
import { Modal } from '../../components/common/Modal';
import { Table, Column } from '../../components/common/Table';
import { cn } from '../../utils/cn';
import { theme } from '../../theme';

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
        return cn(theme.badges.tag.base, theme.badges.tag.danger);
      case 'high':
        return cn(theme.badges.tag.base, theme.badges.tag.warning);
      case 'medium':
        return cn(theme.badges.tag.base, theme.badges.tag.warning);
      case 'low':
        return cn(theme.badges.tag.base, theme.badges.tag.info);
      default:
        return cn(theme.badges.tag.base, theme.badges.tag.neutral);
    }
  };

  const getCategoryColor = (category: string) => {
    switch (category) {
      case 'auth':
        return cn(theme.badges.tag.base, theme.badges.tag.info);
      case 'user_mgmt':
        return cn(theme.badges.tag.base, theme.badges.tag.info);
      case 'rbac':
        return cn(theme.badges.tag.base, theme.badges.tag.warning);
      case 'server':
        return cn(theme.badges.tag.base, theme.badges.tag.success);
      case 'file':
        return cn(theme.badges.tag.base, theme.badges.tag.warning);
      default:
        return cn(theme.badges.tag.base, theme.badges.tag.neutral);
    }
  };

  return (
    <Layout>
      <Head title={title} />
      <FlashMessages />

      <div className="container mx-auto px-4 py-6">
        <div className="mb-6">
          <h1 className={cn('text-3xl font-bold', theme.text.strong)}>Security Audit Logs</h1>
          <p className={cn('mt-2', theme.text.muted)}>
            Monitor and review security-relevant events
          </p>
        </div>

        {stats && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
            <div
              className={cn(
                theme.surface.panel,
                'p-4 rounded-lg shadow border border-slate-200 dark:border-slate-700'
              )}
            >
              <div className={cn('text-sm font-medium', theme.text.muted)}>Total Events</div>
              <div className={cn('mt-1 text-2xl font-semibold', theme.text.strong)}>
                {stats.total_events.toLocaleString()}
              </div>
            </div>
            <div
              className={cn(
                theme.surface.panel,
                'p-4 rounded-lg shadow border border-slate-200 dark:border-slate-700'
              )}
            >
              <div className={cn('text-sm font-medium', theme.text.muted)}>Failed Events</div>
              <div className={cn('mt-1 text-2xl font-semibold', theme.text.danger)}>
                {stats.failed_events.toLocaleString()}
              </div>
            </div>
            <div
              className={cn(
                theme.surface.panel,
                'p-4 rounded-lg shadow border border-slate-200 dark:border-slate-700'
              )}
            >
              <div className={cn('text-sm font-medium', theme.text.muted)}>Last 24 Hours</div>
              <div className={cn('mt-1 text-2xl font-semibold', theme.text.info)}>
                {stats.events_last_24_hours.toLocaleString()}
              </div>
            </div>
            <div
              className={cn(
                theme.surface.panel,
                'p-4 rounded-lg shadow border border-slate-200 dark:border-slate-700'
              )}
            >
              <div className={cn('text-sm font-medium', theme.text.muted)}>Last 7 Days</div>
              <div className={cn('mt-1 text-2xl font-semibold', theme.text.success)}>
                {stats.events_last_7_days.toLocaleString()}
              </div>
            </div>
          </div>
        )}

        <div
          className={cn(
            theme.surface.panel,
            'rounded-lg shadow mb-6 border border-slate-200 dark:border-slate-700'
          )}
        >
          <div className="p-4 border-b border-slate-200 dark:border-slate-700">
            <h2 className={cn('text-lg font-semibold', theme.text.strong)}>Filters</h2>
          </div>
          <div className="p-4">
            <form onSubmit={handleSearch} className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className={theme.forms.label}>Search</label>
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Username, event type..."
                  className={cn('w-full', theme.forms.input)}
                />
              </div>
              <div>
                <label className={theme.forms.label}>Category</label>
                <select
                  value={selectedCategory}
                  onChange={(e) => setSelectedCategory(e.target.value)}
                  className={cn('w-full', theme.forms.select)}
                >
                  <option value="">All Categories</option>
                  <option value="auth">Authentication</option>
                  <option value="user_mgmt">User Management</option>
                  <option value="rbac">RBAC</option>
                  <option value="server">Server</option>
                  <option value="file">File Operations</option>
                </select>
              </div>
              <div>
                <label className={theme.forms.label}>Severity</label>
                <select
                  value={selectedSeverity}
                  onChange={(e) => setSelectedSeverity(e.target.value)}
                  className={cn('w-full', theme.forms.select)}
                >
                  <option value="">All Severities</option>
                  <option value="critical">Critical</option>
                  <option value="high">High</option>
                  <option value="medium">Medium</option>
                  <option value="low">Low</option>
                </select>
              </div>
              <div>
                <label className={theme.forms.label}>Status</label>
                <select
                  value={selectedSuccess}
                  onChange={(e) => setSelectedSuccess(e.target.value)}
                  className={cn('w-full', theme.forms.select)}
                >
                  <option value="">All</option>
                  <option value="true">Success</option>
                  <option value="false">Failed</option>
                </select>
              </div>
              <div>
                <label className={theme.forms.label}>Start Date</label>
                <input
                  type="datetime-local"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className={cn('w-full', theme.forms.input)}
                />
              </div>
              <div>
                <label className={theme.forms.label}>End Date</label>
                <input
                  type="datetime-local"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className={cn('w-full', theme.forms.input)}
                />
              </div>
            </form>
            <div className="mt-4 flex gap-2">
              <button onClick={handleReset} className={theme.buttons.secondary}>
                Reset Filters
              </button>
            </div>
          </div>
        </div>

        <div
          className={cn(
            theme.surface.panel,
            'rounded-lg shadow overflow-hidden border border-slate-200 dark:border-slate-700'
          )}
        >
          <Table<SecurityAuditLog>
            data={logs}
            keyExtractor={(log) => log.id.toString()}
            isLoading={loading}
            emptyMessage="No logs found"
            columns={[
              {
                key: 'time',
                header: 'Time',
                render: (log) => (
                  <span className={cn('text-sm', theme.text.standard)}>
                    {new Date(log.created_at).toLocaleString()}
                  </span>
                ),
              },
              {
                key: 'event',
                header: 'Event',
                render: (log) => (
                  <span className={cn('text-sm', theme.text.standard)}>{log.event_type}</span>
                ),
              },
              {
                key: 'category',
                header: 'Category',
                render: (log) => (
                  <span
                    className={`px-2 py-1 text-xs font-medium rounded ${getCategoryColor(log.event_category)}`}
                  >
                    {log.event_category}
                  </span>
                ),
              },
              {
                key: 'severity',
                header: 'Severity',
                render: (log) => (
                  <span
                    className={`px-2 py-1 text-xs font-medium rounded ${getSeverityColor(log.severity)}`}
                  >
                    {log.severity}
                  </span>
                ),
              },
              {
                key: 'actor',
                header: 'Actor',
                render: (log) => (
                  <span className={cn('text-sm', theme.text.standard)}>
                    {log.actor_username || '-'}
                  </span>
                ),
              },
              {
                key: 'target',
                header: 'Target',
                render: (log) => (
                  <span className={cn('text-sm', theme.text.standard)}>
                    {log.target_name || '-'}
                  </span>
                ),
              },
              {
                key: 'status',
                header: 'Status',
                render: (log) =>
                  log.success ? (
                    <span className={cn(theme.badges.tag.base, theme.badges.tag.success)}>
                      Success
                    </span>
                  ) : (
                    <span className={cn(theme.badges.tag.base, theme.badges.tag.danger)}>
                      Failed
                    </span>
                  ),
              },
              {
                key: 'ip',
                header: 'IP',
                render: (log) => (
                  <span className={cn('text-sm', theme.text.subtle)}>{log.actor_ip}</span>
                ),
              },
              {
                key: 'actions',
                header: 'Actions',
                render: (log) => (
                  <button
                    onClick={() => fetchLogDetails(log.id)}
                    className={cn('hover:underline', theme.text.info)}
                  >
                    Details
                  </button>
                ),
              },
            ]}
          />

          {totalPages > 1 && (
            <div className="px-6 py-4 bg-slate-50 dark:bg-slate-900 border-t border-slate-200 dark:border-slate-700 flex items-center justify-between">
              <div className={cn('text-sm', theme.text.standard)}>
                Showing {(currentPage - 1) * perPage + 1} to{' '}
                {Math.min(currentPage * perPage, total)} of {total} results
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  className={cn(
                    'px-3 py-1 text-sm rounded disabled:opacity-50 disabled:cursor-not-allowed',
                    theme.buttons.secondary
                  )}
                >
                  Previous
                </button>
                <span className={cn('px-3 py-1 text-sm', theme.text.standard)}>
                  Page {currentPage} of {totalPages}
                </span>
                <button
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                  className={cn(
                    'px-3 py-1 text-sm rounded disabled:opacity-50 disabled:cursor-not-allowed',
                    theme.buttons.secondary
                  )}
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      <Modal
        isOpen={showDetails && selectedLog !== null}
        onClose={() => setShowDetails(false)}
        title="Event Details"
        size="lg"
      >
        {selectedLog && (
          <div className="grid grid-cols-2 gap-4">
            <div>
              <div className={cn('text-sm font-medium', theme.text.subtle)}>Event Type</div>
              <div className={cn('mt-1 text-sm', theme.text.standard)}>
                {selectedLog.event_type}
              </div>
            </div>
            <div>
              <div className={cn('text-sm font-medium', theme.text.subtle)}>Category</div>
              <div className="mt-1">
                <span
                  className={cn(
                    'px-2 py-1 text-xs font-medium rounded',
                    getCategoryColor(selectedLog.event_category)
                  )}
                >
                  {selectedLog.event_category}
                </span>
              </div>
            </div>
            <div>
              <div className={cn('text-sm font-medium', theme.text.subtle)}>Severity</div>
              <div className="mt-1">
                <span
                  className={cn(
                    'px-2 py-1 text-xs font-medium rounded',
                    getSeverityColor(selectedLog.severity)
                  )}
                >
                  {selectedLog.severity}
                </span>
              </div>
            </div>
            <div>
              <div className={cn('text-sm font-medium', theme.text.subtle)}>Status</div>
              <div className="mt-1">
                {selectedLog.success ? (
                  <span className={cn(theme.badges.tag.base, theme.badges.tag.success)}>
                    Success
                  </span>
                ) : (
                  <span className={cn(theme.badges.tag.base, theme.badges.tag.danger)}>Failed</span>
                )}
              </div>
            </div>
            <div>
              <div className={cn('text-sm font-medium', theme.text.subtle)}>Actor</div>
              <div className={cn('mt-1 text-sm', theme.text.standard)}>
                {selectedLog.actor_username || '-'}
              </div>
            </div>
            <div>
              <div className={cn('text-sm font-medium', theme.text.subtle)}>Actor IP</div>
              <div className={cn('mt-1 text-sm', theme.text.standard)}>{selectedLog.actor_ip}</div>
            </div>
            <div>
              <div className={cn('text-sm font-medium', theme.text.subtle)}>Target</div>
              <div className={cn('mt-1 text-sm', theme.text.standard)}>
                {selectedLog.target_name || '-'}
              </div>
            </div>
            <div>
              <div className={cn('text-sm font-medium', theme.text.subtle)}>Target Type</div>
              <div className={cn('mt-1 text-sm', theme.text.standard)}>
                {selectedLog.target_type || '-'}
              </div>
            </div>
            <div className="col-span-2">
              <div className={cn('text-sm font-medium', theme.text.subtle)}>Timestamp</div>
              <div className={cn('mt-1 text-sm', theme.text.standard)}>
                {new Date(selectedLog.created_at).toLocaleString()}
              </div>
            </div>
            {selectedLog.failure_reason && (
              <div className="col-span-2">
                <div className={cn('text-sm font-medium', theme.text.subtle)}>Failure Reason</div>
                <div className={cn('mt-1 text-sm', theme.text.danger)}>
                  {selectedLog.failure_reason}
                </div>
              </div>
            )}
            {selectedLog.metadata && selectedLog.metadata !== '{}' && (
              <div className="col-span-2">
                <div className={cn('text-sm font-medium', theme.text.subtle)}>Metadata</div>
                <pre
                  className={cn(
                    'mt-1 text-xs p-3 rounded overflow-x-auto',
                    theme.surface.code,
                    theme.text.standard
                  )}
                >
                  {JSON.stringify(JSON.parse(selectedLog.metadata), null, 2)}
                </pre>
              </div>
            )}
          </div>
        )}
      </Modal>
    </Layout>
  );
}
