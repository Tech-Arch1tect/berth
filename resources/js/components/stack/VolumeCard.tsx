import { theme } from '../../theme';
import { Volume } from '../../types/stack';
import { cn } from '../../utils/cn';
import { formatDate } from '../../utils/formatters';

interface VolumeCardProps {
  volume: Volume;
}

const formatDateSafe = (value?: string) => {
  if (!value) return 'Unknown';
  try {
    return formatDate(value);
  } catch {
    return 'Invalid date';
  }
};

export const VolumeCard = ({ volume }: VolumeCardProps) => {
  const statusTag = volume.exists ? theme.badges.tag.success : theme.badges.tag.neutral;

  return (
    <article className={theme.containers.cardSoft}>
      <header
        className={cn(theme.containers.sectionHeader, 'mb-4')}
        aria-label={`Volume ${volume.name}`}
      >
        <div className="flex items-center gap-3">
          <div className={cn(theme.icon.squareMd, theme.brand.accent)}>
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M5 19a2 2 0 01-2-2V7a2 2 0 012-2h4l2 2h4a2 2 0 012 2v1M5 19h14a2 2 0 002-2v-5a2 2 0 00-2-2H9a2 2 0 00-2 2v5a2 2 0 01-2 2z"
              />
            </svg>
          </div>
          <div>
            <h3 className={cn('text-lg font-semibold', theme.text.strong)}>{volume.name}</h3>
            {volume.driver && (
              <p className={cn('text-sm', theme.text.subtle)}>Driver: {volume.driver}</p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className={cn(theme.badges.tag.base, statusTag)}>
            {volume.exists ? 'Active' : 'Declared'}
          </span>
          {volume.external && (
            <span className={cn(theme.badges.tag.base, theme.badges.tag.info)}>External</span>
          )}
        </div>
      </header>

      <section className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div>
          <p className={theme.forms.label}>Status</p>
          <p className={cn('mt-1 text-sm', theme.text.standard)}>
            {volume.exists ? 'Running' : 'Not Created'}
          </p>
        </div>
        {volume.created && (
          <div>
            <p className={theme.forms.label}>Created</p>
            <p className={cn('mt-1 text-sm', theme.text.standard)}>
              {formatDateSafe(volume.created)}
            </p>
          </div>
        )}
        {volume.scope && (
          <div>
            <p className={theme.forms.label}>Scope</p>
            <p className={cn('mt-1 font-mono text-sm', theme.text.standard)}>{volume.scope}</p>
          </div>
        )}
        {volume.mountpoint && (
          <div>
            <p className={theme.forms.label}>Mount Point</p>
            <p className={cn('mt-1 font-mono text-sm break-all', theme.text.standard)}>
              {volume.mountpoint}
            </p>
          </div>
        )}
      </section>

      {volume.used_by && volume.used_by.length > 0 && (
        <section className="mt-4">
          <h4 className={cn('mb-2 text-sm font-semibold', theme.text.strong)}>
            Used by Containers ({volume.used_by.length})
          </h4>
          <div className="space-y-2">
            {volume.used_by.map((usage, index) => (
              <div key={index} className={cn('rounded-lg p-3', theme.surface.soft)}>
                <div className="flex items-center justify-between">
                  <span className={cn('font-medium', theme.text.strong)}>
                    {usage.container_name}
                  </span>
                  <span className={cn('text-sm', theme.text.subtle)}>
                    Service: {usage.service_name}
                  </span>
                </div>
                {usage.mounts.map((mount, mountIndex) => (
                  <div key={mountIndex} className="mt-2 space-y-1 text-xs">
                    <div className="flex flex-wrap gap-3">
                      <span className={theme.badges.tag.neutral}>Type: {mount.type}</span>
                      <span className={theme.badges.tag.neutral}>
                        Source: <span className="font-mono">{mount.source}</span>
                      </span>
                      <span className={theme.badges.tag.neutral}>
                        Target: <span className="font-mono">{mount.target}</span>
                      </span>
                      {mount.read_only && (
                        <span className={cn(theme.badges.tag.base, theme.badges.tag.danger)}>
                          Read Only
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ))}
          </div>
        </section>
      )}

      {volume.driver_opts && Object.keys(volume.driver_opts).length > 0 && (
        <section className="mt-4">
          <h4 className={cn('mb-2 text-sm font-semibold', theme.text.strong)}>Driver Options</h4>
          <div className={cn('rounded-lg p-3', theme.surface.soft)}>
            <dl className="space-y-1 text-sm">
              {Object.entries(volume.driver_opts).map(([key, value]) => (
                <div key={key} className="flex gap-4">
                  <dt className={cn('min-w-[120px]', theme.text.subtle)}>{key}</dt>
                  <dd className={cn('font-mono', theme.text.standard)}>{value}</dd>
                </div>
              ))}
            </dl>
          </div>
        </section>
      )}

      {volume.labels && Object.keys(volume.labels).length > 0 && (
        <section className="mt-4">
          <h4 className={cn('mb-2 text-sm font-semibold', theme.text.strong)}>Labels</h4>
          <div className="flex flex-wrap gap-2">
            {Object.entries(volume.labels).map(([key, value]) => (
              <span key={key} className={cn(theme.badges.tag.base, theme.badges.tag.neutral)}>
                {key}: {value}
              </span>
            ))}
          </div>
        </section>
      )}
    </article>
  );
};

export default VolumeCard;
