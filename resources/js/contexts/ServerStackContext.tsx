import React, { createContext, useContext, ReactNode } from 'react';

interface ServerStackContextType {
  serverId: number;
  stackName: string;
  serverName?: string;
}

const ServerStackContext = createContext<ServerStackContextType | undefined>(undefined);

export interface ServerStackProviderProps {
  children: ReactNode;
  serverId: number;
  stackName: string;
  serverName?: string;
}

export const ServerStackProvider: React.FC<ServerStackProviderProps> = ({
  children,
  serverId,
  stackName,
  serverName,
}) => {
  return (
    <ServerStackContext.Provider value={{ serverId, stackName, serverName }}>
      {children}
    </ServerStackContext.Provider>
  );
};

export const useServerStack = (): ServerStackContextType => {
  const context = useContext(ServerStackContext);
  if (!context) {
    throw new Error('useServerStack must be used within ServerStackProvider');
  }
  return context;
};
