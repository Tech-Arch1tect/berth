import Layout from '../components/layout/Layout';
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
    <Layout>
      <Head title={title} />

      {/* Header Section */}
      <div className="mb-8">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1
              className={cn(
                'text-3xl font-bold bg-clip-text text-transparent',
                theme.brand.titleGradient
              )}
            >
              {title}
            </h1>
            <p className={cn('mt-2', theme.text.muted)}>
              Welcome back,{' '}
              <span className={cn('font-semibold', theme.text.strong)}>{currentUser.username}</span>
              ! Here's your infrastructure overview.
            </p>
          </div>
          <div className={cn('flex items-center space-x-2 text-sm', theme.text.subtle)}>
            <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
            <span>Live data</span>
          </div>
        </div>
      </div>

      <FlashMessages className="mb-8" />

      {/* Status Alert */}
      <DashboardStatusAlert healthSummary={healthSummary} />

      {/* Stats Grid */}
      <DashboardStats healthSummary={healthSummary} userRoles={userRoles} />

      {/* Recent Activity & Operations */}
      <DashboardRecentActivity activitySummary={activitySummary} />

      {/* Servers Section */}
      <DashboardServerSection servers={servers} healthSummary={healthSummary} />
    </Layout>
  );
}
