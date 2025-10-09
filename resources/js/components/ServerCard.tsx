import { Link } from '@inertiajs/react';
import {
  ServerIcon,
  ChevronRightIcon,
  WifiIcon,
  NoSymbolIcon,
  ExclamationTriangleIcon,
} from '@heroicons/react/24/outline';
import { cn } from '../utils/cn';
import { theme } from '../theme';
import { Server } from '../types/server';
import { useServerStatistics } from '../hooks/useServerStatistics';

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
        theme.cards.padded
      )}
    >
      {/* Status indicator */}
      <div className="absolute right-4 top-4">
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
      <div className="flex items-start space-x-4">
        <div className="flex-shrink-0">
          <div
            className={cn(
              theme.icon.squareLg,
              status === 'online' ? theme.brand.serverOnline : theme.brand.serverOffline
            )}
          >
            <ServerIcon className="h-6 w-6" />
          </div>
        </div>

        <div className="min-w-0 flex-1 pr-8">
          <div className="mb-2 flex items-center gap-2">
            <h3
              className={cn(
                'text-xl font-semibold transition-colors',
                theme.text.strong,
                'group-hover:text-blue-600 dark:group-hover:text-blue-400'
              )}
            >
              {server.name}
            </h3>
            <span className={cn('font-mono text-sm', theme.text.subtle)}>#{server.id}</span>
          </div>

          <div className="space-y-2">
            <div className={cn('flex items-center text-sm', theme.text.muted)}>
              <span className={cn('rounded-lg px-2 py-1 font-mono', theme.surface.code)}>
                https://{server.host}:{server.port}
              </span>
            </div>

            <div className="space-y-2">
              {statisticsError ? (
                <div className={cn('rounded-lg p-4 text-center', theme.intent.danger.surface)}>
                  <div
                    className={cn(
                      'flex items-center justify-center space-x-2',
                      theme.intent.danger.textStrong
                    )}
                  >
                    <ExclamationTriangleIcon className="h-4 w-4" />
                    <span className="text-sm">Failed to load statistics</span>
                  </div>
                </div>
              ) : statistics ? (
                <div className="grid grid-cols-3 gap-2">
                  <div className={cn('rounded-lg p-2 text-center', theme.intent.neutral.surface)}>
                    <div className={cn('text-lg font-semibold', theme.intent.neutral.textStrong)}>
                      {statistics.total_stacks}
                    </div>
                    <div className={cn('text-xs', theme.intent.neutral.textMuted)}>Total</div>
                  </div>
                  <div className={cn('rounded-lg p-2 text-center', theme.intent.success.surface)}>
                    <div className={cn('text-lg font-semibold', theme.intent.success.textStrong)}>
                      {statistics.healthy_stacks}
                    </div>
                    <div className={cn('text-xs', theme.intent.success.textMuted)}>Healthy</div>
                  </div>
                  <div className={cn('rounded-lg p-2 text-center', theme.intent.danger.surface)}>
                    <div className={cn('text-lg font-semibold', theme.intent.danger.textStrong)}>
                      {statistics.unhealthy_stacks}
                    </div>
                    <div className={cn('text-xs', theme.intent.danger.textMuted)}>Unhealthy</div>
                  </div>
                </div>
              ) : statisticsLoading ? (
                <div className={cn('rounded-lg p-4 text-center', theme.intent.neutral.surface)}>
                  <div className={cn('text-sm', theme.intent.neutral.textMuted)}>
                    Loading stack statistics...
                  </div>
                </div>
              ) : (
                <div className={cn('rounded-lg p-4 text-center', theme.intent.neutral.surface)}>
                  <div className={cn('text-sm', theme.intent.neutral.textMuted)}>
                    No statistics available
                  </div>
                </div>
              )}

              <div
                className={cn('flex items-center justify-between pt-2', theme.cards.sectionDivider)}
              >
                <span className={cn('text-sm', theme.text.subtle)}>Docker Stack Management</span>
                <ChevronRightIcon
                  className={cn(
                    'h-5 w-5 transition-all duration-200 group-hover:translate-x-1 group-hover:text-blue-500',
                    theme.text.subtle
                  )}
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Hover effect gradient */}
      <div className={theme.effects.hoverGlow} />
    </Link>
  );
}
