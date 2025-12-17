import type { FC, ReactNode } from 'react';

interface MaintenanceContentProps {
  children: ReactNode;
}

export const MaintenanceContent: FC<MaintenanceContentProps> = ({ children }) => {
  return <div>{children}</div>;
};
