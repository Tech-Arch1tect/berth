import { theme } from '../../../theme';
import { Network, NetworkEndpoint } from '../../../types/stack';
import { cn } from '../../../utils/cn';

interface NetworkCardProps {
  network: Network;
}

const statusBadge = (exists: boolean) =>
  exists ? theme.badges.tag.success : theme.badges.tag.neutral;

export const NetworkCard = ({ network }: NetworkCardProps) => {
  const connectedContainers = Object.entries(network.containers ?? {});

  return (
    <article className={theme.containers.cardSoft}>
      <header className={cn(theme.containers.sectionHeader, 'mb-4')}>
        <div>
          <h3 className={cn('text-lg font-semibold', theme.text.strong)}>{network.name}</h3>
          {network.driver && (
            <p className={cn('text-sm', theme.text.subtle)}>Driver: {network.driver}</p>
          )}
        </div>
        <div className="flex items-center gap-2 text-xs">
          <span className={cn(theme.badges.tag.base, statusBadge(network.exists))}>
            {network.exists ? 'Active' : 'Declared'}
          </span>
          {network.external && (
            <span className={cn(theme.badges.tag.base, theme.badges.tag.info)}>External</span>
          )}
        </div>
      </header>

      <section className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div>
          <p className={theme.forms.label}>Status</p>
          <p className={cn('mt-1 text-sm', theme.text.standard)}>
            {network.exists ? 'Running' : 'Not Created'}
          </p>
        </div>
        {network.created && (
          <div>
            <p className={theme.forms.label}>Created</p>
            <p className={cn('mt-1 text-sm', theme.text.standard)}>
              {new Date(network.created).toLocaleString()}
            </p>
          </div>
        )}
      </section>

      {network.ipam && (
        <section className="mt-4">
          <h4 className={cn('mb-2 text-sm font-semibold', theme.text.strong)}>
            Network Configuration
          </h4>
          <div className={cn(theme.surface.soft, 'space-y-2 rounded-lg p-3')}>
            {network.ipam.driver && (
              <div className="flex items-center justify-between text-sm">
                <span className={theme.text.subtle}>IPAM Driver</span>
                <span className={cn('font-mono', theme.text.standard)}>{network.ipam.driver}</span>
              </div>
            )}
            {network.ipam.config && network.ipam.config.length > 0 && (
              <div className="space-y-2 text-sm">
                <span className={theme.text.subtle}>Subnets</span>
                {network.ipam.config.map((config, index) => (
                  <div
                    key={index}
                    className="flex flex-col gap-1 rounded bg-slate-900/40 px-3 py-2 text-xs text-slate-200"
                  >
                    {config.subnet && <span>Subnet: {config.subnet}</span>}
                    {config.gateway && <span>Gateway: {config.gateway}</span>}
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>
      )}

      {connectedContainers.length > 0 && (
        <section className="mt-4">
          <h4 className={cn('mb-2 text-sm font-semibold', theme.text.strong)}>
            Connected Containers ({connectedContainers.length})
          </h4>
          <div className="space-y-2">
            {connectedContainers.map(([id, endpoint]) => {
              const details = endpoint as NetworkEndpoint;
              return (
                <div key={id} className={cn(theme.surface.soft, 'rounded-lg p-3')}>
                  <div className="flex items-center justify-between gap-3">
                    <span className={cn('text-sm font-medium', theme.text.strong)}>
                      {details.name}
                    </span>
                    <span className={cn('font-mono text-xs', theme.text.subtle)}>
                      {id.slice(0, 12)}…
                    </span>
                  </div>
                  <div className="mt-2 grid grid-cols-1 gap-2 text-xs md:grid-cols-2">
                    {details.ipv4_address && (
                      <div>
                        <span className={theme.text.subtle}>IPv4: </span>
                        <span className={cn('font-mono', theme.text.standard)}>
                          {details.ipv4_address}
                        </span>
                      </div>
                    )}
                    {details.mac_address && (
                      <div>
                        <span className={theme.text.subtle}>MAC: </span>
                        <span className={cn('font-mono', theme.text.standard)}>
                          {details.mac_address}
                        </span>
                      </div>
                    )}
                    {details.ipv6_address && (
                      <div className="md:col-span-2">
                        <span className={theme.text.subtle}>IPv6: </span>
                        <span className={cn('font-mono', theme.text.standard)}>
                          {details.ipv6_address}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {network.labels && Object.keys(network.labels).length > 0 && (
        <section className="mt-4">
          <h4 className={cn('mb-2 text-sm font-semibold', theme.text.strong)}>Labels</h4>
          <div className="flex flex-wrap gap-2 text-xs">
            {Object.entries(network.labels).map(([key, value]) => (
              <span key={key} className={cn(theme.badges.tag.base, theme.badges.tag.neutral)}>
                {key}: {value}
              </span>
            ))}
          </div>
        </section>
      )}

      {network.options && Object.keys(network.options).length > 0 && (
        <section className="mt-4">
          <h4 className={cn('mb-2 text-sm font-semibold', theme.text.strong)}>Driver Options</h4>
          <div className={cn(theme.surface.soft, 'space-y-1 rounded-lg p-3 text-sm')}>
            {Object.entries(network.options).map(([key, value]) => (
              <div key={key} className="flex justify-between gap-3">
                <span className={theme.text.subtle}>{key}</span>
                <span className={cn('font-mono', theme.text.standard)}>{value}</span>
              </div>
            ))}
          </div>
        </section>
      )}
    </article>
  );
};

export default NetworkCard;
