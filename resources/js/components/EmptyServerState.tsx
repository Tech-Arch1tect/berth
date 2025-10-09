import { ServerIcon, PlusIcon } from '@heroicons/react/24/outline';
import { theme } from '../theme';
import { cn } from '../utils/cn';

export default function EmptyServerState() {
  return (
    <div className="py-16 text-center">
      <div className="relative">
        {/* Background decoration */}
        <div className="absolute inset-0 flex items-center justify-center">
          <div className={cn('h-32 w-32 rounded-full opacity-50', theme.effects.emptyAura)} />
        </div>

        {/* Icon */}
        <div className="relative">
          <div className={theme.icon.emptyState}>
            <ServerIcon className="h-8 w-8" />
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-md">
        <h3 className={cn('mb-2 text-xl font-semibold', theme.text.strong)}>
          No servers configured
        </h3>
        <p className={cn('mb-6', theme.text.muted)}>
          Start your infrastructure management journey by adding your first Docker server.
        </p>

        <div className={cn(theme.badges.pillMuted, 'px-4 py-2 text-sm')}>
          <PlusIcon className="h-4 w-4" />
          <span>Contact your administrator to add servers</span>
        </div>
      </div>
    </div>
  );
}
