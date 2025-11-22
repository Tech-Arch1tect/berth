import FlashMessages from '../components/FlashMessages';
import { Head } from '@inertiajs/react';
import { Server } from '../types/server';
import {
  DashboardStats,
  DashboardStatusAlert,
  DashboardServerSection,
  DashboardRecentActivity,
  useDashboardHealth,
  useDashboardActivity,
} from '../components/dashboard';
import { cn } from '../utils/cn';
import { theme } from '../theme';

interface DashboardProps {
  title: string;
  servers: Server[];
  currentUser: {
    id: number;
    username: string;
    email: string;
    roles?: Array<{ name: string }>;
  };
}

export default function Dashboard({ title, servers, currentUser }: DashboardProps) {
  const userRoles = currentUser?.roles?.map((role) => role.name) || [];
  const healthSummary = useDashboardHealth(servers);
  const activitySummary = useDashboardActivity();

  return (
    <>
      <Head title={title} />

      {/* Header Section */}
      <div className="mb-4">
        <div className="flex items-center justify-between">
          <h1 className={cn('text-2xl font-bold', theme.brand.titleColor)}>{title}</h1>
          <div className={cn('flex items-center space-x-2 text-xs', theme.text.subtle)}>
            <div className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse"></div>
            <span>Live data</span>
          </div>
        </div>
      </div>

      <FlashMessages className="mb-4" />

      {/* Status Alert */}
      <DashboardStatusAlert healthSummary={healthSummary} />

      {/* Stats Grid */}
      <DashboardStats healthSummary={healthSummary} userRoles={userRoles} />

      {/* Recent Activity & Operations */}
      <DashboardRecentActivity activitySummary={activitySummary} />

      {/* Servers Section */}
      <DashboardServerSection servers={servers} healthSummary={healthSummary} />
    </>
  );
}
