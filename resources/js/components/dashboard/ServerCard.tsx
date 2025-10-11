import { Link } from '@inertiajs/react';
import {
  ServerIcon,
  ChevronRightIcon,
  WifiIcon,
  NoSymbolIcon,
  ExclamationTriangleIcon,
} from '@heroicons/react/24/outline';
import { cn } from '../../utils/cn';
import { theme } from '../../theme';
import { Server } from '../../types/server';
import { useServerStatistics } from '../../hooks/useServerStatistics';

interface ServerCardProps {
  server: Server;
}

const statusConfig = {
  online: {
    text: 'Online',
    icon: WifiIcon,
    pulse: true,
  },
  offline: {
    text: 'Offline',
    icon: NoSymbolIcon,
    pulse: false,
  },
} as const;

export default function ServerCard({ server }: ServerCardProps) {
  const {
    data: statistics,
    isLoading: statisticsLoading,
    error: statisticsError,
  } = useServerStatistics(server.id);

  const status = server.is_active ? 'online' : 'offline';
  const config = statusConfig[status];

  return (
    <Link
      href={`/servers/${server.id}/stacks`}
      className={cn(
        theme.cards.shell,
        theme.cards.translucent,
        theme.cards.interactive,
        theme.cards.lift,
        'p-4'
      )}
    >
      {/* Status indicator */}
      <div className="absolute right-3 top-3">
        <div className={cn(theme.badges.status.base, theme.badges.status[status])}>
          <div
            className={cn(
              theme.badges.statusDot.base,
              theme.badges.statusDot[status],
              config.pulse && theme.badges.statusDot.pulse
            )}
          />
          <span>{config.text}</span>
        </div>
      </div>

      {/* Server info */}
      <div className="flex items-start space-x-3">
        <div className="flex-shrink-0">
          <div
            className={cn(
              theme.icon.squareMd,
              status === 'online' ? theme.brand.serverOnline : theme.brand.serverOffline,
              'shadow-md'
            )}
          >
            <ServerIcon className="h-5 w-5" />
          </div>
        </div>

        <div className="min-w-0 flex-1 pr-6">
          <div className="mb-2 flex items-center gap-2">
            <h3 className={cn('text-lg font-bold transition-colors', theme.text.strong)}>
              {server.name}
            </h3>
            <span
              className={cn(
                'rounded-md bg-zinc-100 px-1.5 py-0.5 font-mono text-xs font-medium dark:bg-zinc-800',
                theme.text.subtle
              )}
            >
              #{server.id}
            </span>
          </div>

          <div className="space-y-2">
            <div className={cn('flex items-center gap-2 text-xs', theme.text.muted)}>
              <span className={cn('rounded px-1.5 py-0.5 font-mono text-xs', theme.surface.code)}>
                {server.host}:{server.port}
              </span>
            </div>

            {statisticsError ? (
              <div className="flex items-center gap-1.5">
                <ExclamationTriangleIcon className={cn('h-4 w-4', theme.text.danger)} />
                <span className={cn('text-xs', theme.text.danger)}>Failed to load stats</span>
              </div>
            ) : statistics ? (
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className={cn(theme.badges.tag.base, theme.badges.tag.neutral)}>
                  {statistics.total_stacks} Total
                </span>
                <span className={cn(theme.badges.tag.base, theme.badges.tag.success)}>
                  {statistics.healthy_stacks} Healthy
                </span>
                {statistics.unhealthy_stacks > 0 && (
                  <span className={cn(theme.badges.tag.base, theme.badges.tag.danger)}>
                    {statistics.unhealthy_stacks} Unhealthy
                  </span>
                )}
              </div>
            ) : statisticsLoading ? (
              <span className={cn('text-xs', theme.text.muted)}>Loading stats...</span>
            ) : (
              <span className={cn('text-xs', theme.text.muted)}>No stats available</span>
            )}
          </div>
        </div>
      </div>

      {/* Hover effect gradient */}
      <div className={theme.effects.hoverGlow} />
    </Link>
  );
}
