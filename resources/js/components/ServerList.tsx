import { useState, useMemo } from 'react';
import { MagnifyingGlassIcon } from '@heroicons/react/24/outline';
import ServerCard from './ServerCard';
import EmptyServerState from './EmptyServerState';
import { Server } from '../types/server';
import { theme } from '../theme';
import { cn } from '../utils/cn';

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
    <div className={theme.containers.panel}>
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <h2 className={cn('text-xl font-semibold', theme.text.strong)}>Servers</h2>
        <span className={cn('text-sm', theme.text.subtle)}>
          {filteredServers.length} of {servers.length} server
          {servers.length !== 1 ? 's' : ''}
        </span>
      </div>

      {servers.length > 0 && (
        <div className="mb-6 flex flex-col gap-4 sm:flex-row">
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
        <div className="py-8 text-center">
          <MagnifyingGlassIcon className={cn('mx-auto h-12 w-12', theme.text.subtle)} />
          <h3 className={cn('mt-2 text-sm font-medium', theme.text.strong)}>No servers found</h3>
          <p className={cn('mt-1 text-sm', theme.text.muted)}>
            Try adjusting your search criteria.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredServers.map((server) => (
            <ServerCard key={server.id} server={server} />
          ))}
        </div>
      )}
    </div>
  );
}
