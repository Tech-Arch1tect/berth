import { useState, useMemo } from 'react';
import { MagnifyingGlassIcon } from '@heroicons/react/24/outline';
import ServerCard from '../dashboard/ServerCard';
import EmptyServerState from '../dashboard/EmptyServerState';
import { EmptyState } from '../common/EmptyState';
import { Server } from '../../types/server';
import { theme } from '../../theme';
import { cn } from '../../utils/cn';

interface ServerListProps {
  servers: Server[];
}

export default function ServerList({ servers }: ServerListProps) {
  const [searchTerm, setSearchTerm] = useState('');

  const filteredServers = useMemo(() => {
    return servers.filter((server) => {
      const lowerTerm = searchTerm.toLowerCase();
      return (
        server.name.toLowerCase().includes(lowerTerm) ||
        server.description.toLowerCase().includes(lowerTerm) ||
        server.host.toLowerCase().includes(lowerTerm)
      );
    });
  }, [servers, searchTerm]);

  return (
    <div className={cn(theme.containers.panel, 'p-4')}>
      <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <h2 className={cn('text-base font-bold', theme.text.strong)}>Servers</h2>
        <span className={cn('text-xs', theme.text.subtle)}>
          {filteredServers.length} of {servers.length} server
          {servers.length !== 1 ? 's' : ''}
        </span>
      </div>

      {servers.length > 0 && (
        <div className="mb-3 flex flex-col gap-2 sm:flex-row">
          <div className="relative flex-1">
            <MagnifyingGlassIcon className={theme.forms.inputIcon} />
            <input
              type="text"
              placeholder="Search servers..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className={cn(theme.forms.input, 'pl-10')}
            />
          </div>
        </div>
      )}

      {servers.length === 0 ? (
        <EmptyServerState />
      ) : filteredServers.length === 0 ? (
        <EmptyState
          icon={MagnifyingGlassIcon}
          title="No servers found"
          description="Try adjusting your search criteria."
        />
      ) : (
        <div className="space-y-2">
          {filteredServers.map((server) => (
            <ServerCard key={server.id} server={server} />
          ))}
        </div>
      )}
    </div>
  );
}
