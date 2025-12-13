import { cn } from '../../utils/cn';
import { theme } from '../../theme';
import type { AuditLogFilters } from '../../hooks/useAuditLogFilters';

interface Props {
  values: AuditLogFilters;
  updateFilter: <K extends keyof AuditLogFilters>(key: K, value: AuditLogFilters[K]) => void;
  resetFilters: () => void;
}

export function SecurityAuditFilters({ values, updateFilter, resetFilters }: Props) {
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
  };

  return (
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
        <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className={theme.forms.label}>Search</label>
            <input
              type="text"
              value={values.searchTerm}
              onChange={(e) => updateFilter('searchTerm', e.target.value)}
              placeholder="Username, event type..."
              className={cn('w-full', theme.forms.input)}
            />
          </div>

          <div>
            <label className={theme.forms.label}>Category</label>
            <select
              value={values.selectedCategory}
              onChange={(e) => updateFilter('selectedCategory', e.target.value)}
              className={cn('w-full', theme.forms.select)}
            >
              <option value="all">All Categories</option>
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
              value={values.selectedSeverity}
              onChange={(e) => updateFilter('selectedSeverity', e.target.value)}
              className={cn('w-full', theme.forms.select)}
            >
              <option value="all">All Severities</option>
              <option value="critical">Critical</option>
              <option value="high">High</option>
              <option value="medium">Medium</option>
              <option value="low">Low</option>
            </select>
          </div>

          <div>
            <label className={theme.forms.label}>Status</label>
            <select
              value={values.selectedSuccess}
              onChange={(e) => updateFilter('selectedSuccess', e.target.value)}
              className={cn('w-full', theme.forms.select)}
            >
              <option value="all">All</option>
              <option value="true">Success</option>
              <option value="false">Failed</option>
            </select>
          </div>

          <div>
            <label className={theme.forms.label}>Start Date</label>
            <input
              type="datetime-local"
              value={values.startDate}
              onChange={(e) => updateFilter('startDate', e.target.value)}
              className={cn('w-full', theme.forms.input)}
            />
          </div>

          <div>
            <label className={theme.forms.label}>End Date</label>
            <input
              type="datetime-local"
              value={values.endDate}
              onChange={(e) => updateFilter('endDate', e.target.value)}
              className={cn('w-full', theme.forms.input)}
            />
          </div>
        </form>

        <div className="mt-4 flex gap-2">
          <button onClick={resetFilters} className={theme.buttons.secondary}>
            Reset Filters
          </button>
        </div>
      </div>
    </div>
  );
}
