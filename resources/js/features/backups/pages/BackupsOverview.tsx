import { useState } from 'react';
import { Link } from '@tanstack/react-router';
import {
  ArchiveBoxIcon,
  ChevronDownIcon,
  ChevronRightIcon,
  ExclamationTriangleIcon,
} from '@heroicons/react/24/outline';
import { cn } from '../../../shared/utils/cn';
import { theme } from '../../../shared/theme';
import { LoadingSpinner } from '../../../shared/components/LoadingSpinner';
import { EmptyState } from '../../../shared/components/EmptyState';
import { useDocumentTitle } from '../../../shared/hooks/useDocumentTitle';
import { formatBytes, formatRelativeTime } from '../../../shared/utils/formatters';
import { useGetApiV1Backups } from '../../../api/generated/backups/backups';
import type { ServerBackups, StackBackupSummary } from '../../../api/generated/models';
import { OrphanedStackBackups } from '../components/OrphanedStackBackups';

const stackLine = (stack: StackBackupSummary) => {
  if (stack.run_count === 0) return 'Never backed up';
  const latest = stack.latest_run;
  const when = latest?.started_at ? formatRelativeTime(latest.started_at) : 'unknown';
  const runs = `${stack.run_count} ${stack.run_count === 1 ? 'backup' : 'backups'}`;
  const size = stack.repo_size_bytes ? ` · ${formatBytes(stack.repo_size_bytes)} on disk` : '';
  return `${runs} · latest ${when}${size}`;
};

function ServerSection({ server }: { server: ServerBackups }) {
  const [expanded, setExpanded] = useState<string | null>(null);
  const orphaned = server.stacks.filter((stack) => !stack.stack_exists);
  const live = server.stacks.filter((stack) => stack.stack_exists);

  return (
    <section
      className={cn(
        theme.containers.panel,
        'mb-6 overflow-hidden rounded-lg border',
        theme.cards.sectionDivider
      )}
    >
      <div
        className={cn(
          'flex flex-wrap items-center justify-between gap-2 border-b px-4 py-3',
          theme.cards.sectionDivider
        )}
      >
        <h2 className={cn('text-base font-medium', theme.text.strong)}>{server.server_name}</h2>
        <span className={cn('text-sm', theme.text.muted)}>
          {!server.enabled && 'Backups not enabled for this server'}
          {server.enabled && !server.configured && 'The agent has no backup location configured'}
          {server.enabled && server.configured && `${server.stacks.length} stacks`}
        </span>
      </div>

      {server.error && <p className={cn('px-4 py-3 text-sm', theme.text.danger)}>{server.error}</p>}

      {!server.error && server.stacks.length === 0 && (
        <p className={cn('px-4 py-3 text-sm', theme.text.muted)}>
          No stacks you can read backups for.
        </p>
      )}

      {orphaned.length > 0 && (
        <div className={cn('border-b', theme.cards.sectionDivider, theme.intent.warning.surface)}>
          <p
            className={cn(
              'flex items-center gap-2 px-4 py-2 text-sm font-medium',
              theme.intent.warning.textStrong
            )}
          >
            <ExclamationTriangleIcon className="h-4 w-4" />
            {orphaned.length}{' '}
            {orphaned.length === 1 ? 'stack no longer exists' : 'stacks no longer exist'}, but their
            backups remain
          </p>
          <ul>
            {orphaned.map((stack) => (
              <li key={stack.stack_name} className={cn('border-t', theme.cards.sectionDivider)}>
                <button
                  type="button"
                  onClick={() =>
                    setExpanded(expanded === stack.stack_name ? null : stack.stack_name)
                  }
                  aria-expanded={expanded === stack.stack_name}
                  className="flex w-full items-center gap-2 px-4 py-3 text-left"
                >
                  {expanded === stack.stack_name ? (
                    <ChevronDownIcon className={cn('h-4 w-4 flex-shrink-0', theme.text.muted)} />
                  ) : (
                    <ChevronRightIcon className={cn('h-4 w-4 flex-shrink-0', theme.text.muted)} />
                  )}
                  <span className="min-w-0 flex-1">
                    <span className={cn('block truncate font-medium', theme.text.strong)}>
                      {stack.stack_name}
                    </span>
                    <span className={cn('block text-sm', theme.text.muted)}>
                      {stackLine(stack)}
                    </span>
                  </span>
                </button>
                {expanded === stack.stack_name && (
                  <OrphanedStackBackups serverid={server.server_id} stackname={stack.stack_name} />
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      <ul>
        {live.map((stack) => (
          <li
            key={stack.stack_name}
            className={cn('border-t first:border-t-0', theme.cards.sectionDivider)}
          >
            <Link
              to="/servers/$serverid/stacks/$stackname"
              params={{ serverid: String(server.server_id), stackname: stack.stack_name }}
              className="flex items-center justify-between gap-3 px-4 py-3 hover:bg-zinc-50 dark:hover:bg-zinc-800/50"
            >
              <span className="min-w-0">
                <span className={cn('block truncate font-medium', theme.text.strong)}>
                  {stack.stack_name}
                </span>
                <span className={cn('block text-sm', theme.text.muted)}>{stackLine(stack)}</span>
              </span>
              <ChevronRightIcon className={cn('h-4 w-4 flex-shrink-0', theme.text.muted)} />
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

export default function BackupsOverview() {
  useDocumentTitle('Backups');
  const { data, isLoading, error, refetch } = useGetApiV1Backups();
  const servers = data?.data?.servers ?? [];

  return (
    <div className="h-full overflow-auto">
      <div className="px-4 py-6 sm:px-6 lg:px-8">
        <h1 className={cn('mb-6 text-2xl font-bold sm:text-3xl', theme.text.strong)}>Backups</h1>

        {isLoading && <LoadingSpinner size="lg" text="Reading backup coverage..." />}

        {Boolean(error) && !isLoading && (
          <EmptyState
            icon={ExclamationTriangleIcon}
            title="Failed to load backups"
            description={error instanceof Error ? error.message : 'The request did not complete.'}
            variant="error"
            size="lg"
            action={{ label: 'Retry', onClick: () => refetch() }}
          />
        )}

        {!isLoading && !error && servers.length === 0 && (
          <EmptyState
            icon={ArchiveBoxIcon}
            title="No backups to show"
            description="You do not have permission to read backups on any server."
            size="lg"
          />
        )}

        {servers.map((server) => (
          <ServerSection key={server.server_id} server={server} />
        ))}
      </div>
    </div>
  );
}
