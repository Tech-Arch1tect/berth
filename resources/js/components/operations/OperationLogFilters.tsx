import { theme } from '../../theme';
import { cn } from '../../utils/cn';

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
    <section className={cn('mt-8', theme.containers.panel)}>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
        <div>
          <label htmlFor="search" className={theme.forms.label}>
            Search
          </label>
          <div className="mt-1">
            <input
              type="text"
              id="search"
              value={searchTerm}
              onChange={(e) => onSearchTermChange(e.target.value)}
              placeholder="Stack name, command, or operation ID..."
              className={theme.forms.input}
            />
          </div>
        </div>

        <div>
          <label htmlFor="status" className={theme.forms.label}>
            Status
          </label>
          <div className="mt-1">
            <select
              id="status"
              value={selectedStatus}
              onChange={(e) => onSelectedStatusChange(e.target.value)}
              className={theme.forms.select}
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
          <label htmlFor="command" className={theme.forms.label}>
            Command
          </label>
          <div className="mt-1">
            <select
              id="command"
              value={selectedCommand}
              onChange={(e) => onSelectedCommandChange(e.target.value)}
              className={theme.forms.select}
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
          <button onClick={onClearFilters} className={theme.buttons.secondary}>
            Clear Filters
          </button>
        </div>
      </div>
    </section>
  );
}
